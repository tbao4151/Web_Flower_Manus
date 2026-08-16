"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  ["/admin", "Tổng quan"],
  ["/admin/orders", "Đơn hàng"],
  ["/admin/products", "Sản phẩm"],
  ["/admin/inventory", "Kho hoa"],
  ["/admin/customers", "Khách hàng"],
  ["/admin/deliveries", "Giao hàng"],
  ["/admin/inventory/history", "Lịch sử kho"],
  ["/admin/settings", "Cài đặt"],
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  if (href === "/admin/inventory") return pathname === "/admin/inventory" || pathname === "/admin/kho-hoa";
  if (href === "/admin/inventory/history") return pathname === "/admin/inventory/history" || pathname === "/admin/lich-su-kho";
  if (href === "/admin/products") return pathname === "/admin/products" || pathname === "/admin/san-pham" || pathname === "/admin/anh";
  if (href === "/admin/deliveries") return pathname === "/admin/deliveries" || pathname === "/admin/giao-hang";
  if (href === "/admin/settings") return pathname === "/admin/settings" || pathname === "/admin/cai-dat";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label="Điều hướng quản trị" className="border-b border-border pb-4">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <span className="text-sm font-bold text-primary">Khu vực quản trị</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-mobile-navigation"
          aria-label={open ? "Đóng menu quản trị" : "Mở menu quản trị"}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      <div
        id="admin-mobile-navigation"
        className={`${open ? "mt-3 grid" : "hidden"} gap-2 lg:hidden`}
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive(pathname, href) ? "bg-primary text-white" : "bg-surface hover:bg-surface-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="hidden flex-wrap gap-2 lg:flex">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive(pathname, href) ? "bg-primary text-white shadow-sm" : "bg-surface hover:bg-surface-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
