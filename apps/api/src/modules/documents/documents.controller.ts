import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { createReadStream } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { DocumentsService, DocumentListItem, DocumentRevisionDetail } from './documents.service';
import {
  UploadDocumentSchema,
  DocumentQuerySchema,
  UploadDocumentDto,
  DocumentQueryDto,
  ApproveRevisionSchema,
  ApproveRevisionDto,
  RejectRevisionSchema,
  RejectRevisionDto,
} from './documents.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── List documents (paginated, filtered) ─────────────────────────────────

  @Get()
  @RequirePermission('document', 'view')
  findAll(
    @Query(new ZodValidationPipe(DocumentQuerySchema)) query: DocumentQueryDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentsService.findAll(user, query);
  }

  // ── Get single document ───────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission('document', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<DocumentListItem | null> {
    return this.documentsService.findById(id, user);
  }

  // ── Get revision history ──────────────────────────────────────────────────

  @Get(':id/revisions')
  @RequirePermission('document', 'view')
  findRevisions(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<DocumentRevisionDetail[]> {
    return this.documentsService.findRevisions(id, user);
  }

  // ── Upload a document (base64 JSON body) ──────────────────────────────────

  @Post('upload')
  @RequirePermission('document', 'create')
  @HttpCode(HttpStatus.CREATED)
  upload(
    @Body(new ZodValidationPipe(UploadDocumentSchema)) dto: UploadDocumentDto,
    @CurrentUser() user: UserContext,
  ): Promise<DocumentListItem> {
    return this.documentsService.upload(dto, user);
  }

  // ── Download latest revision of a document ────────────────────────────────

  @Get(':id/download')
  @RequirePermission('document', 'view')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const { absPath, fileName, mimeType } = await this.documentsService.getFileInfo(id, user);
    const stream = createReadStream(absPath);
    res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.header('Content-Type', mimeType);
    res.send(stream);
  }

  // ── Approve a revision ────────────────────────────────────────────────────

  @Patch(':id/revisions/:revisionId/approve')
  @RequirePermission('document', 'approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  approveRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Body(new ZodValidationPipe(ApproveRevisionSchema)) dto: ApproveRevisionDto,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.documentsService.approveRevision(id, revisionId, dto, user);
  }

  // ── Reject a revision ─────────────────────────────────────────────────────

  @Patch(':id/revisions/:revisionId/reject')
  @RequirePermission('document', 'approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  rejectRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Body(new ZodValidationPipe(RejectRevisionSchema)) dto: RejectRevisionDto,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.documentsService.rejectRevision(id, revisionId, dto, user);
  }

  // ── Delete a document ─────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermission('document', 'delete')
  @HttpCode(HttpStatus.OK)
  delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.documentsService.delete(id, user);
  }
}
