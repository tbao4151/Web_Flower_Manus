"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowLeft, Clipboard, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";

type OrderSummary = {
  order_code: string;
  status: string;
  total_vnd: number;
  created_at: string;
};

type OrderDetail = {
  order_code: string;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  is_pickup: boolean;
  delivery_address: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  total_vnd: number;
  subtotal_vnd: number;
  shipping_vnd: number;
  shipping_fee_confirmed: boolean;
  deposit_required_vnd: number;
  deposit_paid_vnd: number;
  remaining_amount_vnd: number;
  payment_status: string;
  delivery_status: string;
  created_at: string;
  order_items: { product_name_snapshot: string; quantity: number; line_total_vnd: number }[];
};

const statusLabels: Record<string, string> = {
  pending_confirmation: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  delivering: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};
const deliveryLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  assigned: "Đã phân công",
  out_for_delivery: "Đang giao",
  delivered: "Đã giao",
  pickup_ready: "Sẵn sàng nhận",
  picked_up: "Đã nhận tại shop",
  failed: "Giao không thành công",
};
const paymentLabels: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  partially_paid: "Đã thanh toán một phần",
  paid: "Đã thanh toán",
};
const publicLookupError = "Không có đơn hàng nào khớp với số điện thoại người nhận này, hoặc bạn đã nhập sai số người nhận.";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString("vi-VN");
const formatDateTime = (value: string) => new Date(value).toLocaleString("vi-VN");

