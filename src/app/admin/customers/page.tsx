"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Search, Users } from "lucide-react";

type Customer = {
  id: string;
  phone: string;
  name: string;
  orderCount: number;
  lifetimeValue: number;
  latestOrderAt: string | null;
  createdAt: string;
};

type CustomerScope = "recent" | "search";

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<CustomerScope>("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextSearch = search) {
    setLoading(true);
    const normalizedSearch = nextSearch.trim();
    const response = await fetch(`/api/admin/customers?search=${encodeURIComponent(normalizedSearch)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Không thể tải tài khoản khách hàng.");
    } else {
      setCustomers(result.customers || []);
      setScope(result.scope === "search" ? "search" : "recent");
      setError("");
    }
    setLoading(false);
  }

  // The protected customer account list intentionally hydrates state after the initial render.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(""); }, []);

  const countLabel = scope === "search" ? `${customers.length} khách hàng phù hợp` : `${customers.length} tài khoản mới trong 30 ngày`;

  return (
    <section className="py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary"><Users size={14} /> Customer accounts</p>
          <h1 className="mt-2 font-display text-4xl">Tài khoản khách hàng</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Danh sách mặc định lấy từ tài khoản có role customer đăng ký trong 30 ngày gần nhất. Tìm kiếm theo tên hoặc số điện thoại sẽ mở rộng trên toàn bộ lịch sử tài khoản.</p>
        </div>
        <p className="text-sm text-muted-foreground">{countLabel}</p>
      </div>

      <div className="mt-7 flex max-w-2xl gap-3">
        <label className="relative block flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") load(search); }}
            className="h-12 w-full rounded-full border border-border bg-surface pl-11 pr-4"
            placeholder="Tìm tên hoặc số điện thoại"
            aria-label="Tìm tên hoặc số điện thoại"
          />
        </label>
        <button type="button" onClick={() => load(search)} className="h-12 rounded-full bg-primary px-5 font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Tìm</button>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl bg-[#fae8e4] p-4 text-sm text-danger">{error}</p>}

      {loading ? <div className="flex justify-center py-16"><LoaderCircle className="animate-spin text-primary" /></div> : customers.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-border bg-surface p-10 text-center">
          <p className="font-display text-2xl">{scope === "recent" ? "Chưa có tài khoản khách hàng mới trong 30 ngày gần đây." : "Chưa có khách hàng phù hợp."}</p>
          <p className="mt-3 text-sm text-muted-foreground">{scope === "recent" ? "Bạn vẫn có thể tìm các tài khoản cũ bằng tên hoặc số điện thoại." : "Thử lại với tên hoặc số điện thoại khác."}</p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[24px] border border-border bg-surface">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-background text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-4">Họ tên</th>
                <th className="px-5 py-4">Số điện thoại</th>
                <th className="px-5 py-4">Số đơn</th>
                <th className="px-5 py-4">Tổng giá trị</th>
                <th className="px-5 py-4">Đơn gần nhất</th>
                <th className="px-5 py-4">Ngày đăng ký</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-5"><p className="font-semibold">{customer.name}</p><p className="text-xs text-muted-foreground">Customer account</p></td>
                  <td className="px-5 py-5">{customer.phone}</td>
                  <td className="px-5 py-5">{customer.orderCount}</td>
                  <td className="px-5 py-5 font-bold text-primary">{money(customer.lifetimeValue)}đ</td>
                  <td className="px-5 py-5 text-muted-foreground">{dateTime(customer.latestOrderAt)}</td>
                  <td className="px-5 py-5 text-muted-foreground">{dateTime(customer.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
