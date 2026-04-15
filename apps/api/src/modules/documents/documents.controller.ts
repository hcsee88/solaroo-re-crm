import {
  Controller,
  Get,
  Post,
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
import { DocumentsService, DocumentItem } from './documents.service';
import {
  UploadDocumentSchema,
  DocumentQuerySchema,
  UploadDocumentDto,
  DocumentQueryDto,
} from './documents.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ── List documents ────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('document', 'view')
  async findAll(
    @Query(new ZodValidationPipe(DocumentQuerySchema)) query: DocumentQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<DocumentItem[]> {
    if (query.opportunityId) {
      return this.documentsService.findForOpportunity(query.opportunityId);
    }
    return this.documentsService.findAll(user);
  }

  // ── Get single document ───────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission('document', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<DocumentItem | null> {
    return this.documentsService.findById(id, user);
  }

  // ── Upload a document (base64 JSON body) ──────────────────────────────────

  @Post('upload')
  @RequirePermission('document', 'create')
  @HttpCode(HttpStatus.CREATED)
  upload(
    @Body(new ZodValidationPipe(UploadDocumentSchema)) dto: UploadDocumentDto,
    @CurrentUser() user: UserContext,
  ): Promise<DocumentItem> {
    return this.documentsService.upload(dto, user);
  }

  // ── Download a document ───────────────────────────────────────────────────

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
