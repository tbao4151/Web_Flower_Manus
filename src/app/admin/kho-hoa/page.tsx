"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  low_stock_threshold: number;
  is_active: boolean;
  available_quantity: number;
  availability_status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
};

type Transaction = {
  id: string;
  transaction_type: string;
  quantity_change: number;
  reason: string | null;
  created_at: string;
};

const statusLabel: Record<InventoryItem["availability_status"], string> = {
  IN_STOCK: "Còn hàng",
  LOW_STOCK: "Sắp hết",
  OUT_OF_STOCK: "Hết hàng",
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "LOW_STOCK">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("cành");
  const [threshold, setThreshold] = useState("2");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [transactionType, setTransactionType] = useState<"import" | "damaged" | "adjustment">("import");
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/inventory", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể tải kho hoa.");
      setItems(result.inventoryItems || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải kho hoa.");
    } finally {
      setLoading(false);
    }
  };

  // Data loading synchronizes this client screen with the protected Admin API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void loadItems();
    const status = new URLSearchParams(window.location.search).get("status");
    if (status === "LOW_STOCK") setInventoryFilter("LOW_STOCK");
  }, []);

  const loadHistory = async (id: string) => {
    setSelectedId(id);
    setError("");
    const response = await fetch(`/api/admin/inventory/${id}/transactions`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Không thể tải lịch sử kho.");
      return;
    }
    setTransactions(result.transactions || []);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setUnit("cành");
    setThreshold("2");
    setInitialQuantity("0");
  };

  const submitItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    const isEditing = Boolean(editingId);
    const response = await fetch("/api/admin/inventory", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEditing ? { id: editingId, name, unit, lowStockThreshold: Number(threshold) } : { name, unit, lowStockThreshold: Number(threshold), initialQuantity: Number(initialQuantity), isActive: true }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Không thể lưu nguyên liệu.");
      return;
    }
    setMessage(isEditing ? "Đã cập nhật nguyên liệu." : "Đã thêm nguyên liệu.");
    resetForm();
    await loadItems();
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setThreshold(String(item.low_stock_threshold));
    setInitialQuantity("0");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    setMessage("");
    setError("");
    const response = await fetch(`/api/admin/inventory/${selectedId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionType, quantityChange: Number(quantityChange), reason }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Không thể ghi nhận giao dịch.");
      return;
    }
    setMessage("Đã ghi nhận thay đổi tồn kho.");
    setQuantityChange("");
    setReason("");
    await Promise.all([loadItems(), loadHistory(selectedId)]);
  };

  const filteredItems = inventoryFilter === "LOW_STOCK" ? items.filter((item) => item.availability_status === "LOW_STOCK" || item.availability_status === "OUT_OF_STOCK") : items;
  const selectedItem = items.find((item) => item.id === selectedId);

  return <main className="min-h-screen bg-background"><section className="container-cas py-8 sm:py-12"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Quản trị kho</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Kho hoa.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Theo dõi nguyên liệu, tồn khả dụng và lịch sử điều chỉnh. Số lượng giữ cho đơn đã xác nhận không thể bị giảm thấp hơn bằng thao tác thủ công.</p></div><a href="/admin" className="rounded-full border border-border px-4 py-2 text-sm font-bold text-primary">Về tổng quan</a></div>{(message || error) && <div className={`mt-6 rounded-2xl p-4 text-sm ${error ? "bg-[#fae8e4] text-danger" : "bg-[#e4ecdf] text-primary"}`}>{error || message}</div>}<div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]"><section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-3xl">Nguyên liệu</h2><div className="flex items-center gap-2"><select value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value as typeof inventoryFilter)} aria-label="Lọc trạng thái tồn kho" className="h-10 rounded-full border border-border bg-background px-3 text-sm"><option value="all">Tất cả</option><option value="LOW_STOCK">Sắp hết / hết hàng</option></select><span className="text-sm text-muted-foreground">{filteredItems.length} mục</span></div></div>{loading ? <div className="rounded-2xl bg-surface p-8 text-sm text-muted-foreground">Đang tải kho...</div> : filteredItems.length === 0 ? <div className="rounded-2xl bg-surface p-8 text-sm text-muted-foreground">Chưa có nguyên liệu. Hãy thêm nguyên liệu đầu tiên ở bên phải.</div> : <div className="overflow-hidden rounded-2xl border border-border bg-surface">{filteredItems.map((item) => <div key={item.id} className={`grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center ${selectedId === item.id ? "bg-[#f3f6ee]" : ""}`}><button onClick={() => void loadHistory(item.id)} className="min-w-0 text-left"><strong className="block truncate font-display text-xl">{item.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.unit} · Đang có {item.quantity_on_hand} · Đã giữ {item.quantity_reserved} · Khả dụng <b className="text-foreground">{item.available_quantity}</b></span></button><span className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold sm:justify-self-auto ${item.availability_status === "OUT_OF_STOCK" ? "bg-[#fae8e4] text-danger" : item.availability_status === "LOW_STOCK" ? "bg-[#fff0da] text-foreground" : "bg-[#e4ecdf] text-primary"}`}>{statusLabel[item.availability_status]}</span><button onClick={() => startEdit(item)} className="justify-self-start rounded-full border border-border px-3 py-2 text-xs font-bold text-primary sm:justify-self-auto">Sửa</button></div>)}</div>}{selectedItem && <div className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Điều chỉnh tồn</p><h3 className="mt-1 font-display text-2xl">{selectedItem.name}</h3></div><button onClick={() => setSelectedId(null)} className="text-sm font-bold text-muted-foreground">Đóng</button></div><form onSubmit={submitTransaction} className="mt-4 grid gap-3 sm:grid-cols-2"><select value={transactionType} onChange={(event) => setTransactionType(event.target.value as typeof transactionType)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm"><option value="import">Nhập thêm</option><option value="damaged">Hư hao</option><option value="adjustment">Điều chỉnh</option></select><input type="number" required value={quantityChange} onChange={(event) => setQuantityChange(event.target.value)} placeholder="Số lượng (+ hoặc -)" className="h-11 rounded-xl border border-border bg-background px-3 text-sm" /><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do / ghi chú" className="h-11 rounded-xl border border-border bg-background px-3 text-sm sm:col-span-2" /><button className="rounded-full bg-primary px-4 py-3 text-sm font-bold text-white sm:col-span-2">Ghi nhận thay đổi</button></form><div className="mt-6"><h4 className="text-sm font-bold">Lịch sử gần đây</h4>{transactions.length ? <div className="mt-3 space-y-2">{transactions.map((transaction) => <div key={transaction.id} className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{new Date(transaction.created_at).toLocaleString("vi-VN")} · {transaction.transaction_type} {transaction.reason ? `· ${transaction.reason}` : ""}</span><strong className={transaction.quantity_change >= 0 ? "text-primary" : "text-danger"}>{transaction.quantity_change > 0 ? "+" : ""}{transaction.quantity_change}</strong></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Chưa có giao dịch.</p>}</div></div>}</section><aside className="h-fit rounded-2xl border border-border bg-surface p-5"><h2 className="font-display text-2xl">{editingId ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}</h2><form onSubmit={submitItem} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Tên nguyên liệu<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Hoa hồng đỏ" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-sm font-semibold">Đơn vị<input required value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="cành / bó / lá" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-sm font-semibold">Ngưỡng sắp hết<input required type="number" min="0" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>{!editingId && <label className="block text-sm font-semibold">Tồn đầu kỳ<input required type="number" min="0" value={initialQuantity} onChange={(event) => setInitialQuantity(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>}<div className="flex gap-2"><button className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white">{editingId ? "Lưu thay đổi" : "Thêm vào kho"}</button>{editingId && <button type="button" onClick={resetForm} className="rounded-full border border-border px-4 py-3 text-sm font-bold">Hủy</button>}</div></form><p className="mt-5 text-xs leading-5 text-muted-foreground">Công thức sản phẩm được quản lý riêng trong trang Sản phẩm & hình ảnh. Khách hàng và nhân viên không nhìn thấy BOM.</p></aside></div></section></main>;
}
