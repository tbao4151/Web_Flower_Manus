"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Save, Trash2, X } from "lucide-react";

type Kind = "productTypes" | "categories" | "tones" | "occasions";
type Item = { id: string; name: string; slug: string; is_active: boolean; display_order: number; usage_count?: number };
type Group = { kind: Kind; title: string; description: string };
type Toast = { type: "success" | "error"; message: string };
type PendingDelete = { kind: Kind; item: Item };

const groups: Group[] = [
  { kind: "productTypes", title: "Dạng sản phẩm", description: "Chỉ gồm các dạng sản phẩm shop đang kinh doanh: Bó hoa và Giỏ hoa. Khi xoá dạng đang được dùng, Admin phải chuyển sản phẩm sang dạng thay thế." },
  { kind: "categories", title: "Loại hoa", description: "Gán nhiều loại hoa cho một sản phẩm. Ẩn vẫn giữ nguyên quan hệ; xoá có sử dụng sẽ yêu cầu xác nhận gỡ liên kết." },
  { kind: "tones", title: "Tone màu", description: "Quản lý tone màu dùng trong bộ lọc và form sản phẩm. Không tự động thay đổi sản phẩm khi ẩn hoặc xoá." },
  { kind: "occasions", title: "Dịp tặng", description: "Quản lý slug, trạng thái hiển thị và thứ tự dịp tặng. Xoá liên kết là thao tác destructive riêng." },
];

const kindTitle = (kind: Kind) => groups.find((group) => group.kind === kind)?.title || "phân loại";

