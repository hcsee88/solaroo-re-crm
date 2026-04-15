import { z } from 'zod';
import { PurchaseOrderStatus } from '@solaroo/db';

// ─── Vendor ───────────────────────────────────────────────────────────────────

export const CreateVendorSchema = z.object({
  name: z.string().min(1).max(255),
  registrationNo: z.string().max(50).optional(),
  country: z.string().max(100).default('Malaysia'),
  region: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  paymentTerms: z.string().max(100).optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(999).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  isApproved: z.boolean().default(false),
  notes: z.string().optional(),
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

export const VendorQuerySchema = z.object({
  search: z.string().optional(),
  isApproved: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['name', 'vendorCode', 'createdAt', 'rating']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateVendorDto = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorDto = z.infer<typeof UpdateVendorSchema>;
export type VendorQueryDto = z.infer<typeof VendorQuerySchema>;

// ─── Product ──────────────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  vendorId: z.string().optional(),
  manufacturer: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  specifications: z.string().optional(),
  unitOfMeasure: z.string().max(50).default('unit'),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const ProductQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  vendorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  sortBy: z.enum(['name', 'productCode', 'category', 'createdAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type ProductQueryDto = z.infer<typeof ProductQuerySchema>;

// ─── Purchase Order ───────────────────────────────────────────────────────────

export const PoLineItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().max(50).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  totalPrice: z.coerce.number().min(0).optional(),
});

export const CreatePurchaseOrderSchema = z.object({
  projectId: z.string().optional(),
  vendorId: z.string().min(1),
  issuedDate: z.string().datetime().optional().or(z.literal('')).transform((v) => v || undefined),
  expectedDate: z.string().datetime().optional().or(z.literal('')).transform((v) => v || undefined),
  totalAmount: z.coerce.number().min(0).optional(),
  currency: z.string().max(10).default('MYR'),
  paymentTerms: z.string().max(100).optional(),
  deliveryAddress: z.string().optional(),
  notes: z.string().optional(),
  lineItems: z.array(PoLineItemSchema).default([]),
});

export const UpdatePurchaseOrderSchema = CreatePurchaseOrderSchema
  .omit({ lineItems: true, vendorId: true })
  .partial();

export const UpdatePoStatusSchema = z.object({
  status: z.nativeEnum(PurchaseOrderStatus),
  notes: z.string().optional(),
});

export const PurchaseOrderQuerySchema = z.object({
  search: z.string().optional(),
  projectId: z.string().optional(),
  vendorId: z.string().optional(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['poNo', 'createdAt', 'issuedDate', 'expectedDate', 'totalAmount']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type PoLineItemDto = z.infer<typeof PoLineItemSchema>;
export type CreatePurchaseOrderDto = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderDto = z.infer<typeof UpdatePurchaseOrderSchema>;
export type UpdatePoStatusDto = z.infer<typeof UpdatePoStatusSchema>;
export type PurchaseOrderQueryDto = z.infer<typeof PurchaseOrderQuerySchema>;

// ─── Delivery ─────────────────────────────────────────────────────────────────

export const CreateDeliverySchema = z.object({
  poId: z.string().min(1),
  deliveryNoteNo: z.string().max(100).optional(),
  receivedDate: z.string().datetime().optional().or(z.literal('')).transform((v) => v || undefined),
  deliveredDate: z.string().datetime().optional().or(z.literal('')).transform((v) => v || undefined),
  notes: z.string().optional(),
});

export const DeliveryQuerySchema = z.object({
  poId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
});

export type CreateDeliveryDto = z.infer<typeof CreateDeliverySchema>;
export type DeliveryQueryDto = z.infer<typeof DeliveryQuerySchema>;
