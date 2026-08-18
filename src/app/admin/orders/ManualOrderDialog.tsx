"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";

type CatalogProduct = { id: string; sku: string; name: string; price_vnd: number; sale_price_vnd: number | null };
type Customer = { id: string; full_name: string | null; phone: string | null };
type CatalogLine = { kind: "catalog"; productId: string; quantity: number; unitPriceVnd?: number };
type CustomLine = { kind: "custom"; name: string; sku: string; unitPriceVnd: number; quantity: number; customNote: string };
type Line = CatalogLine | CustomLine;

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

export default function ManualOrderDialog({ onCreated }: { onCreated: (orderCode: string) => void }) {
  const [open, setOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [source, setSource] = useState("phone");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(today);
  const [deliveryTime, setDeliveryTime] = useState("14g-16g");
  const [cardMessage, setCardMessage] = useState("");
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [shippingVnd, setShippingVnd] = useState("0");
  const [initialStatus, setInitialStatus] = useState("pending_confirmation");
  const [lines, setLines] = useState<Line[]>([{ kind: "catalog", productId: "", quantity: 1 }]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const total = lines.reduce((sum, line) => {
    if (line.kind === "custom") return sum + line.unitPriceVnd * line.quantity;
    const product = productById.get(line.productId);
    return sum + (product ? (line.unitPriceVnd ?? product.sale_price_vnd ?? product.price_vnd) * line.quantity : 0);
  }, 0) + Number(shippingVnd || 0);

  useEffect(() => {
    if (!open || products.length) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/ops/products?status=published&pageSize=100").then((response) => response.json()),
      fetch("/api/ops/customers?limit=200").then((response) => response.json()),
    ]).then(([productResult, customerResult]) => {
      if (cancelled) return;
      if (Array.isArray(productResult.products)) setProducts(productResult.products);
      if (Array.isArray(customerResult.customers)) setCustomers(customerResult.customers);
    }).catch(() => { if (!cancelled) setError("Không thể tải catalog hoặc khách hàng."); }).finally(() => { if (!cancelled) setLoadingOptions(false); });
    return () => { cancelled = true; };
  }, [open, products.length]);

  function reset() {
    setCustomerId(""); setSource("phone"); setCustomerName(""); setCustomerPhone(""); setRecipientName(""); setRecipientPhone(""); setAddress(""); setDeliveryDate(today); setDeliveryTime("14g-16g"); setCardMessage(""); setNote(""); setInternalNote(""); setShippingVnd("0"); setInitialStatus("pending_confirmation"); setLines([{ kind: "catalog", productId: "", quantity: 1 }]); setError("");
  }

  function addCatalogLine() { setLines((current) => [...current, { kind: "catalog", productId: "", quantity: 1 }]); }
  function addCustomLine() { setLines((current) => [...current, { kind: "custom", name: "", sku: "CUSTOM", unitPriceVnd: 0, quantity: 1, customNote: "" }]); }
  function removeLine(index: number) { setLines((current) => current.filter((_, lineIndex) => lineIndex !== index)); }
  function updateLine(index: number, patch: Partial<Line>) { setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } as Line : line)); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!lines.length || lines.some((line) => line.kind === "catalog" ? !line.productId : !line.name.trim())) { setError("Vui lòng chọn sản phẩm hoặc nhập đầy đủ dòng tùy chỉnh."); return; }
    setSubmitting(true);
    const idempotencyKey = `manual-${crypto.randomUUID()}`;
    const response = await fetch("/api/ops/orders/manual", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey }, body: JSON.stringify({ customerId: customerId || null, source, customerName, customerPhone, recipientName, recipientPhone, deliveryAddress: address, deliveryDate, deliveryTime, cardMessage, note, internalNote, shippingVnd: Number(shippingVnd || 0), initialStatus, items: lines.map((line) => line.kind === "catalog" ? { productId: line.productId, quantity: line.quantity, ...(line.unitPriceVnd !== undefined ? { unitPriceVnd: Number(line.unitPriceVnd) } : {}) } : { name: line.name, sku: line.sku || "CUSTOM", unitPriceVnd: Number(line.unitPriceVnd || 0), quantity: line.quantity, customNote: line.customNote }) }) });
    const result = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok) { setError(result.error || "Không thể tạo đơn thủ công."); return; }
    setOpen(false); reset(); onCreated(result.orderCode);
  }

  return <>
    <button type="button" onClick={() => { setLoadingOptions(true); setOpen(true); }} className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90">Tạo đơn thủ công</button>
    {open && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5"><section role="dialog" aria-modal="true" aria-labelledby="manual-order-title" className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-xl sm:rounded-[28px] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Operations</p><h2 id="manual-order-title" className="mt-1 font-display text-3xl">Tạo đơn thủ công</h2><p className="mt-1 text-sm text-muted-foreground">Đơn được lưu vào PostgreSQL trước khi xử lý tiếp.</p></div><button type="button" onClick={() => { setOpen(false); reset(); }} className="rounded-full p-2 text-muted-foreground hover:bg-background" aria-label="Đóng"><X size={20} /></button></div>
      <form onSubmit={submit} className="mt-6 space-y-6"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Nguồn đơn<select value={source} onChange={(event) => setSource(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"><option value="instagram">Instagram</option><option value="zalo">Zalo</option><option value="phone">Điện thoại</option><option value="in_store">Tại shop</option><option value="other">Khác</option></select></label><label className="text-sm font-semibold">Trạng thái ban đầu<select value={initialStatus} onChange={(event) => setInitialStatus(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"><option value="pending_confirmation">Chờ xác nhận</option><option value="confirmed">Đã xác nhận</option><option value="preparing">Đang chuẩn bị</option><option value="ready">Hoàn thành mẫu</option><option value="delivering">Đang giao</option><option value="completed">Hoàn tất</option><option value="cancelled">Đã hủy</option></select></label><label className="text-sm font-semibold">Phí giao hàng<input value={shippingVnd} onChange={(event) => setShippingVnd(event.target.value)} type="number" min="0" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label></div>
        <div className="rounded-2xl border border-border p-4"><h3 className="font-bold">Khách hàng</h3><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold sm:col-span-3">Liên kết tài khoản khách hàng (không bắt buộc)<select value={customerId} onChange={(event) => { const id = event.target.value; setCustomerId(id); const customer = customers.find((entry) => entry.id === id); if (customer) { setCustomerName(customer.full_name || ""); setCustomerPhone(customer.phone || ""); } }} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"><option value="">Khách vãng lai</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name || "Khách hàng"} · {customer.phone || "Không có SĐT"}</option>)}</select></label><label className="text-sm font-semibold">Tên người đặt<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label><label className="text-sm font-semibold sm:col-span-2">SĐT người đặt<input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label></div></div>
        <div className="rounded-2xl border border-border p-4"><h3 className="font-bold">Người nhận</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Tên người nhận<input required value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label><label className="text-sm font-semibold">SĐT người nhận<input required value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label><label className="text-sm font-semibold sm:col-span-2">Địa chỉ giao<input required value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label><label className="text-sm font-semibold">Ngày giao<input required type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label><label className="text-sm font-semibold">Khung giờ<input required value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} placeholder="14g-16g" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label></div></div>
        <div className="rounded-2xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Sản phẩm và dòng tùy chỉnh</h3><p className="mt-1 text-xs text-muted-foreground">Giá sản phẩm catalog sẽ được đọc lại từ database ở server.</p></div><div className="flex gap-2"><button type="button" onClick={addCatalogLine} className="rounded-full border border-border px-3 py-2 text-xs font-bold"><Plus size={14} className="mr-1 inline" />Sản phẩm</button><button type="button" onClick={addCustomLine} className="rounded-full border border-border px-3 py-2 text-xs font-bold"><Plus size={14} className="mr-1 inline" />Dòng tùy chỉnh</button></div></div><div className="mt-4 space-y-3">{lines.map((line, index) => <div key={index} className="grid gap-2 rounded-xl bg-background p-3 sm:grid-cols-[minmax(0,1fr)_120px_90px_auto]">{line.kind === "catalog" ? <select value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })} disabled={loadingOptions} className="h-11 rounded-xl border border-border bg-surface px-3 text-sm"><option value="">{loadingOptions ? "Đang tải sản phẩm..." : "Chọn sản phẩm"}</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.sale_price_vnd ?? product.price_vnd)}đ</option>)}</select> : <div className="grid gap-2 sm:col-span-2"><div className="grid gap-2 sm:grid-cols-3"><input value={line.name} onChange={(event) => updateLine(index, { name: event.target.value })} placeholder="Tên dòng tùy chỉnh" className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" /><input value={line.sku} onChange={(event) => updateLine(index, { sku: event.target.value })} placeholder="SKU" className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" /><input value={line.customNote} onChange={(event) => updateLine(index, { customNote: event.target.value })} placeholder="Ghi chú dòng" className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" /></div></div>}<input value={line.kind === "catalog" ? (line.unitPriceVnd ?? "") : line.unitPriceVnd} onChange={(event) => updateLine(index, { unitPriceVnd: Math.max(0, Number(event.target.value || 0)) })} type="number" min="0" aria-label="Giá tại đơn" placeholder={line.kind === "catalog" ? "Giá catalog" : "Đơn giá"} className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" /><input value={line.quantity} onChange={(event) => updateLine(index, { quantity: Math.max(1, Number(event.target.value || 1)) })} type="number" min="1" max="100" aria-label="Số lượng" className="h-11 rounded-xl border border-border bg-surface px-3 text-sm" /><button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} className="rounded-xl border border-border px-3 text-sm text-danger disabled:opacity-40" aria-label="Xóa dòng"><X size={17} /></button></div>)}</div><p className="mt-4 text-right text-sm">Tổng dự kiến: <strong className="text-primary">{money(total)}đ</strong></p></div>
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-semibold">Lời nhắn thiệp<textarea value={cardMessage} onChange={(event) => setCardMessage(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2" /></label><label className="text-sm font-semibold">Ghi chú khách<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2" /></label><label className="text-sm font-semibold">Ghi chú nội bộ<textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2" /></label></div>
        {error && <p role="alert" className="rounded-xl bg-[#fae8e4] p-3 text-sm text-danger">{error}</p>}<div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><button type="button" onClick={() => { setOpen(false); reset(); }} className="rounded-full border border-border px-5 py-3 text-sm font-bold">Hủy</button><button type="submit" disabled={submitting} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting && <LoaderCircle className="animate-spin" size={17} />} {submitting ? "Đang lưu..." : "Lưu đơn thủ công"}</button></div></form>
    </section></div>}
  </>;
}
