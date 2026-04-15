import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ProcurementService } from './procurement.service';
import {
  CreateVendorSchema,
  UpdateVendorSchema,
  VendorQuerySchema,
  CreateProductSchema,
  ProductQuerySchema,
  CreatePurchaseOrderSchema,
  UpdatePurchaseOrderSchema,
  UpdatePoStatusSchema,
  PurchaseOrderQuerySchema,
  CreateDeliverySchema,
  DeliveryQuerySchema,
} from './procurement.dto';

@Controller('procurement')
@UseGuards(JwtAuthGuard)
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VENDORS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('vendors')
  @RequirePermission('vendor', 'view')
  findAllVendors(
    @Query(new ZodValidationPipe(VendorQuerySchema)) query: ReturnType<typeof VendorQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.findAllVendors(query, user);
  }

  @Get('vendors/:id')
  @RequirePermission('vendor', 'view')
  findVendorById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.findVendorById(id, user);
  }

  @Post('vendors')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vendor', 'create')
  createVendor(
    @Body(new ZodValidationPipe(CreateVendorSchema)) dto: ReturnType<typeof CreateVendorSchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.createVendor(dto, user);
  }

  @Patch('vendors/:id')
  @RequirePermission('vendor', 'edit')
  updateVendor(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateVendorSchema)) dto: ReturnType<typeof UpdateVendorSchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.updateVendor(id, dto, user);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('products')
  @RequirePermission('vendor', 'view')
  findAllProducts(
    @Query(new ZodValidationPipe(ProductQuerySchema)) query: ReturnType<typeof ProductQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.findAllProducts(query, user);
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('vendor', 'create')
  createProduct(
    @Body(new ZodValidationPipe(CreateProductSchema)) dto: ReturnType<typeof CreateProductSchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.createProduct(dto, user);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PURCHASE ORDERS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('purchase-orders')
  @RequirePermission('purchase_order', 'view')
  findAllPurchaseOrders(
    @Query(new ZodValidationPipe(PurchaseOrderQuerySchema)) query: ReturnType<typeof PurchaseOrderQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.findAllPurchaseOrders(query, user);
  }

  @Get('purchase-orders/:id')
  @RequirePermission('purchase_order', 'view')
  findPurchaseOrderById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.findPurchaseOrderById(id, user);
  }

  @Post('purchase-orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('purchase_order', 'create')
  createPurchaseOrder(
    @Body(new ZodValidationPipe(CreatePurchaseOrderSchema)) dto: ReturnType<typeof CreatePurchaseOrderSchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.createPurchaseOrder(dto, user);
  }

  @Patch('purchase-orders/:id')
  @RequirePermission('purchase_order', 'edit')
  updatePurchaseOrder(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePurchaseOrderSchema)) dto: ReturnType<typeof UpdatePurchaseOrderSchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.updatePurchaseOrder(id, dto, user);
  }

  @Patch('purchase-orders/:id/status')
  @RequirePermission('purchase_order', 'edit')
  updatePurchaseOrderStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdatePoStatusSchema)) dto: ReturnType<typeof UpdatePoStatusSchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.updatePurchaseOrderStatus(id, dto, user);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELIVERIES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('deliveries')
  @RequirePermission('delivery', 'view')
  findDeliveries(
    @Query(new ZodValidationPipe(DeliveryQuerySchema)) query: ReturnType<typeof DeliveryQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.findDeliveries(query, user);
  }

  @Post('deliveries')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('delivery', 'create')
  createDelivery(
    @Body(new ZodValidationPipe(CreateDeliverySchema)) dto: ReturnType<typeof CreateDeliverySchema.parse>,
    @CurrentUser() user: UserContext,
  ) {
    return this.procurementService.createDelivery(dto, user);
  }
}
