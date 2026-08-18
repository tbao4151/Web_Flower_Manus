"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type InventoryType = "flower" | "accessory";
type AvailabilityStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
type InventoryFilter = "all" | AvailabilityStatus | "ARCHIVED";
type TransactionType = "import" | "export" | "damaged" | "adjustment";

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  inventory_type: InventoryType;
  inventory_unit_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  low_stock_threshold: number;
  is_active: boolean;
  available_quantity: number;
  availability_status: AvailabilityStatus;
};

type Unit = { id: string; name: string; inventory_type: InventoryType };
type Transaction = { id: string; transaction_type: string; quantity_change: number; quantity_before: number | null; quantity_after: number | null; reason: string | null; note: string | null; created_at: string };
type ApiErrorBody = { error?: string | { message?: string } };

type Props = {
  inventoryType: InventoryType;
  title: string;
  description: string;
  itemLabel: string;
  badgeClassName: string;
};

const statusLabel: Record<AvailabilityStatus, string> = { IN_STOCK: "Còn hàng", LOW_STOCK: "Sắp hết", OUT_OF_STOCK: "Hết hàng" };
const filterLabel: Record<InventoryFilter, string> = { all: "Tất cả", IN_STOCK: "Còn hàng", LOW_STOCK: "Sắp hết", OUT_OF_STOCK: "Hết hàng", ARCHIVED: "Đã lưu trữ" };

function getApiErrorMessage(body: ApiErrorBody, fallback: string) {
  return typeof body.error === "string" ? body.error : body.error?.message || fallback;
}