function normalizePhoneForLookup(value: string) {
  const compact = value.replace(/[\s().-]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
}

export default function LookupOrderPage() {
  const [orderCode, setOrderCode] = useState("");
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState("");
  const [searched, setSearched] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  function focusResults() {
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      resultsRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  async function loadDetail(code: string) {
    setDetailLoading(code);
    setError("");
    try {
      const params = new URLSearchParams({ orderCode: code, recipientPhone: normalizePhoneForLookup(phone), detail: "1" });
      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.order) {
        setError(data.error || publicLookupError);
        return;
      }
      setSelectedOrder(data.order as OrderDetail);
    } catch {
      setError("Không thể tra cứu đơn hàng lúc này. Vui lòng thử lại sau.");
    } finally {
      setDetailLoading("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizePhoneForLookup(phone.trim());
    const trimmedCode = orderCode.trim().toUpperCase();
    setError("");
    setSelectedOrder(null);
    setSearched(false);

    if (!/^0\d{9}$/.test(normalizedPhone)) {
      setError("Số điện thoại người nhận phải gồm đúng 10 chữ số.");
      return;
    }
    if (trimmedCode && !/^(?:CSH-\d{4}-[A-Z0-9]{8}|CSH-\d{6}-\d{4}|CH\d{10})$/.test(trimmedCode)) {
      setError("Mã đơn chưa đúng định dạng.");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ recipientPhone: normalizedPhone });
      if (trimmedCode) params.set("orderCode", trimmedCode);
      const response = await fetch(`/api/orders?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Không thể tra cứu đơn hàng lúc này. Vui lòng thử lại sau.");
        return;
      }
      const nextOrders = (data.orders || []) as OrderSummary[];
      setOrders(nextOrders);
      setSearched(true);
      focusResults();
    } catch {
      setError("Không thể tra cứu đơn hàng lúc này. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <section className="mt-10 rounded-[26px] border border-border bg-surface p-6 sm:p-8">
          <Clipboard className="text-primary" aria-hidden="true" />
          <h1 className="mt-3 font-display text-4xl">Tra cứu đơn hàng</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Nhập số điện thoại người nhận để xem các đơn hàng liên quan. Nếu có mã đơn, bạn có thể nhập thêm để tìm nhanh một đơn cụ thể.
          </p>

          <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">
              <span>Mã đơn (không bắt buộc)</span>
              <input
                value={orderCode}
                onChange={(event) => setOrderCode(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 uppercase"
                placeholder="CSH-2026-..."
                autoComplete="off"
                aria-describedby="order-code-help"
              />
              <span id="order-code-help" className="mt-1 block text-xs font-normal text-muted-foreground">Nhập mã đơn nếu bạn muốn tìm nhanh một đơn cụ thể.</span>
            </label>
            <label className="text-sm font-semibold">
              <span>Số điện thoại người nhận</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4"
                inputMode="numeric"
                placeholder="0889126325"
                autoComplete="tel"
                required
              />
            </label>
            <button type="submit" disabled={loading} className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />} Tra cứu
            </button>
          </form>

          {error && <p role="alert" className="mt-5 rounded-xl bg-[#fae8e4] p-4 text-sm text-danger">{error}</p>}
        </section>

        {searched && (
          <section ref={resultsRef} tabIndex={-1} aria-live="polite" className="mt-7 scroll-mt-28 outline-none">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Kết quả tra cứu</p>
                <h2 className="mt-1 font-display text-3xl">{orders.length ? `Tìm thấy ${orders.length} đơn hàng` : "Không có đơn hàng phù hợp"}</h2>
              </div>
              {orders.length > 0 && <p className="text-sm text-muted-foreground">Đơn mới nhất hiển thị trước</p>}
            </div>

            {orders.length === 0 ? (
              <p role="status" className="mt-4 rounded-2xl border border-border bg-surface p-5 text-sm leading-6 text-muted-foreground">{publicLookupError}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {orders.map((order) => (
                  <article key={order.order_code} className="rounded-2xl border border-border bg-surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{order.order_code}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-[#e4ecdf] px-3 py-1 text-xs font-bold text-primary">{statusLabels[order.status] || order.status}</span>
                        <strong className="text-sm text-primary">{money(order.total_vnd)}đ</strong>
                      </div>
                    </div>
                    <button type="button" onClick={() => loadDetail(order.order_code)} disabled={detailLoading === order.order_code} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-primary px-4 text-sm font-bold text-primary transition hover:bg-[#e4ecdf] disabled:cursor-wait disabled:opacity-60">
                      {detailLoading === order.order_code && <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />} Xem chi tiết
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedOrder && (
          <section aria-label={`Chi tiết đơn ${selectedOrder.order_code}`} className="mt-7 rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">{selectedOrder.order_code}</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo ngày {formatDateTime(selectedOrder.created_at)}</p>
              </div>
              <span className="rounded-full bg-[#e4ecdf] px-3 py-1 text-xs font-bold text-primary">{statusLabels[selectedOrder.status] || selectedOrder.status}</span>
            </div>
            <div className="mt-5 space-y-1 text-sm">
              <p><strong>Người nhận:</strong> {selectedOrder.recipient_name}</p>
              <p><strong>{selectedOrder.is_pickup ? "Nhận hoa:" : "Địa chỉ:"}</strong> {selectedOrder.is_pickup ? "Tự tới lấy tại shop" : selectedOrder.delivery_address || "—"}</p>
              {selectedOrder.delivery_date && <p><strong>Thời gian:</strong> {selectedOrder.delivery_date}{selectedOrder.delivery_time ? ` · ${selectedOrder.delivery_time}` : ""}</p>}
              <p><strong>Giao hàng:</strong> {deliveryLabels[selectedOrder.delivery_status] || selectedOrder.delivery_status}</p>
            </div>
            <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              {selectedOrder.order_items.map((item, index) => <div key={`${item.product_name_snapshot}-${index}`} className="flex justify-between gap-4"><span>{item.product_name_snapshot} × {item.quantity}</span><strong>{money(item.line_total_vnd)}đ</strong></div>)}
              <div className="mt-3 space-y-1 border-t border-border pt-3">
                <div className="flex justify-between"><span>Tạm tính</span><strong>{money(selectedOrder.subtotal_vnd)}đ</strong></div>
                <div className="flex justify-between"><span>Phí giao hàng</span><strong>{selectedOrder.shipping_fee_confirmed || selectedOrder.is_pickup ? `${money(selectedOrder.shipping_vnd)}đ` : "Shop xác nhận sau"}</strong></div>
                <div className="flex justify-between text-base"><strong>Tổng đơn</strong><strong className="text-primary">{money(selectedOrder.total_vnd)}đ</strong></div>
                <div className="flex justify-between"><span>Đã cọc</span><strong>{money(selectedOrder.deposit_paid_vnd || 0)}đ</strong></div>
                <div className="flex justify-between"><span>Còn lại</span><strong>{money(selectedOrder.remaining_amount_vnd ?? selectedOrder.total_vnd)}đ</strong></div>
                <div className="flex justify-between text-xs text-muted-foreground"><span>Thanh toán</span><span>{paymentLabels[selectedOrder.payment_status] || selectedOrder.payment_status}</span></div>
              </div>
            </div>
          </section>
        )}

        <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={15} aria-hidden="true" /> Về cửa hàng</Link>
      </div>
    </main>
  );
}
