import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import { Prisma } from '@solaroo/db';
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorQueryDto,
  CreateProductDto,
  ProductQueryDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  UpdatePoStatusDto,
  PurchaseOrderQueryDto,
  CreateDeliveryDto,
  DeliveryQueryDto,
} from './procurement.dto';

// ─── Response types ───────────────────────────────────────────────────────────

export type VendorListItem = {
  id: string;
  vendorCode: string;
  name: string;
  country: string | null;
  region: string | null;
  rating: number | null;
  isApproved: boolean;
  isActive: boolean;
  leadTimeDays: number | null;
  paymentTerms: string | null;
  createdAt: Date;
  _count: { purchaseOrders: number; products: number };
};

export type VendorDetail = VendorListItem & {
  registrationNo: string | null;
  website: string | null;
  notes: string | null;
  updatedAt: Date;
  contacts: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
  }[];
};

export type ProductListItem = {
  id: string;
  productCode: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  unitOfMeasure: string;
  isActive: boolean;
  createdAt: Date;
  vendor: { id: string; name: string; vendorCode: string } | null;
};

export type PoListItem = {
  id: string;
  poNo: string;
  status: string;
  totalAmount: string | null;
  currency: string;
  issuedDate: Date | null;
  expectedDate: Date | null;
  createdAt: Date;
  vendor: { id: string; name: string; vendorCode: string };
  project: { id: string; name: string; projectCode: string } | null;
  _count: { lineItems: number; deliveries: number };
};

export type PoDetail = PoListItem & {
  paymentTerms: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  updatedAt: Date;
  lineItems: {
    id: string;
    description: string;
    quantity: string;
    unit: string | null;
    unitPrice: string | null;
    totalPrice: string | null;
    product: { id: string; name: string; productCode: string } | null;
  }[];
  deliveries: {
    id: string;
    deliveryNoteNo: string | null;
    receivedDate: Date | null;
    deliveredDate: Date | null;
    notes: string | null;
    createdAt: Date;
  }[];
};

export type DeliveryDetail = {
  id: string;
  poId: string;
  deliveryNoteNo: string | null;
  receivedDate: Date | null;
  deliveredDate: Date | null;
  notes: string | null;
  createdAt: Date;
  po: { poNo: string; vendor: { name: string } };
};

// ─── Vendor select ────────────────────────────────────────────────────────────

const VENDOR_LIST_SELECT = {
  id: true,
  vendorCode: true,
  name: true,
  country: true,
  region: true,
  rating: true,
  isApproved: true,
  isActive: true,
  leadTimeDays: true,
  paymentTerms: true,
  createdAt: true,
  _count: { select: { purchaseOrders: true, products: true } },
} satisfies Prisma.VendorSelect;

const VENDOR_DETAIL_SELECT = {
  ...VENDOR_LIST_SELECT,
  registrationNo: true,
  website: true,
  notes: true,
  updatedAt: true,
  contacts: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      jobTitle: true,
    },
  },
} satisfies Prisma.VendorSelect;

// ─── PO select ────────────────────────────────────────────────────────────────

const PO_LIST_SELECT = {
  id: true,
  poNo: true,
  status: true,
  totalAmount: true,
  currency: true,
  issuedDate: true,
  expectedDate: true,
  createdAt: true,
  vendor: { select: { id: true, name: true, vendorCode: true } },
  project: { select: { id: true, name: true, projectCode: true } },
  _count: { select: { lineItems: true, deliveries: true } },
} satisfies Prisma.PurchaseOrderSelect;

