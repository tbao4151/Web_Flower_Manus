"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, CreditCard, DollarSign, Flower2, LoaderCircle, PackageCheck, Truck } from "lucide-react";
import AdminNav from "./_components/AdminNav";

type Metrics = { newOrders: number; pendingConfirmation: number; preparing: number; todayDelivery: number; todayRevenue: number; paidOrders: number; lowStockItems: number; next24Hours: number };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/dashboard").then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Không thể tải dashboard.");
      setMetrics(result.metrics);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không thể tải dashboard.")).finally(() => setLoading(false));
  }, []);
  const cards = metrics ? [
    ["Đơn mới 24 giờ", metrics.newOrders, ClipboardList],
    ["Chờ xác nhận", metrics.pendingConfirmation, AlertTriangle],
    ["Đang xử lý", metrics.preparing, PackageCheck],
    ["Giao hôm nay", metrics.todayDelivery, Truck],
    ["Doanh số hôm nay", `${money(metrics.todayRevenue)}đ`, DollarSign],
    ["Đơn đã thanh toán", metrics.paidOrders, CreditCard],
    ["Nguyên liệu sắp hết", metrics.lowStockItems, Flower2],
    ["Đơn trong 24–48 giờ", metrics.next24Hours, ClipboardList],
  ] as const : [];
  return <main className="min-h-screen bg-background px-5 py-6 sm:px-8"><div className="mx-auto max-w-7xl"><header className="mb-6"><p className="font-display text-2xl">CÁ&apos;S HOA</p><p className="mt-1 text-sm text-muted-foreground">Trung tâm điều hành shop</p></header><AdminNav /><section className="py-8"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Admin dashboard</p><h1 className="mt-2 font-display text-4xl">Tổng quan</h1><p className="mt-2 text-sm text-muted-foreground">Theo dõi đơn hàng, thanh toán, giao hàng và nguyên liệu trong một màn hình.</p></div><Flower2 className="hidden text-primary sm:block" size={42} strokeWidth={1.2} /></div>{error && <p role="alert" className="mt-6 rounded-xl bg-[#fae8e4] p-4 text-sm text-danger">{error}</p>}{loading ? <div className="flex justify-center py-16"><LoaderCircle className="animate-spin text-primary" /></div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, Icon]) => <article key={label} className="rounded-[24px] border border-border bg-surface p-5"><Icon className="text-primary" size={21} /><p className="mt-5 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold text-foreground">{value}</p></article>)}</div>}<div className="mt-8 grid gap-5 lg:grid-cols-3"><div className="rounded-[24px] border border-border bg-surface p-6 lg:col-span-2"><h2 className="font-display text-2xl">Tác vụ nhanh</h2><div className="mt-5 flex flex-wrap gap-3"><a href="/admin/orders" className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">Xem đơn hàng</a><a href="/admin/kho-hoa" className="rounded-full border border-border px-5 py-3 text-sm font-bold">Cập nhật kho</a><a href="/admin/customers" className="rounded-full border border-border px-5 py-3 text-sm font-bold">Tìm khách hàng</a></div></div><div className="rounded-[24px] border border-border bg-surface p-6"><h2 className="font-display text-2xl">Lưu ý vận hành</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">Đơn giao hàng chưa xác nhận phí sẽ hiển thị “Shop xác nhận sau”. Chỉ Admin có thể ghi nhận cọc và phí giao hàng.</p></div></div></section></div></main>;
}
