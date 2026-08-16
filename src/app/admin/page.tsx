"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, CreditCard, DollarSign, Flower2, PackageCheck, Truck } from "lucide-react";

type Metrics = { newOrders: number; pendingConfirmation: number; preparing: number; todayDelivery: number; todayRevenue: number; paidOrders: number; lowStockItems: number; next24Hours: number };

type Card = { label: string; value: string | number; href: string; Icon: typeof ClipboardList; description: string };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Không thể tải dashboard.");
        setMetrics(result.metrics);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const cards: Card[] = metrics ? [
    { label: "Đơn mới 24 giờ", value: metrics.newOrders, href: "/admin/orders?range=24h", Icon: ClipboardList, description: "Đơn được tạo trong 24 giờ qua" },
    { label: "Chờ xác nhận", value: metrics.pendingConfirmation, href: "/admin/orders?status=pending_confirmation", Icon: AlertTriangle, description: "Cần kiểm tra và xác nhận" },
    { label: "Đang xử lý", value: metrics.preparing, href: "/admin/orders?status=preparing", Icon: PackageCheck, description: "Đơn đang được chuẩn bị" },
    { label: "Giao hôm nay", value: metrics.todayDelivery, href: "/admin/deliveries?date=today", Icon: Truck, description: "Lịch giao hoặc nhận trong hôm nay" },
    { label: "Doanh số hôm nay", value: `${money(metrics.todayRevenue)}đ`, href: "/admin/orders?date=today", Icon: DollarSign, description: "Tổng giá trị đơn tạo hôm nay" },
    { label: "Đơn đã thanh toán", value: metrics.paidOrders, href: "/admin/orders?payment_status=paid", Icon: CreditCard, description: "Các đơn đã thu đủ tiền" },
    { label: "Nguyên liệu sắp hết", value: metrics.lowStockItems, href: "/admin/inventory?status=LOW_STOCK", Icon: Flower2, description: "Cần bổ sung hoặc điều chỉnh tồn" },
    { label: "Đơn trong 24–48 giờ", value: metrics.next24Hours, href: "/admin/orders?receive_window=24-48h", Icon: ClipboardList, description: "Đơn có lịch nhận trong khung tới" },
  ] : [];

  return (
    <section className="py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Admin dashboard</p>
          <h1 className="mt-2 font-display text-4xl">Tổng quan</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Theo dõi đơn hàng, thanh toán, giao hàng và nguyên liệu trong một màn hình.</p>
        </div>
        <Flower2 className="hidden text-primary sm:block" size={42} strokeWidth={1.2} aria-hidden="true" />
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl bg-[#fae8e4] p-4 text-sm text-danger">{error}</p>}
      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Đang tải dashboard">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-[24px] bg-surface-muted" />)}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, href, Icon, description }) => (
            <Link key={label} href={href} className="group rounded-[24px] border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="flex items-start justify-between gap-3"><Icon className="text-primary" size={21} aria-hidden="true" /><span className="text-xs font-bold text-primary opacity-0 transition group-hover:opacity-100">Mở →</span></div>
              <p className="mt-5 text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="rounded-[24px] border border-border bg-surface p-6 lg:col-span-2">
          <h2 className="font-display text-2xl">Tác vụ nhanh</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/admin/orders" className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Xem đơn hàng</Link>
            <Link href="/admin/inventory" className="rounded-full border border-border px-5 py-3 text-sm font-bold transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Cập nhật kho</Link>
            <Link href="/admin/customers" className="rounded-full border border-border px-5 py-3 text-sm font-bold transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Tìm khách hàng</Link>
          </div>
        </div>
        <div className="rounded-[24px] border border-border bg-surface p-6">
          <h2 className="font-display text-2xl">Lưu ý vận hành</h2>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Đơn giao hàng chưa xác nhận phí sẽ hiển thị “Shop xác nhận sau”. Chỉ Admin có thể ghi nhận cọc và phí giao hàng.</p>
        </div>
      </div>
    </section>
  );
}