const PO_DETAIL_SELECT = {
  ...PO_LIST_SELECT,
  paymentTerms: true,
  deliveryAddress: true,
  notes: true,
  updatedAt: true,
  lineItems: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      totalPrice: true,
      product: { select: { id: true, name: true, productCode: true } },
    },
  },
  deliveries: {
    select: {
      id: true,
      deliveryNoteNo: true,
      receivedDate: true,
      deliveredDate: true,
      notes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.PurchaseOrderSelect;

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // VENDORS
  // ═══════════════════════════════════════════════════════════════════════════

  async findAllVendors(
    query: VendorQueryDto,
    _user: UserContext,
  ): Promise<PaginatedResult<VendorListItem>> {
    const { search, isApproved, isActive, page, pageSize, sortBy, sortDir } = query;

    const where: Prisma.VendorWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { vendorCode: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(isApproved !== undefined && { isApproved }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, items] = await Promise.all([
      this.prisma.vendor.count({ where }),
      this.prisma.vendor.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: VENDOR_LIST_SELECT,
      }),
    ]);

    return {
      items: items as unknown as VendorListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findVendorById(id: string, _user: UserContext): Promise<VendorDetail> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      select: VENDOR_DETAIL_SELECT,
    });
    if (!vendor) throw new NotFoundException(`Vendor ${id} not found`);
    return vendor as unknown as VendorDetail;
  }

  async createVendor(
    dto: CreateVendorDto,
    _user: UserContext,
  ): Promise<VendorDetail> {
    const vendorCode = await this.generateVendorCode();
    const vendor = await this.prisma.vendor.create({
      data: {
        ...dto,
        vendorCode,
        website: dto.website || null,
      },
      select: VENDOR_DETAIL_SELECT,
    });
    return vendor as unknown as VendorDetail;
  }

  async updateVendor(
    id: string,
    dto: UpdateVendorDto,
    user: UserContext,
  ): Promise<VendorDetail> {
    await this.findVendorById(id, user);
    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: {
        ...dto,
        website: dto.website === '' ? null : dto.website,
      },
      select: VENDOR_DETAIL_SELECT,
    });
    return vendor as unknown as VendorDetail;
  }

  private async generateVendorCode(): Promise<string> {
    const latest = await this.prisma.vendor.findFirst({
      where: { vendorCode: { startsWith: 'VEN-' } },
      orderBy: { vendorCode: 'desc' },
      select: { vendorCode: true },
    });
    let nextNum = 1;
    if (latest) {
      const match = latest.vendorCode.match(/VEN-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const code = `VEN-${String(nextNum).padStart(4, '0')}`;
    const existing = await this.prisma.vendor.findUnique({ where: { vendorCode: code } });
    if (existing) throw new BadRequestException('Vendor code collision — please retry');
    return code;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════════════════════════════════════

  async findAllProducts(
    query: ProductQueryDto,
    _user: UserContext,
  ): Promise<PaginatedResult<ProductListItem>> {
    const { search, category, vendorId, page, pageSize, sortBy, sortDir } = query;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { productCode: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(category && { category }),
      ...(vendorId && { vendorId }),
    };

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          productCode: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          unitOfMeasure: true,
          isActive: true,
          createdAt: true,
          vendor: { select: { id: true, name: true, vendorCode: true } },
        },
      }),
    ]);

    return {
      items: items as unknown as ProductListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createProduct(
    dto: CreateProductDto,
    _user: UserContext,
  ): Promise<ProductListItem> {
    const productCode = await this.generateProductCode();
    const product = await this.prisma.product.create({
      data: { ...dto, productCode },
      select: {
        id: true,
        productCode: true,
        name: true,
        category: true,
        manufacturer: true,
        model: true,
        unitOfMeasure: true,
        isActive: true,
        createdAt: true,
        vendor: { select: { id: true, name: true, vendorCode: true } },
      },
    });
    return product as unknown as ProductListItem;
  }

  private async generateProductCode(): Promise<string> {
    const latest = await this.prisma.product.findFirst({
      where: { productCode: { startsWith: 'PRD-' } },
      orderBy: { productCode: 'desc' },
      select: { productCode: true },
    });
    let nextNum = 1;
    if (latest) {
      const match = latest.productCode.match(/PRD-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const code = `PRD-${String(nextNum).padStart(4, '0')}`;
    const existing = await this.prisma.product.findUnique({ where: { productCode: code } });
    if (existing) throw new BadRequestException('Product code collision — please retry');
    return code;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PURCHASE ORDERS
  // ═══════════════════════════════════════════════════════════════════════════

  async findAllPurchaseOrders(
    query: PurchaseOrderQueryDto,
    _user: UserContext,
  ): Promise<PaginatedResult<PoListItem>> {
    const { search, projectId, vendorId, status, page, pageSize, sortBy, sortDir } = query;

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(search && {
        OR: [
          { poNo: { contains: search, mode: 'insensitive' } },
          { vendor: { name: { contains: search, mode: 'insensitive' } } },
          { project: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(projectId && { projectId }),
      ...(vendorId && { vendorId }),
      ...(status && { status }),
    };

    const [total, items] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: PO_LIST_SELECT,
      }),
    ]);

    return {
      items: items as unknown as PoListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findPurchaseOrderById(id: string, _user: UserContext): Promise<PoDetail> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: PO_DETAIL_SELECT,
    });
    if (!po) throw new NotFoundException(`Purchase order ${id} not found`);
    return po as unknown as PoDetail;
  }

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    _user: UserContext,
  ): Promise<PoDetail> {
    // Validate vendor exists
    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException(`Vendor ${dto.vendorId} not found`);

    const poNo = await this.generatePoNumber();

    const po = await this.prisma.purchaseOrder.create({
      data: {
        poNo,
        vendorId: dto.vendorId,
        projectId: dto.projectId || null,
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        totalAmount: dto.totalAmount ?? null,
        currency: dto.currency ?? 'MYR',
        paymentTerms: dto.paymentTerms || null,
        deliveryAddress: dto.deliveryAddress || null,
        notes: dto.notes || null,
        lineItems: {
          create: dto.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || null,
            unitPrice: item.unitPrice ?? null,
            totalPrice: item.totalPrice ?? null,
            productId: item.productId || null,
          })),
        },
      },
      select: PO_DETAIL_SELECT,
    });

    return po as unknown as PoDetail;
  }

  async updatePurchaseOrder(
    id: string,
    dto: UpdatePurchaseOrderDto,
    user: UserContext,
  ): Promise<PoDetail> {
    await this.findPurchaseOrderById(id, user);
    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(dto.projectId !== undefined && { projectId: dto.projectId || null }),
        ...(dto.issuedDate !== undefined && { issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null }),
        ...(dto.expectedDate !== undefined && { expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms || null }),
        ...(dto.deliveryAddress !== undefined && { deliveryAddress: dto.deliveryAddress || null }),
        ...(dto.notes !== undefined && { notes: dto.notes || null }),
      },
      select: PO_DETAIL_SELECT,
    });
    return po as unknown as PoDetail;
  }

  async updatePurchaseOrderStatus(
    id: string,
    dto: UpdatePoStatusDto,
    user: UserContext,
  ): Promise<PoDetail> {
    await this.findPurchaseOrderById(id, user);
    const po = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: PO_DETAIL_SELECT,
    });
    return po as unknown as PoDetail;
  }

  private async generatePoNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `PO${year}-`;
    const latest = await this.prisma.purchaseOrder.findFirst({
      where: { poNo: { startsWith: prefix } },
      orderBy: { poNo: 'desc' },
      select: { poNo: true },
    });
    let nextNum = 1;
    if (latest) {
      const match = latest.poNo.match(/PO\d{2}-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DELIVERIES
  // ═══════════════════════════════════════════════════════════════════════════

  async findDeliveries(
    query: DeliveryQueryDto,
    _user: UserContext,
  ): Promise<PaginatedResult<DeliveryDetail>> {
    const { poId, page, pageSize } = query;

    const where: Prisma.DeliveryWhereInput = {
      ...(poId && { poId }),
    };

    const [total, items] = await Promise.all([
      this.prisma.delivery.count({ where }),
      this.prisma.delivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          poId: true,
          deliveryNoteNo: true,
          receivedDate: true,
          deliveredDate: true,
          notes: true,
          createdAt: true,
          po: {
            select: {
              poNo: true,
              vendor: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      items: items as unknown as DeliveryDetail[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createDelivery(
    dto: CreateDeliveryDto,
    _user: UserContext,
  ): Promise<DeliveryDetail> {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: dto.poId } });
    if (!po) throw new NotFoundException(`Purchase order ${dto.poId} not found`);

    const delivery = await this.prisma.delivery.create({
      data: {
        poId: dto.poId,
        deliveryNoteNo: dto.deliveryNoteNo || null,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : null,
        deliveredDate: dto.deliveredDate ? new Date(dto.deliveredDate) : null,
        notes: dto.notes || null,
      },
      select: {
        id: true,
        poId: true,
        deliveryNoteNo: true,
        receivedDate: true,
        deliveredDate: true,
        notes: true,
        createdAt: true,
        po: {
          select: {
            poNo: true,
            vendor: { select: { name: true } },
          },
        },
      },
    });

    return delivery as unknown as DeliveryDetail;
  }
}
