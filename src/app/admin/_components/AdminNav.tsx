"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  ["/admin", "Tổng quan"],
  ["/admin/orders", "Đơn hàng"],
  ["/admin/products", "Sản phẩm"],
  ["/admin/phan-loai-bo-loc", "Phân loại & Bộ lọc"],
  ["/admin/customers", "Khách hàng"],
  ["/admin/deliveries", "Giao hàng"],
  ["/admin/inventory/history", "Lịch sử kho"],
  ["/admin/settings", "Cài đặt"],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/inventory/history") return pathname === "/admin/inventory/history" || pathname === "/admin/lich-su-kho";
  if (href === "/admin/products") return pathname === "/admin/products" || pathname === "/admin/san-pham" || pathname === "/admin/anh";
  if (href === "/admin/phan-loai-bo-loc") return pathname === "/admin/phan-loai-bo-loc" || pathname.startsWith("/admin/danh-muc") || pathname.startsWith("/admin/tone-mau") || pathname.startsWith("/admin/dip-tang");
  if (href === "/admin/deliveries") return pathname === "/admin/deliveries" || pathname === "/admin/giao-hang";
  if (href === "/admin/settings") return pathname === "/admin/settings" || pathname === "/admin/cai-dat";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isWarehouseChildActive(pathname: string, href: "/admin/kho-hoa" | "/admin/kho-phu-kien") {
  if (href === "/admin/kho-hoa") return pathname === "/admin/kho-hoa" || pathname === "/admin/inventory";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function WarehouseMenu({ pathname, mobile, onNavigate }: { pathname: string; mobile: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(true);
  const active = pathname === "/admin/kho-tong" || isWarehouseChildActive(pathname, "/admin/kho-hoa") || isWarehouseChildActive(pathname, "/admin/kho-phu-kien");
  const childClass = (href: "/admin/kho-hoa" | "/admin/kho-phu-kien") => `rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isWarehouseChildActive(pathname, href) ? "bg-primary text-white" : "bg-surface-muted hover:bg-surface"}`;

  return (
    <div className={mobile ? "grid gap-2" : "flex items-center gap-2"}>
      <div className={mobile ? "flex items-center gap-2" : "flex items-center gap-1"}>
        <Link href="/admin/kho-tong" onClick={onNavigate} aria-current={pathname === "/admin/kho-tong" ? "page" : undefined} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex-none lg:rounded-full lg:py-2 ${active ? "bg-primary text-white shadow-sm" : "bg-surface hover:bg-surface-muted"}`}>
          Kho tổng
        </Link>
        <button type="button" aria-expanded={open} aria-controls={mobile ? "warehouse-mobile-submenu" : "warehouse-desktop-submenu"} aria-label={open ? "Thu gọn menu kho" : "Mở rộng menu kho"} onClick={() => setOpen((value) => !value)} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-9 lg:w-9 lg:rounded-full ${active ? "border-primary/30" : ""}`}>
          <ChevronDown size={17} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div id={mobile ? "warehouse-mobile-submenu" : "warehouse-desktop-submenu"} className={mobile ? "ml-3 grid gap-2 border-l border-border pl-3" : "flex items-center gap-1"}>
          <Link href="/admin/kho-hoa" onClick={onNavigate} aria-current={isWarehouseChildActive(pathname, "/admin/kho-hoa") ? "page" : undefined} className={childClass("/admin/kho-hoa")}>Kho Hoa</Link>
          <Link href="/admin/kho-phu-kien" onClick={onNavigate} aria-current={isWarehouseChildActive(pathname, "/admin/kho-phu-kien") ? "page" : undefined} className={childClass("/admin/kho-phu-kien")}>Kho Phụ kiện</Link>
        </div>
      )}
    </div>
  );
}

function NavLink({ href, label, pathname, mobile, onNavigate }: { href: string; label: string; pathname: string; mobile: boolean; onNavigate?: () => void }) {
  const active = isActive(pathname, href);
  return <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:rounded-full lg:py-2 ${active ? "bg-primary text-white shadow-sm" : "bg-surface hover:bg-surface-muted"}`}>{label}</Link>;
}

export default function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label="Điều hướng quản trị" className="border-b border-border pb-4">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <span className="text-sm font-bold text-primary">Khu vực quản trị</span>
        <button type="button" aria-expanded={open} aria-controls="admin-mobile-navigation" aria-label={open ? "Đóng menu quản trị" : "Mở menu quản trị"} onClick={() => setOpen((value) => !value)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      <div id="admin-mobile-navigation" className={`${open ? "mt-3 grid" : "hidden"} gap-2 lg:hidden`}>
        {links.slice(0, 3).map(([href, label]) => <NavLink key={href} href={href} label={label} pathname={pathname} mobile onNavigate={() => setOpen(false)} />)}
        <WarehouseMenu pathname={pathname} mobile onNavigate={() => setOpen(false)} />
        {links.slice(3).map(([href, label]) => <NavLink key={href} href={href} label={label} pathname={pathname} mobile onNavigate={() => setOpen(false)} />)}
      </div>

      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        {links.slice(0, 3).map(([href, label]) => <NavLink key={href} href={href} label={label} pathname={pathname} mobile={false} />)}
        <WarehouseMenu pathname={pathname} mobile={false} />
        {links.slice(3).map(([href, label]) => <NavLink key={href} href={href} label={label} pathname={pathname} mobile={false} />)}
      </div>
    </nav>
  );
}
