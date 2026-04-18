import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UserContext } from '@solaroo/types';
import { ContractsService, ContractDetail, ContractListItem } from './contracts.service';
import {
  ContractQuerySchema,
  ContractQueryDto,
  CreateContractSchema,
  CreateContractDto,
  UpdateContractSchema,
  UpdateContractDto,
  TransitionStatusSchema,
  TransitionStatusDto,
  StartHandoverSchema,
  StartHandoverDto,
  UpdateChecklistItemSchema,
  UpdateChecklistItemDto,
  CompleteHandoverSchema,
  CompleteHandoverDto,
} from './contracts.dto';
import {
  CreateContractMilestoneSchema,
  CreateContractMilestoneDto,
  UpdateContractMilestoneSchema,
  UpdateContractMilestoneDto,
  CreateInvoiceSchema,
  CreateInvoiceDto,
  UpdateInvoiceStatusSchema,
  UpdateInvoiceStatusDto,
} from './contract-children.dto';
import type { PaginatedResult } from '@solaroo/types';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // GET /api/contracts
  @Get()
  @RequirePermission('contract', 'view')
  findAll(
    @Query(new ZodValidationPipe(ContractQuerySchema)) query: ContractQueryDto,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<ContractListItem>> {
    return this.contractsService.findAll(query, user);
  }

  // GET /api/contracts/:id
  @Get(':id')
  @RequirePermission('contract', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.findById(id, user);
  }

  // POST /api/contracts
  @Post()
  @RequirePermission('contract', 'create')
  create(
    @Body(new ZodValidationPipe(CreateContractSchema)) dto: CreateContractDto,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.create(dto, user);
  }

  // PATCH /api/contracts/:id
  @Patch(':id')
  @RequirePermission('contract', 'edit')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateContractSchema)) dto: UpdateContractDto,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.update(id, dto, user);
  }

  // PATCH /api/contracts/:id/status — overall contract lifecycle
  @Patch(':id/status')
  @RequirePermission('contract', 'edit')
  transitionStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TransitionStatusSchema)) dto: TransitionStatusDto,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.transitionStatus(id, dto, user);
  }

  // POST /api/contracts/:id/handover/ready — NOT_STARTED → READY
  @Post(':id/handover/ready')
  @RequirePermission('contract', 'handover')
  markHandoverReady(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(StartHandoverSchema)) dto: StartHandoverDto,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.markHandoverReady(id, dto, user);
  }

  // POST /api/contracts/:id/handover/begin — READY → IN_PROGRESS
  @Post(':id/handover/begin')
  @RequirePermission('contract', 'handover')
  beginHandover(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.beginHandover(id, user);
  }

  // PATCH /api/contracts/:id/handover/checklist — toggle a single checklist item
  @Patch(':id/handover/checklist')
  @RequirePermission('contract', 'handover')
  updateChecklistItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateChecklistItemSchema)) dto: UpdateChecklistItemDto,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.updateChecklistItem(id, dto, user);
  }

  // POST /api/contracts/:id/handover/complete — IN_PROGRESS → COMPLETED, link/create project
  @Post(':id/handover/complete')
  @RequirePermission('contract', 'handover')
  completeHandover(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CompleteHandoverSchema)) dto: CompleteHandoverDto,
    @CurrentUser() user: UserContext,
  ): Promise<ContractDetail> {
    return this.contractsService.completeHandover(id, dto, user);
  }

  // ─── Variance (contractValue vs invoiced vs paid) ────────────────────────

  @Get(':id/variance')
  @RequirePermission('contract', 'view_value')
  getVariance(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.contractsService.getVariance(id, user);
  }

  // ─── Milestones ──────────────────────────────────────────────────────────

  @Get(':id/milestones')
  @RequirePermission('invoice_milestone', 'view')
  listMilestones(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.contractsService.listMilestones(id, user);
  }

  @Post(':id/milestones')
  @RequirePermission('invoice_milestone', 'create')
  createMilestone(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateContractMilestoneSchema)) dto: CreateContractMilestoneDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.contractsService.createMilestone(id, dto, user);
  }

  @Patch(':id/milestones/:milestoneId')
  @RequirePermission('invoice_milestone', 'edit')
  updateMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @Body(new ZodValidationPipe(UpdateContractMilestoneSchema)) dto: UpdateContractMilestoneDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.contractsService.updateMilestone(id, milestoneId, dto, user);
  }

  @Delete(':id/milestones/:milestoneId')
  @RequirePermission('invoice_milestone', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMilestone(
    @Param('id') id: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    return this.contractsService.deleteMilestone(id, milestoneId, user);
  }

  // ─── Invoices ────────────────────────────────────────────────────────────

  @Get(':id/invoices')
  @RequirePermission('invoice_milestone', 'view')
  listInvoices(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.contractsService.listInvoices(id, user);
  }

  @Post(':id/invoices')
  @RequirePermission('invoice_milestone', 'create')
  createInvoice(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateInvoiceSchema)) dto: CreateInvoiceDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.contractsService.createInvoice(id, dto, user);
  }

  @Patch(':id/invoices/:invoiceId/status')
  @RequirePermission('invoice_milestone', 'edit')
  updateInvoiceStatus(
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body(new ZodValidationPipe(UpdateInvoiceStatusSchema)) dto: UpdateInvoiceStatusDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.contractsService.updateInvoiceStatus(id, invoiceId, dto, user);
  }
}
