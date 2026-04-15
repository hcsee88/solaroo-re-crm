"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  MapPin,
  TrendingUp,
  FileText,
  FolderKanban,
  ShieldCheck,
  ShoppingCart,
  Archive,
  Wrench,
  BarChart3,
  Settings,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useIsSuperAdmin, useRoleName } from "@/hooks/use-current-user";
import { getNavItemsForRole, type NavHref } from "@/lib/role-ui";

// ─── All possible nav items (definition + icons) ──────────────────────────────
// Order here is the display order within each role's filtered list.

const ALL_NAV_ITEMS: { href: NavHref; label: string; icon: React.ElementType }[] = [
  { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/accounts",      label: "Accounts",      icon: Building2 },
  { href: "/contacts",      label: "Contacts",      icon: Users },
  { href: "/sites",         label: "Sites",         icon: MapPin },
  { href: "/opportunities", label: "Opportunities", icon: TrendingUp },
  { href: "/proposals",     label: "Proposals",     icon: FileText },
  { href: "/projects",      label: "Projects",      icon: FolderKanban },
  { href: "/pmo",           label: "PMO",           icon: ShieldCheck },
  { href: "/procurement",   label: "Procurement",   icon: ShoppingCart },
  { href: "/documents",     label: "Documents",     icon: Archive },
  { href: "/om",            label: "O&M",           icon: Wrench },
  { href: "/reports",       label: "Reports",       icon: BarChart3 },
];

// Build a lookup map for fast icon/label access
const NAV_MAP = new Map(ALL_NAV_ITEMS.map((item) => [item.href, item]));

export function Sidebar() {
  const pathname     = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  const roleName     = useRoleName();
  const [logoError, setLogoError] = useState(false);

  // Get the ordered list of nav hrefs for this role, then look up the full item
  const visibleNavItems = getNavItemsForRole(roleName)
    .map((href) => NAV_MAP.get(href))
    .filter(Boolean) as typeof ALL_NAV_ITEMS;

  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col bg-white"
      style={{ borderRight: "1px solid #e6e9ef" }}
    >
      {/* Logo area */}
      <div
        className="h-[56px] flex items-center px-4 flex-shrink-0"
        style={{ borderBottom: "1px solid #e6e9ef" }}
      >
        {logoError ? (
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "#0073ea" }}
            >
              SR
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold" style={{ color: "#323338" }}>Solaroo RE</p>
              <p className="text-xs" style={{ color: "#676879" }}>CRM Platform</p>
            </div>
          </div>
        ) : (
          <Image
            src="/Solaroo RE Logo-01.jpg"
            alt="Solaroo RE"
            width={130}
            height={36}
            className="object-contain"
            style={{ width: 130, height: "auto" }}
            priority
            onError={() => setLogoError(true)}
          />
        )}
      </div>

      {/* Main navigation — role-filtered */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {visibleNavItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 mb-0.5 relative"
              )}
              style={
                isActive
                  ? { background: "#dce9fc", color: "#0073ea" }
                  : { color: "#676879" }
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "#f0f4fb";
                  (e.currentTarget as HTMLElement).style.color = "#323338";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = "";
                  (e.currentTarget as HTMLElement).style.color = "#676879";
                }
              }}
            >
              {/* Active left bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ background: "#0073ea" }}
                />
              )}
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Admin section — Super Admin only */}
      {isSuperAdmin && (
        <div className="px-2 py-2" style={{ borderTop: "1px solid #e6e9ef" }}>
          <Link
            href="/admin/users"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={
              pathname.startsWith("/admin")
                ? { background: "#dce9fc", color: "#0073ea" }
                : { color: "#676879" }
            }
            onMouseEnter={(e) => {
              if (!pathname.startsWith("/admin")) {
                (e.currentTarget as HTMLElement).style.background = "#f0f4fb";
                (e.currentTarget as HTMLElement).style.color = "#323338";
              }
            }}
            onMouseLeave={(e) => {
              if (!pathname.startsWith("/admin")) {
                (e.currentTarget as HTMLElement).style.background = "";
                (e.currentTarget as HTMLElement).style.color = "#676879";
              }
            }}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            User Management
          </Link>
        </div>
      )}
    </aside>
  );
}
