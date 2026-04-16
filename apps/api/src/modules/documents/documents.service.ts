import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import { Prisma } from '@solaroo/db';
import { UploadDocumentDto, DocumentQueryDto, DOC_CATEGORIES } from './documents.dto';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Compact item for list views — includes linked project/opportunity context */
export type DocumentListItem = {
  id: string;
  docCode: string;
  title: string;
  docType: string;
  status: string;
  currentRevision: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Latest revision
  fileSizeBytes: number | null;
  mimeType: string | null;
  fileName: string | null;
  uploadedAt: Date | null;
  latestRevisionStatus: string | null;
  // Relations
  owner: { id: string; name: string } | null;
  project: { id: string; projectCode: string; name: string } | null;
  opportunity: { id: string; opportunityCode: string; title: string } | null;
};

/** Full revision entry for history view */
export type DocumentRevisionDetail = {
  id: string;
  revision: string;
  description: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  approvalStatus: string;
  uploadedAt: Date;
  uploadedBy: { id: string; name: string } | null;
};

/** Legacy type kept for backward compat with upload response */
export type DocumentItem = DocumentListItem;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class DocumentsService {
  private readonly uploadsDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  // ── Shared select shape ─────────────────────────────────────────────────

  private readonly DOC_SELECT = {
    id: true,
    docCode: true,
    title: true,
    docType: true,
    status: true,
    currentRevision: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
    owner: { select: { id: true, name: true } },
    project: { select: { id: true, projectCode: true, name: true } },
    opportunity: { select: { id: true, opportunityCode: true, title: true } },
    revisions: {
      orderBy: { uploadedAt: 'desc' as const },
      take: 1,
      select: {
        fileSizeBytes: true,
        mimeType: true,
        fileUrl: true,
        uploadedAt: true,
        approvalStatus: true,
      },
    },
  } as const;

  private mapToListItem(doc: any): DocumentListItem {
    const latest = doc.revisions[0] ?? null;
    return {
      id:                   doc.id,
      docCode:              doc.docCode,
      title:                doc.title,
      docType:              doc.docType,
      status:               doc.status,
      currentRevision:      doc.currentRevision,
      notes:                doc.notes,
      createdAt:            doc.createdAt,
      updatedAt:            doc.updatedAt,
      fileSizeBytes:        latest?.fileSizeBytes ?? null,
      mimeType:             latest?.mimeType ?? null,
      fileName:             latest ? path.basename(latest.fileUrl) : null,
      uploadedAt:           latest?.uploadedAt ?? null,
      latestRevisionStatus: latest?.approvalStatus ?? null,
      owner:                doc.owner ?? null,
      project:              doc.project ?? null,
      opportunity:          doc.opportunity ?? null,
    };
  }

  // ── List all documents (with filters + scope) ────────────────────────────

  async findAll(
    user: UserContext,
    query: DocumentQueryDto,
  ): Promise<PaginatedResult<DocumentListItem>> {
    const { opportunityId, projectId, docType, status, search, sortBy, sortDir, page, pageSize } = query;

    // Scope enforcement: determine what records this user can see
    const scope = await this.authz.getBestScope(user, 'document', 'view');

    const scopeFilter: Prisma.DocumentWhereInput =
      scope === 'assigned'
        ? {
            OR: [
              { ownerUserId: user.id },
              {
                project: {
                  OR: [
                    { projectManagerId: user.id },
                    { members: { some: { userId: user.id } } },
                  ],
                },
              },
              {
                opportunity: {
                  OR: [
                    { ownerUserId: user.id },
                    { members: { some: { userId: user.id } } },
                  ],
                },
              },
            ],
          }
        : {}; // 'all' or 'team' — no extra filter

    const where: Prisma.DocumentWhereInput = {
      ...scopeFilter,
      ...(opportunityId && { opportunityId }),
      ...(projectId     && { projectId }),
      ...(docType       && { docType }),
      ...(status        && { status: status as any }),
      ...(search && {
        OR: [
          { title:   { contains: search, mode: 'insensitive' } },
          { docCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, docs] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: this.DOC_SELECT,
      }),
    ]);

    return {
      items: docs.map((d) => this.mapToListItem(d)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── List documents for an opportunity (legacy / convenience) ─────────────

  async findForOpportunity(opportunityId: string): Promise<DocumentListItem[]> {
    const docs = await this.prisma.document.findMany({
      where: { opportunityId },
      orderBy: [{ docType: 'asc' }, { createdAt: 'desc' }],
      select: this.DOC_SELECT,
    });
    return docs.map((d) => this.mapToListItem(d));
  }

  // ── Get single document ──────────────────────────────────────────────────

  async findById(id: string, _user: UserContext): Promise<DocumentListItem | null> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: this.DOC_SELECT,
    });
    if (!doc) return null;
    return this.mapToListItem(doc);
  }

  // ── Get revision history ─────────────────────────────────────────────────

  async findRevisions(id: string, _user: UserContext): Promise<DocumentRevisionDetail[]> {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        revisions: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            revision: true,
            description: true,
            fileSizeBytes: true,
            mimeType: true,
            approvalStatus: true,
            uploadedAt: true,
            uploadedByUserId: true,
          },
        },
      },
    });

    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    // Fetch uploader names in one query
    const uploaderIds = [...new Set(
      doc.revisions.map((r) => r.uploadedByUserId).filter(Boolean) as string[],
    )];
    const uploaders = uploaderIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, name: true },
        })
      : [];
    const uploaderMap = new Map(uploaders.map((u) => [u.id, u]));

    return doc.revisions.map((r) => ({
      id:            r.id,
      revision:      r.revision,
      description:   r.description,
      fileSizeBytes: r.fileSizeBytes,
      mimeType:      r.mimeType,
      approvalStatus: r.approvalStatus,
      uploadedAt:    r.uploadedAt,
      uploadedBy:    r.uploadedByUserId ? (uploaderMap.get(r.uploadedByUserId) ?? null) : null,
    }));
  }

  // ── Upload a document ────────────────────────────────────────────────────

  async upload(dto: UploadDocumentDto, user: UserContext): Promise<DocumentListItem> {
    const estimatedSize = Math.floor(dto.fileBase64.length * 0.75);
    if (estimatedSize > 20 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 15 MB)');
    }

    const buffer      = Buffer.from(dto.fileBase64, 'base64');
    const ext         = path.extname(dto.fileName) || '';
    const baseName    = path.basename(dto.fileName, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFileName = `${Date.now()}-${baseName}${ext}`;
    const categorySlug = dto.docType.toLowerCase().replace(/\s+/g, '-');

    let relDir: string;
    let docCode: string;
    let createData: any;

    if (dto.projectId) {
      // ── Project-linked document ──────────────────────────────────────────
      const project = await this.prisma.project.findUnique({
        where:  { id: dto.projectId },
        select: { projectCode: true },
      });
      if (!project) throw new NotFoundException(`Project ${dto.projectId} not found`);

      relDir = path.join('projects', dto.projectId, categorySlug);
      const count = await this.prisma.document.count({ where: { projectId: dto.projectId } });
      docCode = `${project.projectCode}-DOC-${String(count + 1).padStart(3, '0')}`;
      createData = { projectId: dto.projectId, module: 'project' };

    } else {
      // ── Opportunity-linked document ──────────────────────────────────────
      relDir = path.join('opportunities', dto.opportunityId!, categorySlug);
      const count = await this.prisma.document.count({ where: { opportunityId: dto.opportunityId } });
      const suffix = String(count + 1).padStart(3, '0');
      docCode = `OPP-${dto.opportunityId!.slice(-6).toUpperCase()}-${suffix}`;
      createData = { opportunityId: dto.opportunityId, module: 'opportunity' };
    }

    // Write file to disk
    const absDir  = path.join(this.uploadsDir, relDir);
    await fs.mkdir(absDir, { recursive: true });
    const absPath = path.join(absDir, safeFileName);
    await fs.writeFile(absPath, buffer);

    const relPath = path.posix.join(
      ...relDir.split(path.sep),
      safeFileName,
    );

    const doc = await this.prisma.document.create({
      data: {
        docCode,
        title:           dto.title,
        docType:         dto.docType,
        currentRevision: 'A',
        notes:           dto.notes ?? null,
        ownerUserId:     user.id,
        ...createData,
        revisions: {
          create: {
            revision:         'A',
            fileUrl:          relPath,
            fileSizeBytes:    buffer.length,
            mimeType:         dto.mimeType,
            uploadedByUserId: user.id,
            approvalStatus:   'PENDING',
          },
        },
      },
      select: this.DOC_SELECT,
    });

    return this.mapToListItem(doc);
  }

  // ── Get file info for download ───────────────────────────────────────────

  async getFileInfo(
    id: string,
    _user: UserContext,
  ): Promise<{ absPath: string; fileName: string; mimeType: string }> {
    const doc = await this.prisma.document.findUnique({
      where:   { id },
      include: { revisions: { orderBy: { uploadedAt: 'desc' }, take: 1 } },
    });

    if (!doc || !doc.revisions[0]) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const rev     = doc.revisions[0];
    const absPath = path.join(this.uploadsDir, rev.fileUrl);

    if (!fsSync.existsSync(absPath)) {
      throw new NotFoundException('File not found on disk');
    }

    const safeTitle = doc.title.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileExt   = path.extname(rev.fileUrl);

    return {
      absPath,
      fileName: `${safeTitle}_Rev${doc.currentRevision ?? 'A'}${fileExt}`,
      mimeType: rev.mimeType ?? 'application/octet-stream',
    };
  }

  // ── Delete a document ────────────────────────────────────────────────────

  async delete(id: string, _user: UserContext): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where:   { id },
      include: { revisions: true },
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    for (const rev of doc.revisions) {
      try { await fs.unlink(path.join(this.uploadsDir, rev.fileUrl)); } catch { /* ignore */ }
    }

    await this.prisma.documentRevision.deleteMany({ where: { documentId: id } });
    await this.prisma.document.delete({ where: { id } });
  }

  // ── Create opportunity folder structure (called from OpportunitiesService) ─

  async createOpportunityFolders(opportunityId: string): Promise<void> {
    const slugs   = DOC_CATEGORIES.map((c) => c.toLowerCase().replace(/\s+/g, '-'));
    const baseDir = path.join(this.uploadsDir, 'opportunities', opportunityId);
    for (const slug of slugs) {
      await fs.mkdir(path.join(baseDir, slug), { recursive: true });
    }
  }
}
