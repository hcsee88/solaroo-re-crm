"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { get } from "@/lib/api-client";
import type { PaginatedResult } from "@solaroo/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type PoStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "IN_PRODUCTION"
  | "DISPATCHED"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

type PoListItem = {
  id: string;
  poNo: string;
  status: PoStatus;
  totalAmount: string | null;
  currency: string;
  issuedDate: string | null;
  expectedDate: string | null;
  createdAt: string;
  vendor: { id: string; name: string; vendorCode: string };
  project: { id: string; name: string; projectCode: string } | null;
  _count: { lineItems: number; deliveries: number };
};

type VendorListItem = {
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
  createdAt: string;
  _count: { purchaseOrders: number; products: number };
};

type ProductListItem = {
  id: string;
  productCode: string;
  name: string;
  category: string;
  manufacturer: string | null;
  model: string | null;
  unitOfMeasure: string;
  isActive: boolean;
  vendor: { id: string; name: string; vendorCode: string } | null;
};

type Tab = "purchase-orders" | "vendors" | "products";

// ─── Constants ────────────────────────────────────────────────────────────────

const PO_STATUS_LABELS: Record<PoStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  IN_PRODUCTION: "In Production",
  DISPATCHED: "Dispatched",
  PARTIALLY_DELIVERED: "Partial Delivery",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const PO_STATUS_COLOURS: Record<PoStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ACKNOWLEDGED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  IN_PRODUCTION: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  DISPATCHED: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  PARTIALLY_DELIVERED: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DELIVERED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  CLOSED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const PAGE_SIZE = 25;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMYR(val: string | null): string {
  if (!val) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `RM ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `RM ${(n / 1_000).toFixed(1)}K`;
  return `RM ${n.toFixed(2)}`;
}

function formatDate(val: string | null): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="text-xs text-yellow-500">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function PoStatusBadge({ status }: { status: PoStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PO_STATUS_COLOURS[status]}`}>
      {PO_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ─── Purchase Orders tab ──────────────────────────────────────────────────────

function PurchaseOrdersTab() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [pos, setPos] = useState<PaginatedResult<PoListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("poSearch") ?? "");
  const [statusFilter, setStatusFilter] = useState<PoStatus | "">(
    (searchParams.get("poStatus") as PoStatus) ?? ""
  );
  const page = parseInt(searchParams.get("poPage") ?? "1", 10);

  const fetchPos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const data = await get<PaginatedResult<PoListItem>>(`/procurement/purchase-orders?${params}`);
      setPos(data);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchPos(); }, [fetchPos]);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => v ? params.set(k, v) : params.delete(k));
    params.delete("poPage");
    router.push(`?${params}`, { scroll: false });
  }

  const colCount = 7;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search PO number, vendor, project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && updateParams({ poSearch: search })}
          className="h-9 rounded-md border bg-background px-3 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as PoStatus | ""); updateParams({ poStatus: e.target.value }); }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {(Object.keys(PO_STATUS_LABELS) as PoStatus[]).map((s) => (
            <option key={s} value={s}>{PO_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button
          onClick={() => { setSearch(""); setStatusFilter(""); updateParams({ poSearch: "", poStatus: "" }); }}
          className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground border rounded-md"
        >
          Clear
        </button>
        <div className="ml-auto">
          <button className="h-9 px-4 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            + New PO
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">PO Number</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Project</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issued</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expected</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
              : pos?.items.length === 0
              ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No purchase orders found
                  </td>
                </tr>
              )
              : pos?.items.map((po) => (
                <tr key={po.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{po.poNo}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{po.vendor.name}</p>
                    <p className="text-xs text-muted-foreground">{po.vendor.vendorCode}</p>
                  </td>
                  <td className="px-4 py-3">
                    {po.project
                      ? <><p className="text-xs font-medium">{po.project.projectCode}</p><p className="text-xs text-muted-foreground truncate max-w-[160px]">{po.project.name}</p></>
                      : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3"><PoStatusBadge status={po.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMYR(po.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(po.issuedDate)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(po.expectedDate)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pos && pos.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{pos.total} purchase orders</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => updateParams({ poPage: String(page - 1) })}
              className="px-3 py-1 rounded border disabled:opacity-40"
            >Previous</button>
            <span className="px-3 py-1">Page {page} of {pos.totalPages}</span>
            <button
              disabled={page >= pos.totalPages}
              onClick={() => updateParams({ poPage: String(page + 1) })}
              className="px-3 py-1 rounded border disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vendors tab ──────────────────────────────────────────────────────────────

function VendorsTab() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [vendors, setVendors] = useState<PaginatedResult<VendorListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("venSearch") ?? "");
  const [approvedFilter, setApprovedFilter] = useState(searchParams.get("venApproved") ?? "");
  const page = parseInt(searchParams.get("venPage") ?? "1", 10);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (approvedFilter) params.set("isApproved", approvedFilter);
      const data = await get<PaginatedResult<VendorListItem>>(`/procurement/vendors?${params}`);
      setVendors(data);
    } finally {
      setLoading(false);
    }
  }, [page, search, approvedFilter]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => v ? params.set(k, v) : params.delete(k));
    params.delete("venPage");
    router.push(`?${params}`, { scroll: false });
  }

  const colCount = 7;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search vendor name, code, region…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && updateParams({ venSearch: search })}
          className="h-9 rounded-md border bg-background px-3 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={approvedFilter}
          onChange={(e) => { setApprovedFilter(e.target.value); updateParams({ venApproved: e.target.value }); }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All vendors</option>
          <option value="true">Approved only</option>
          <option value="false">Not yet approved</option>
        </select>
        <button
          onClick={() => { setSearch(""); setApprovedFilter(""); updateParams({ venSearch: "", venApproved: "" }); }}
          className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground border rounded-md"
        >
          Clear
        </button>
        <div className="ml-auto">
          <button className="h-9 px-4 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            + New Vendor
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Country / Region</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rating</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Lead Time</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment Terms</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">POs</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
              : vendors?.items.length === 0
              ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No vendors found
                  </td>
                </tr>
              )
              : vendors?.items.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{v.vendorCode}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {[v.country, v.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3"><StarRating rating={v.rating} /></td>
                  <td className="px-4 py-3">
                    {v.isApproved
                      ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Approved</span>
                      : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Pending</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {v.leadTimeDays != null ? `${v.leadTimeDays} days` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{v.paymentTerms ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm">{v._count.purchaseOrders}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {vendors && vendors.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{vendors.total} vendors</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => updateParams({ venPage: String(page - 1) })} className="px-3 py-1 rounded border disabled:opacity-40">Previous</button>
            <span className="px-3 py-1">Page {page} of {vendors.totalPages}</span>
            <button disabled={page >= vendors.totalPages} onClick={() => updateParams({ venPage: String(page + 1) })} className="px-3 py-1 rounded border disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Products tab ─────────────────────────────────────────────────────────────

function ProductsTab() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [products, setProducts] = useState<PaginatedResult<ProductListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("prdSearch") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("prdCategory") ?? "");
  const page = parseInt(searchParams.get("prdPage") ?? "1", 10);

  const CATEGORIES = ["Solar Panel", "Battery", "Inverter", "BMS", "Cabling", "Switchgear", "Structure", "Other"];

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      const data = await get<PaginatedResult<ProductListItem>>(`/procurement/products?${params}`);
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => v ? params.set(k, v) : params.delete(k));
    params.delete("prdPage");
    router.push(`?${params}`, { scroll: false });
  }

  const colCount = 6;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search product name, code, manufacturer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && updateParams({ prdSearch: search })}
          className="h-9 rounded-md border bg-background px-3 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); updateParams({ prdCategory: e.target.value }); }}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => { setSearch(""); setCategoryFilter(""); updateParams({ prdSearch: "", prdCategory: "" }); }}
          className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground border rounded-md"
        >
          Clear
        </button>
        <div className="ml-auto">
          <button className="h-9 px-4 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            + New Product
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Code</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Manufacturer / Model</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={colCount} />)
              : products?.items.length === 0
              ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No products found
                  </td>
                </tr>
              )
              : products?.items.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs">{p.productCode}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {[p.manufacturer, p.model].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{p.unitOfMeasure}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {p.vendor ? p.vendor.name : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {products && products.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{products.total} products</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => updateParams({ prdPage: String(page - 1) })} className="px-3 py-1 rounded border disabled:opacity-40">Previous</button>
            <span className="px-3 py-1">Page {page} of {products.totalPages}</span>
            <button disabled={page >= products.totalPages} onClick={() => updateParams({ prdPage: String(page + 1) })} className="px-3 py-1 rounded border disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as Tab) ?? "purchase-orders";

  function setTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params}`, { scroll: false });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "purchase-orders", label: "Purchase Orders" },
    { id: "vendors", label: "Vendors" },
    { id: "products", label: "Products" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Procurement</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage vendors, purchase orders, and equipment catalog
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "purchase-orders" && <PurchaseOrdersTab />}
      {activeTab === "vendors" && <VendorsTab />}
      {activeTab === "products" && <ProductsTab />}
    </div>
  );
}
