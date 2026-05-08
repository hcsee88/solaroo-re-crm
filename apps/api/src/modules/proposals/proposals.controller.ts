import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { UserContext, PaginatedResult } from '@solaroo/types';
import {
  ProposalsService,
  ProposalListItem,
  ProposalDetail,
} from './proposals.service';
import {
  CreateProposalSchema,
  CreateVersionSchema,
  UpdateVersionSchema,
  RecordDecisionSchema,
  ProposalQuerySchema,
} from './proposals.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  // ─── List ─────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('proposal', 'view')
  findAll(
    @Query(new ZodValidationPipe(ProposalQuerySchema)) query: ReturnType<typeof ProposalQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<ProposalListItem>> {
    return this.proposalsService.findAll(query, user);
  }

  // ─── Detail ───────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission('proposal', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<ProposalDetail> {
    return this.proposalsService.findById(id, user);
  }

  // ─── Create proposal + first version ─────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('proposal', 'create')
  create(
    @Body(new ZodValidationPipe(CreateProposalSchema)) dto: ReturnType<typeof CreateProposalSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<ProposalDetail> {
    return this.proposalsService.create(dto, user);
  }

  // ─── Delete the whole proposal ────────────────────────────────────────────
  // Refused at service level if any version is APPROVED.

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('proposal', 'delete')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<{ ok: true }> {
    return this.proposalsService.delete(id, user);
  }

  // ─── Add a new version (cloned / new draft) ───────────────────────────────

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('proposal', 'create')
  createVersion(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateVersionSchema)) dto: ReturnType<typeof CreateVersionSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<ProposalDetail> {
    return this.proposalsService.createVersion(id, dto, user);
  }

  // ─── Update a draft version ───────────────────────────────────────────────

  @Patch(':id/versions/:vno')
  @RequirePermission('proposal', 'edit')
  updateVersion(
    @Param('id') id: string,
    @Param('vno', ParseIntPipe) vno: number,
    @Body(new ZodValidationPipe(UpdateVersionSchema)) dto: ReturnType<typeof UpdateVersionSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<ProposalDetail> {
    return this.proposalsService.updateVersion(id, vno, dto, user);
  }

  // ─── Submit a draft for approval ─────────────────────────────────────────

  @Patch(':id/versions/:vno/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('proposal', 'edit')
  submitForApproval(
    @Param('id') id: string,
    @Param('vno', ParseIntPipe) vno: number,
    @CurrentUser() user: UserContext,
  ): Promise<ProposalDetail> {
    return this.proposalsService.submitForApproval(id, vno, user);
  }

  // ─── Record an approval decision ──────────────────────────────────────────

  @Post(':id/versions/:vno/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('proposal', 'approve')
  recordDecision(
    @Param('id') id: string,
    @Param('vno', ParseIntPipe) vno: number,
    @Body(new ZodValidationPipe(RecordDecisionSchema)) dto: ReturnType<typeof RecordDecisionSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<ProposalDetail> {
    return this.proposalsService.recordDecision(id, vno, dto, user);
  }
}
