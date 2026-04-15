import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { UserContext } from '@solaroo/types';
import { UploadDocumentDto, DocumentQueryDto, DOC_CATEGORIES } from './documents.dto';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentItem = {
  id: string;
  docCode: string;
  title: string;
  docType: string;
  status: string;
  currentRevision: string | null;
  notes: string | null;
  createdAt: Date;
  fileSizeBytes: number | null;
  mimeType: string | null;
  fileName: string | null;
  uploadedAt: Date | null;
  owner: { id: string; name: string } | null;
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DocumentsService {
  private readonly uploadsDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  // ── Create opportunity folder structure ──────────────────────────────────

  async createOpportunityFolders(opportunityId: string): Promise<void> {
    const slugs = DOC_CATEGORIES.map((c) =>
      c.toLowerCase().replace(/\s+/g, '-'),
    );
    const baseDir = path.join(this.uploadsDir, 'opportunities', opportunityId);
    for (const slug of slugs) {
      await fs.mkdir(path.join(baseDir, slug), { recursive: true });
    }
  }

  // ── List documents for an opportunity ───────────────────────────────────

  async findForOpportunity(opportunityId: string): Promise<DocumentItem[]> {
    const docs = await this.prisma.document.findMany({
      where: { opportunityId },
      include: {
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        owner:     { select: { id: true, name: true } },
      },
      orderBy: [{ docType: 'asc' }, { createdAt: 'desc' }],
    });

    return docs.map((doc) => {
      const latest = doc.revisions[0] ?? null;
      return {
        id:              doc.id,
        docCode:         doc.docCode,
        title:           doc.title,
        docType:         doc.docType,
        status:          doc.status,
        currentRevision: doc.currentRevision,
        notes:           doc.notes,
        createdAt:       doc.createdAt,
        fileSizeBytes:   latest?.fileSizeBytes ?? null,
        mimeType:        latest?.mimeType ?? null,
        fileName:        latest ? path.basename(latest.fileUrl) : null,
        uploadedAt:      latest?.uploadedAt ?? null,
        owner:           doc.owner ?? null,
      };
    });
  }

  // ── Upload a document ────────────────────────────────────────────────────

  async upload(dto: UploadDocumentDto, user: UserContext): Promise<DocumentItem> {
    // Validate base64 data size (base64 is ~33% larger than binary)
    const estimatedSize = Math.floor(dto.fileBase64.length * 0.75);
    if (estimatedSize > 20 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 15 MB)');
    }

    // Decode base64
    const buffer = Buffer.from(dto.fileBase64, 'base64');

    // Build safe filename: timestamp + sanitised original name
    const ext = path.extname(dto.fileName) || '';
    const baseName = path.basename(dto.fileName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFileName = `${Date.now()}-${baseName}${ext}`;

    // Category slug
    const categorySlug = dto.docType.toLowerCase().replace(/\s+/g, '-');

    // Ensure directory exists
    const relDir  = path.join('opportunities', dto.opportunityId, categorySlug);
    const absDir  = path.join(this.uploadsDir, relDir);
    await fs.mkdir(absDir, { recursive: true });

    // Write file
    const absPath = path.join(absDir, safeFileName);
    await fs.writeFile(absPath, buffer);

    // Generate docCode
    const count = await this.prisma.document.count({
      where: { opportunityId: dto.opportunityId },
    });
    const suffix = String(count + 1).padStart(3, '0');
    const docCode = `OPP-${dto.opportunityId.slice(-6).toUpperCase()}-${suffix}`;

    // Persist Document + DocumentRevision
    const relPath = path.posix.join(
      'opportunities',
      dto.opportunityId,
      categorySlug,
      safeFileName,
    );

    const doc = await this.prisma.document.create({
      data: {
        docCode,
        title:           dto.title,
        docType:         dto.docType,
        module:          'opportunity',
        currentRevision: 'A',
        notes:           dto.notes ?? null,
        opportunityId:   dto.opportunityId,
        ownerUserId:     user.id,
        revisions: {
          create: {
            revision:        'A',
            fileUrl:         relPath,
            fileSizeBytes:   buffer.length,
            mimeType:        dto.mimeType,
            uploadedByUserId: user.id,
            approvalStatus:  'PENDING',
          },
        },
      },
      include: {
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        owner:     { select: { id: true, name: true } },
      },
    });

    const latest = doc.revisions[0];
    return {
      id:              doc.id,
      docCode:         doc.docCode,
      title:           doc.title,
      docType:         doc.docType,
      status:          doc.status,
      currentRevision: doc.currentRevision,
      notes:           doc.notes,
      createdAt:       doc.createdAt,
      fileSizeBytes:   latest?.fileSizeBytes ?? null,
      mimeType:        latest?.mimeType ?? null,
      fileName:        latest ? path.basename(latest.fileUrl) : null,
      uploadedAt:      latest?.uploadedAt ?? null,
      owner:           doc.owner ?? null,
    };
  }

  // ── Get file info for download ───────────────────────────────────────────

  async getFileInfo(
    id: string,
    _user: UserContext,
  ): Promise<{ absPath: string; fileName: string; mimeType: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 } },
    });

    if (!doc || !doc.revisions[0]) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const rev = doc.revisions[0];
    const absPath = path.join(this.uploadsDir, rev.fileUrl);

    // Confirm file exists on disk
    if (!fsSync.existsSync(absPath)) {
      throw new NotFoundException('File not found on disk');
    }

    const ext = path.extname(rev.fileUrl);
    const safeTitle = doc.title.replace(/[^a-zA-Z0-9._-]/g, '_');

    return {
      absPath,
      fileName: `${safeTitle}${ext}`,
      mimeType: rev.mimeType ?? 'application/octet-stream',
    };
  }

  // ── Delete a document ────────────────────────────────────────────────────

  async delete(id: string, _user: UserContext): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { revisions: true },
    });

    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    // Remove files from disk (best effort)
    for (const rev of doc.revisions) {
      try {
        await fs.unlink(path.join(this.uploadsDir, rev.fileUrl));
      } catch {
        // ignore missing files
      }
    }

    // Delete revisions first (FK), then document
    await this.prisma.documentRevision.deleteMany({ where: { documentId: id } });
    await this.prisma.document.delete({ where: { id } });
  }

  // ── Stubs kept from original ─────────────────────────────────────────────

  async findAll(_user: UserContext): Promise<DocumentItem[]> {
    return [];
  }

  async findById(id: string, user: UserContext): Promise<DocumentItem | null> {
    const docs = await this.prisma.document.findUnique({
      where: { id },
      include: {
        revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        owner:     { select: { id: true, name: true } },
      },
    });
    if (!docs) return null;
    const latest = docs.revisions[0] ?? null;
    return {
      id:              docs.id,
      docCode:         docs.docCode,
      title:           docs.title,
      docType:         docs.docType,
      status:          docs.status,
      currentRevision: docs.currentRevision,
      notes:           docs.notes,
      createdAt:       docs.createdAt,
      fileSizeBytes:   latest?.fileSizeBytes ?? null,
      mimeType:        latest?.mimeType ?? null,
      fileName:        latest ? path.basename(latest.fileUrl) : null,
      uploadedAt:      latest?.uploadedAt ?? null,
      owner:           docs.owner ?? null,
    };
  }
}