export default function InventoryManager({ inventoryType, title, description, itemLabel, badgeClassName }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [threshold, setThreshold] = useState("2");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [transactionType, setTransactionType] = useState<TransactionType>("import");
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [unitSubmitting, setUnitSubmitting] = useState(false);

  const loadItems = async (nextSearch = search, nextFilter = inventoryFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: inventoryType, status: nextFilter });
      if (nextSearch.trim()) params.set("q", nextSearch.trim());
      const response = await fetch(`/api/admin/inventory?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(result, `Không thể tải ${title.toLowerCase()}.`));
      setItems(result.inventoryItems || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Không thể tải ${title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  };

  const loadUnits = async () => {
    try {
      const response = await fetch(`/api/admin/inventory/units?type=${inventoryType}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(result, "Không thể tải đơn vị kho."));
      setUnits(result.units || []);
      if (!unitId && result.units?.[0]) setUnitId(result.units[0].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải đơn vị kho.");
    }
  };

  useEffect(() => {
    void loadItems("", "all");
    void loadUnits();
  }, [inventoryType]);

  const loadHistory = async (id: string) => {
    setSelectedId(id);
    try {
      const response = await fetch(`/api/admin/inventory/${id}/transactions`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(result, "Không thể tải lịch sử kho."));
      setTransactions(result.transactions || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải lịch sử kho.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setUnitId(units[0]?.id || "");
    setThreshold("2");
    setInitialQuantity("0");
  };

  const submitItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const isEditing = Boolean(editingId);
      const payload = isEditing
        ? { id: editingId, name, unitId, lowStockThreshold: Number(threshold) }
        : { name, inventoryType, unitId, lowStockThreshold: Number(threshold), initialQuantity: Number(initialQuantity), isActive: true };
      const response = await fetch("/api/admin/inventory", { method: isEditing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiErrorMessage(result, "Không thể lưu item kho."));
      toast.success(isEditing ? "Đã cập nhật item kho." : "Đã thêm item vào kho.");
      resetForm();
      await loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu item kho.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setName(item.name);
    setUnitId(item.inventory_unit_id);
    setThreshold(String(item.low_stock_threshold));
    setInitialQuantity("0");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const setItemActive = async (item: InventoryItem, nextActive: boolean) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/inventory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, isActive: nextActive }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiErrorMessage(result, "Không thể cập nhật trạng thái item."));
      toast.success(nextActive ? "Đã khôi phục item." : "Đã lưu trữ item.");
      await loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái item.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteItem = async (item: InventoryItem) => {
    if (!window.confirm(`Xóa ${itemLabel.toLowerCase()} “${item.name}”? Chỉ item chưa có công thức hoặc lịch sử tồn kho mới được xóa.`)) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/inventory", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiErrorMessage(result, "Không thể xóa item kho."));
      if (selectedId === item.id) setSelectedId(null);
      if (editingId === item.id) resetForm();
      toast.success("Đã xóa item kho an toàn.");
      await loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa item kho.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || submitting) return;
    const rawQuantity = Number(quantityChange);
    if (!Number.isInteger(rawQuantity) || rawQuantity === 0) {
      toast.error("Số lượng thay đổi phải là số nguyên khác 0.");
      return;
    }
    const change = transactionType === "import" ? Math.abs(rawQuantity) : transactionType === "export" || transactionType === "damaged" ? -Math.abs(rawQuantity) : rawQuantity;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/inventory/${selectedId}/transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionType, quantityChange: change, reason }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiErrorMessage(result, "Không thể ghi nhận giao dịch kho."));
      toast.success("Đã ghi nhận thay đổi tồn kho và lịch sử audit.");
      setQuantityChange("");
      setReason("");
      await Promise.all([loadItems(), loadHistory(selectedId)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể ghi nhận giao dịch kho.");
    } finally {
      setSubmitting(false);
    }
  };

  const addUnit = async () => {
    if (!newUnitName.trim() || unitSubmitting) return;
    setUnitSubmitting(true);
    try {
      const response = await fetch("/api/admin/inventory/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newUnitName, inventoryType }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiErrorMessage(result, "Không thể thêm đơn vị kho."));
      setNewUnitName("");
      toast.success("Đã thêm đơn vị mới vào nhóm sản phẩm.");
      await loadUnits();
      if (result.unit?.id) setUnitId(result.unit.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thêm đơn vị kho.");
    } finally {
      setUnitSubmitting(false);
    }
  };

  const startSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput);
    void loadItems(searchInput, inventoryFilter);
  };

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId), [items, selectedId]);

  return <main className="min-h-screen bg-background"><section className="container-cas py-8 sm:py-12"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Quản trị Kho tổng</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl sm:text-5xl">{title}.</h1><span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClassName}`}>{inventoryType === "flower" ? "FLOWER" : "ACCESSORY"}</span></div><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p></div><a href="/admin/kho-tong" className="rounded-full border border-border px-4 py-2 text-sm font-bold text-primary">Về Kho tổng</a></div><div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]"><section className="space-y-4"><div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"><form onSubmit={startSearch} className="flex min-w-0 flex-1 gap-2"><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={`Tìm ${itemLabel.toLowerCase()}...`} aria-label={`Tìm ${itemLabel.toLowerCase()}`} className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm" /><button className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">Tìm</button></form><select value={inventoryFilter} onChange={(event) => { const next = event.target.value as InventoryFilter; setInventoryFilter(next); void loadItems(search, next); }} aria-label="Lọc trạng thái tồn kho" className="h-10 rounded-full border border-border bg-background px-3 text-sm"><option value="all">{filterLabel.all}</option><option value="IN_STOCK">{filterLabel.IN_STOCK}</option><option value="LOW_STOCK">{filterLabel.LOW_STOCK}</option><option value="OUT_OF_STOCK">{filterLabel.OUT_OF_STOCK}</option><option value="ARCHIVED">{filterLabel.ARCHIVED}</option></select></div>{loading ? <div className="rounded-2xl bg-surface p-8 text-sm text-muted-foreground">Đang tải kho...</div> : items.length === 0 ? <div className="rounded-2xl bg-surface p-8 text-sm text-muted-foreground">Chưa có {itemLabel.toLowerCase()} phù hợp. Hãy thêm item đầu tiên ở bên phải.</div> : <div className="overflow-hidden rounded-2xl border border-border bg-surface">{items.map((item) => <div key={item.id} className={`grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center ${selectedId === item.id ? "bg-[#f3f6ee]" : ""}`}><button onClick={() => void loadHistory(item.id)} className="min-w-0 text-left"><strong className="block truncate font-display text-xl">{item.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.unit} · Đang có {item.quantity_on_hand} · Đã giữ {item.quantity_reserved} · Khả dụng <b className="text-foreground">{item.available_quantity}</b>{!item.is_active && " · Đã lưu trữ"}</span></button><span className={`justify-self-start rounded-full px-3 py-1 text-xs font-bold sm:justify-self-auto ${item.availability_status === "OUT_OF_STOCK" ? "bg-[#fae8e4] text-danger" : item.availability_status === "LOW_STOCK" ? "bg-[#fff0da] text-foreground" : "bg-[#e4ecdf] text-primary"}`}>{statusLabel[item.availability_status]}</span><div className="flex flex-wrap gap-2 justify-self-start sm:justify-self-auto"><button onClick={() => startEdit(item)} className="rounded-full border border-border px-3 py-2 text-xs font-bold text-primary">Sửa</button><button onClick={() => void setItemActive(item, !item.is_active)} disabled={submitting} className="rounded-full border border-border px-3 py-2 text-xs font-bold text-primary disabled:opacity-50">{item.is_active ? "Lưu trữ" : "Khôi phục"}</button><button onClick={() => void deleteItem(item)} disabled={submitting} className="rounded-full border border-[#e7b8af] px-3 py-2 text-xs font-bold text-danger disabled:opacity-50">Xóa</button></div></div>)}</div>}{selectedItem && <div className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Nhập / Xuất / Điều chỉnh</p><h3 className="mt-1 font-display text-2xl">{selectedItem.name}</h3></div><button onClick={() => setSelectedId(null)} className="text-sm font-bold text-muted-foreground">Đóng</button></div><form onSubmit={submitTransaction} className="mt-4 grid gap-3 sm:grid-cols-2"><select value={transactionType} onChange={(event) => setTransactionType(event.target.value as TransactionType)} aria-label="Loại giao dịch kho" className="h-11 rounded-xl border border-border bg-background px-3 text-sm"><option value="import">Nhập kho (+)</option><option value="export">Xuất kho (-)</option><option value="damaged">Hư hao (-)</option><option value="adjustment">Điều chỉnh (+ / -)</option></select><input type="number" required value={quantityChange} onChange={(event) => setQuantityChange(event.target.value)} placeholder={transactionType === "adjustment" ? "Số lượng (+ hoặc -)" : "Số lượng"} className="h-11 rounded-xl border border-border bg-background px-3 text-sm" /><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Lý do / ghi chú" className="h-11 rounded-xl border border-border bg-background px-3 text-sm sm:col-span-2" /><button disabled={submitting} className="rounded-full bg-primary px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-2">{submitting ? "Đang ghi..." : "Ghi nhận thay đổi"}</button></form><div className="mt-6"><h4 className="text-sm font-bold">Lịch sử gần đây</h4>{transactions.length ? <div className="mt-3 space-y-3">{transactions.map((transaction) => <div key={transaction.id} className="flex flex-wrap justify-between gap-3 text-xs"><span className="text-muted-foreground">{new Date(transaction.created_at).toLocaleString("vi-VN")} · {transaction.transaction_type} · {transaction.reason || "Không có lý do"}{transaction.quantity_before !== null && transaction.quantity_after !== null ? ` · ${transaction.quantity_before} → ${transaction.quantity_after}` : ""}</span><strong className={transaction.quantity_change >= 0 ? "text-primary" : "text-danger"}>{transaction.quantity_change > 0 ? "+" : ""}{transaction.quantity_change}</strong></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Chưa có giao dịch.</p>}</div></div>}</section><aside className="h-fit rounded-2xl border border-border bg-surface p-5"><h2 className="font-display text-2xl">{editingId ? `Sửa ${itemLabel.toLowerCase()}` : `Thêm ${itemLabel.toLowerCase()}`}</h2><form onSubmit={submitItem} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Tên {itemLabel.toLowerCase()}<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder={inventoryType === "flower" ? "Ví dụ: Hoa hồng đỏ" : "Ví dụ: Giấy gói kraft"} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="block text-sm font-semibold">Đơn vị<select required value={unitId} onChange={(event) => setUnitId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="" disabled>Chọn đơn vị</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><div className="flex gap-2"><input value={newUnitName} onChange={(event) => setNewUnitName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addUnit(); } }} placeholder="Thêm đơn vị mới" maxLength={30} className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm" /><button type="button" onClick={() => void addUnit()} disabled={unitSubmitting} className="rounded-xl border border-border px-3 text-xs font-bold text-primary disabled:opacity-50">Thêm</button></div><label className="block text-sm font-semibold">Ngưỡng sắp hết<input required type="number" min="0" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>{!editingId && <label className="block text-sm font-semibold">Tồn đầu kỳ<input required type="number" min="0" value={initialQuantity} onChange={(event) => setInitialQuantity(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>}<div className="flex gap-2"><button disabled={submitting || !unitId} className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{submitting ? "Đang lưu..." : editingId ? "Lưu thay đổi" : `Thêm ${itemLabel.toLowerCase()}`}</button><button type="button" onClick={resetForm} disabled={submitting} className="rounded-full border border-border px-4 py-3 text-sm font-bold disabled:opacity-50">{editingId ? "Hủy" : "Đặt lại"}</button></div></form><p className="mt-5 text-xs leading-5 text-muted-foreground">Đơn vị được quản lý trong database và phân loại theo {inventoryType === "flower" ? "Kho Hoa" : "Kho Phụ kiện"}. Mọi thay đổi số lượng đều tạo lịch sử transaction.</p></aside></div></section></main>;
}