export default function ClassificationAndFilters() {
  const [data, setData] = useState<Record<Kind, Item[]>>({ productTypes: [], categories: [], tones: [], occasions: [] });
  const [editing, setEditing] = useState<{ kind: Kind; id?: string; name: string; slug: string; isActive: boolean; displayOrder: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [openActions, setOpenActions] = useState<string | null>(null);
  const [priceMax, setPriceMax] = useState("");
  const [priceStep, setPriceStep] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [taxonomyResponse, settingsResponse] = await Promise.all([fetch("/api/admin/taxonomies", { cache: "no-store" }), fetch("/api/admin/settings", { cache: "no-store" })]);
      const taxonomyResult = await taxonomyResponse.json().catch(() => ({}));
      const settingsResult = await settingsResponse.json().catch(() => ({}));
      if (!taxonomyResponse.ok) throw new Error(taxonomyResult.error || "Không thể tải phân loại.");
      setData({ productTypes: taxonomyResult.productTypes || [], categories: taxonomyResult.categories || [], tones: taxonomyResult.tones || [], occasions: taxonomyResult.occasions || [] });
      const catalog = (settingsResult.settings || []).find((item: { key?: string }) => item.key === "catalog_filters");
      if (catalog?.value_json) {
        setPriceMax(String(catalog.value_json.price_max_vnd || ""));
        setPriceStep(String(catalog.value_json.price_step_vnd || ""));
      }
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu quản trị.");
    } finally {
      setLoading(false);
    }
  }

  // Data is intentionally hydrated after mount from the server-authorized admin endpoint.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const beginCreate = (kind: Kind) => setEditing({ kind, name: "", slug: "", isActive: true, displayOrder: (data[kind].at(-1)?.display_order || 0) + 10 });
  const beginEdit = (kind: Kind, item: Item) => setEditing({ kind, id: item.id, name: item.name, slug: item.slug, isActive: item.is_active, displayOrder: item.display_order });
  const apiError = (result: unknown, fallback = "Không thể lưu thay đổi.") => typeof result === "object" && result && typeof (result as { error?: unknown }).error === "string" ? String((result as { error: string }).error) : fallback;
  const replacementOptions = data.productTypes.filter((item) => item.is_active && item.id !== pendingDelete?.item.id);
  const usedProducts = pendingDelete?.item.usage_count || 0;

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError("");
    const response = await fetch("/api/admin/taxonomies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: editing.kind, id: editing.id, name: editing.name, slug: editing.slug, isActive: editing.isActive, displayOrder: editing.displayOrder }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setError(apiError(result)); return; }
    setEditing(null); setToast({ type: "success", message: "Đã lưu thay đổi phân loại." }); await load();
  }

  async function toggleActive(kind: Kind, item: Item) {
    setOpenActions(null); setSaving(true); setError("");
    const response = await fetch("/api/admin/taxonomies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id: item.id, name: item.name, slug: item.slug, isActive: !item.is_active, displayOrder: item.display_order }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setToast({ type: "error", message: apiError(result, "Không thể cập nhật trạng thái.") }); return; }
    await load();
    setToast({ type: "success", message: item.is_active ? `Đã ẩn ${item.name}. Quan hệ sản phẩm vẫn được giữ.` : `Đã hiện ${item.name}.` });
  }

  async function move(kind: Kind, index: number, direction: -1 | 1) {
    const items = [...data[kind]];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    setSaving(true); setError("");
    const responses = await Promise.all(items.map((item, nextIndex) => fetch("/api/admin/taxonomies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id: item.id, name: item.name, slug: item.slug, isActive: item.is_active, displayOrder: (nextIndex + 1) * 10 }) })));
    setSaving(false);
    if (responses.some((response) => !response.ok)) setToast({ type: "error", message: "Không thể lưu thứ tự mới." });
    else { await load(); setToast({ type: "success", message: "Đã cập nhật thứ tự hiển thị." }); }
  }

  function openDelete(kind: Kind, item: Item) {
    setOpenActions(null);
    setReplacementId("");
    setPendingDelete({ kind, item });
  }

  async function deleteItem(operation: "delete" | "unlink_delete" | "transfer_delete") {
    if (!pendingDelete) return;
    if (operation === "transfer_delete" && !replacementId) {
      setToast({ type: "error", message: "Hãy chọn dạng sản phẩm thay thế trước khi xoá." });
      return;
    }
    const target = pendingDelete;
    setSaving(true); setPendingDelete(null); setError("");
    const response = await fetch("/api/admin/taxonomies", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: target.kind, id: target.item.id, operation, replacementId: operation === "transfer_delete" ? replacementId : undefined }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setToast({ type: "error", message: apiError(result, "Không thể xoá phân loại. Dữ liệu chưa được thay đổi.") }); return; }
    await load();
    setToast({ type: "success", message: operation === "transfer_delete" ? `Đã chuyển liên kết và xoá ${target.item.name}.` : operation === "unlink_delete" ? `Đã gỡ liên kết và xoá ${target.item.name}.` : `Đã xoá ${target.item.name}.` });
  }

  async function savePriceConfig(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "catalog_filters", valueJson: { price_max_vnd: Number(priceMax), price_step_vnd: Number(priceStep) }, isPublic: true }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) setToast({ type: "error", message: apiError(result) });
    else setToast({ type: "success", message: "Đã lưu cấu hình bộ lọc giá." });
  }

  const activeCount = useMemo(() => groups.reduce((sum, group) => sum + data[group.kind].filter((item) => item.is_active).length, 0), [data]);
  return <main className="min-h-screen bg-background px-5 py-7 sm:px-8"><div className="mx-auto max-w-7xl">
    <section className="rounded-[24px] border border-border bg-surface p-5 sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Catalog control · {activeCount} mục active</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Phân loại &amp; Bộ lọc</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Đây là nguồn quản trị chính thức của metadata storefront. Ẩn luôn giữ record và quan hệ sản phẩm; xoá chỉ thực hiện khi an toàn hoặc sau xác nhận gỡ/chuyển liên kết.</p></section>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#fae8e4] p-3 text-sm text-danger">{error}</p>}
    {loading ? <p className="mt-7 text-sm text-muted-foreground">Đang tải dữ liệu quản trị...</p> : <div className="mt-7 grid gap-5 xl:grid-cols-2">{groups.map((group) => <section key={group.kind} className="rounded-[22px] border border-border bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Metadata</p><h2 className="mt-1 font-display text-3xl">{group.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{group.description}</p></div><button type="button" onClick={() => beginCreate(group.kind)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"><Plus size={15} /> Thêm</button></div><div className="mt-5 divide-y divide-border rounded-2xl border border-border">{data[group.kind].map((item, index) => <div key={item.id} className="flex items-center gap-2 p-3 sm:gap-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.slug} · thứ tự {item.display_order} · {item.is_active ? "Đang dùng" : "Đã ẩn"} · {item.usage_count || 0} sản phẩm</p></div><button type="button" onClick={() => void move(group.kind, index, -1)} disabled={index === 0 || saving} className="hidden h-10 w-10 items-center justify-center rounded-full border border-border disabled:opacity-40 sm:flex" aria-label={`Đưa ${item.name} lên`}><ChevronUp size={16} /></button><button type="button" onClick={() => void move(group.kind, index, 1)} disabled={index === data[group.kind].length - 1 || saving} className="hidden h-10 w-10 items-center justify-center rounded-full border border-border disabled:opacity-40 sm:flex" aria-label={`Đưa ${item.name} xuống`}><ChevronDown size={16} /></button><div className="relative"><button type="button" onClick={() => setOpenActions(openActions === item.id ? null : item.id)} disabled={saving} className="flex h-11 w-11 items-center justify-center rounded-full border border-border disabled:opacity-50" aria-label={`Thao tác với ${item.name}`} aria-haspopup="menu" aria-expanded={openActions === item.id}><MoreHorizontal size={18} /></button>{openActions === item.id && <div role="menu" className="absolute right-0 top-12 z-20 min-w-44 rounded-2xl border border-border bg-surface p-1.5 shadow-xl"><button type="button" role="menuitem" onClick={() => { setOpenActions(null); beginEdit(group.kind, item); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-background"><Pencil size={15} /> Sửa</button><button type="button" role="menuitem" onClick={() => void toggleActive(group.kind, item)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold hover:bg-background">{item.is_active ? <EyeOff size={15} /> : <Eye size={15} />} {item.is_active ? "Ẩn" : "Hiện"}</button><button type="button" role="menuitem" onClick={() => openDelete(group.kind, item)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-danger hover:bg-[#fae8e4]"><Trash2 size={15} /> Xóa</button></div>}</div></div>)}{!data[group.kind].length && <p className="p-4 text-sm text-muted-foreground">Chưa có dữ liệu.</p>}</div></section>)}</div>}
    <section className="mt-5 rounded-[22px] border border-primary/25 bg-[#f3f7ef] p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Storefront configuration</p><h2 className="mt-1 font-display text-3xl">Bộ lọc giá</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Bộ lọc giá là cấu hình, không có thao tác xoá. Storefront sẽ đọc giá trị mới ở lần tải catalog kế tiếp.</p><form onSubmit={savePriceConfig} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold">Giá tối đa (VND)<input required type="number" min="1" step="1" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Bước nhảy (VND)<input required type="number" min="1" step="1" value={priceStep} onChange={(event) => setPriceStep(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Save size={16} /> Lưu bộ lọc giá</button></form></section>
    {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-3 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="taxonomy-editor-title" className="w-full max-w-xl rounded-[24px] border border-border bg-surface p-5 shadow-xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Chỉnh metadata</p><h2 id="taxonomy-editor-title" className="mt-1 font-display text-3xl">{kindTitle(editing.kind)}</h2></div><button type="button" onClick={() => setEditing(null)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Đóng"><X size={17} /></button></div><form onSubmit={saveItem} className="mt-5 grid gap-4"><label className="text-sm font-semibold">Tên hiển thị<input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Slug<input required pattern="[a-z0-9-]+" value={editing.slug} onChange={(event) => setEditing({ ...editing, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Thứ tự<input required type="number" min="0" value={editing.displayOrder} onChange={(event) => setEditing({ ...editing, displayOrder: Number(event.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-primary" /> Hiển thị trên storefront</label><div className="flex flex-wrap gap-3"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Save size={16} /> Lưu</button><button type="button" onClick={() => setEditing(null)} className="rounded-full border border-border px-5 py-3 text-sm font-bold">Huỷ</button></div></form></section></div>}
    {pendingDelete && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 p-3 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="taxonomy-delete-title" className="w-full max-w-lg rounded-[24px] border border-border bg-surface p-5 shadow-xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-danger">Thao tác không thể hoàn tác</p><h2 id="taxonomy-delete-title" className="mt-1 font-display text-3xl">Xóa {kindTitle(pendingDelete.kind)}</h2></div><button type="button" onClick={() => setPendingDelete(null)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Đóng hộp thoại xoá"><X size={17} /></button></div>{usedProducts === 0 ? <><p className="mt-5 text-sm leading-7">Bạn có chắc muốn xóa “{pendingDelete.item.name}”? Hành động này không thể hoàn tác.</p><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setPendingDelete(null)} className="min-h-11 rounded-full border border-border px-5 py-3 text-sm font-bold">Hủy</button><button type="button" onClick={() => void deleteItem("delete")} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-danger px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Trash2 size={16} /> Xóa vĩnh viễn</button></div></> : pendingDelete.kind === "productTypes" ? <><p className="mt-5 text-sm leading-7">Dạng sản phẩm này đang được sử dụng bởi <strong>{usedProducts} sản phẩm</strong>. Hãy chọn dạng thay thế trước khi xóa.</p><label className="mt-5 block text-sm font-semibold">Chuyển các sản phẩm sang:<select value={replacementId} onChange={(event) => setReplacementId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal"><option value="">Chọn dạng sản phẩm</option>{replacementOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{replacementOptions.length === 0 && <p className="mt-3 text-sm text-danger">Cần có ít nhất một dạng sản phẩm active khác để chuyển liên kết.</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setPendingDelete(null)} className="min-h-11 rounded-full border border-border px-5 py-3 text-sm font-bold">Hủy</button><button type="button" onClick={() => void deleteItem("transfer_delete")} disabled={saving || !replacementId} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-danger px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Check size={16} /> Chuyển liên kết &amp; Xóa</button></div></> : <><p className="mt-5 text-sm leading-7">“{pendingDelete.item.name}” hiện đang được sử dụng bởi <strong>{usedProducts} sản phẩm</strong>.</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Bạn có thể chỉ ẩn mục này để giữ nguyên toàn bộ quan hệ, hoặc gỡ tất cả liên kết trước khi xóa. Không có Product nào bị xóa.</p><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setPendingDelete(null)} className="min-h-11 rounded-full border border-border px-5 py-3 text-sm font-bold">Hủy</button><button type="button" onClick={() => { const target = pendingDelete; setPendingDelete(null); void toggleActive(target.kind, target.item); }} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold"><EyeOff size={16} /> Chỉ ẩn</button><button type="button" onClick={() => void deleteItem("unlink_delete")} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-danger px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Trash2 size={16} /> Hủy liên kết &amp; Xóa</button></div></> }</section></div>}
    {toast && <div role={toast.type === "error" ? "alert" : "status"} aria-live={toast.type === "error" ? "assertive" : "polite"} className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${toast.type === "error" ? "bg-danger" : "bg-primary"}`}>{toast.message}</div>}
  </div></main>;
}
