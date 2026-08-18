"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Save, X } from "lucide-react";

type Kind = "productTypes" | "categories" | "tones" | "occasions";
type Item = { id: string; name: string; slug: string; is_active: boolean; display_order: number };
type Group = { kind: Kind; title: string; description: string };
const groups: Group[] = [
  { kind: "productTypes", title: "Loại hoa", description: "Chỉ gồm các loại sản phẩm shop đang kinh doanh; sản phẩm đang dùng loại sẽ được bảo toàn khi ẩn." },
  { kind: "categories", title: "Danh mục", description: "Gán nhiều danh mục cho một sản phẩm và chỉ hiển thị danh mục active trên storefront." },
  { kind: "tones", title: "Tone màu", description: "Quản lý tone màu dùng trong bộ lọc và form sản phẩm." },
  { kind: "occasions", title: "Dịp tặng", description: "Quản lý slug, trạng thái hiển thị và thứ tự dịp tặng." },
];

export default function ClassificationAndFilters() {
  const [data, setData] = useState<Record<Kind, Item[]>>({ productTypes: [], categories: [], tones: [], occasions: [] });
  const [editing, setEditing] = useState<{ kind: Kind; id?: string; name: string; slug: string; isActive: boolean; displayOrder: number } | null>(null);
  const [priceMax, setPriceMax] = useState("");
  const [priceStep, setPriceStep] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    const [taxonomyResponse, settingsResponse] = await Promise.all([fetch("/api/admin/taxonomies", { cache: "no-store" }), fetch("/api/admin/settings", { cache: "no-store" })]);
    const taxonomyResult = await taxonomyResponse.json().catch(() => ({}));
    const settingsResult = await settingsResponse.json().catch(() => ({}));
    if (!taxonomyResponse.ok) setError(taxonomyResult.error || "Không thể tải phân loại.");
    else setData({ productTypes: taxonomyResult.productTypes || [], categories: taxonomyResult.categories || [], tones: taxonomyResult.tones || [], occasions: taxonomyResult.occasions || [] });
    const catalog = (settingsResult.settings || []).find((item: { key?: string }) => item.key === "catalog_filters");
    if (catalog?.value_json) { setPriceMax(String(catalog.value_json.price_max_vnd || "")); setPriceStep(String(catalog.value_json.price_step_vnd || "")); }
    setLoading(false);
  }

  // Data is intentionally hydrated after mount from the server-authorized admin endpoint.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);

  const beginCreate = (kind: Kind) => setEditing({ kind, name: "", slug: "", isActive: true, displayOrder: (data[kind].at(-1)?.display_order || 0) + 10 });
  const beginEdit = (kind: Kind, item: Item) => setEditing({ kind, id: item.id, name: item.name, slug: item.slug, isActive: item.is_active, displayOrder: item.display_order });
  const apiError = (result: unknown) => typeof result === "object" && result && typeof (result as { error?: unknown }).error === "string" ? String((result as { error: string }).error) : "Không thể lưu thay đổi.";

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/taxonomies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: editing.kind, id: editing.id, name: editing.name, slug: editing.slug, isActive: editing.isActive, displayOrder: editing.displayOrder }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setError(apiError(result)); return; }
    setEditing(null); setNotice("Đã lưu thay đổi phân loại."); await load();
  }

  async function move(kind: Kind, index: number, direction: -1 | 1) {
    const items = [...data[kind]];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    setSaving(true); setError("");
    const responses = await Promise.all(items.map((item, nextIndex) => fetch("/api/admin/taxonomies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id: item.id, name: item.name, slug: item.slug, isActive: item.is_active, displayOrder: (nextIndex + 1) * 10 }) })));
    setSaving(false);
    if (responses.some((response) => !response.ok)) setError("Không thể lưu thứ tự mới."); else { setNotice("Đã cập nhật thứ tự hiển thị."); await load(); }
  }

  async function savePriceConfig(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: "catalog_filters", valueJson: { price_max_vnd: Number(priceMax), price_step_vnd: Number(priceStep) }, isPublic: true }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) setError(apiError(result)); else setNotice("Đã lưu cấu hình bộ lọc giá. Storefront sẽ đọc giá trị mới ở lần tải catalog kế tiếp.");
  }

  const activeCount = useMemo(() => groups.reduce((sum, group) => sum + data[group.kind].filter((item) => item.is_active).length, 0), [data]);
  return <main className="min-h-screen bg-background px-5 py-7 sm:px-8"><div className="mx-auto max-w-7xl"><section className="rounded-[24px] border border-border bg-surface p-5 sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Catalog control · {activeCount} mục active</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Phân loại &amp; Bộ lọc</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">Đây là nguồn quản trị chính thức của metadata storefront. Mọi thay đổi được kiểm tra ở server, lưu trong PostgreSQL và không hard-delete dữ liệu đang được sản phẩm hoặc đơn hàng tham chiếu.</p></section>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`mt-5 rounded-xl p-3 text-sm ${error ? "bg-[#fae8e4] text-danger" : "bg-[#e4ecdf] text-primary"}`}>{error || notice}</p>}
      {loading ? <p className="mt-7 text-sm text-muted-foreground">Đang tải dữ liệu quản trị...</p> : <div className="mt-7 grid gap-5 xl:grid-cols-2">{groups.map((group) => <section key={group.kind} className="rounded-[22px] border border-border bg-surface p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Metadata</p><h2 className="mt-1 font-display text-3xl">{group.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{group.description}</p></div><button type="button" onClick={() => beginCreate(group.kind)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"><Plus size={15} /> Thêm</button></div><div className="mt-5 divide-y divide-border rounded-2xl border border-border">{data[group.kind].map((item, index) => <div key={item.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.slug} · thứ tự {item.display_order} · {item.is_active ? "Đang dùng" : "Đã ẩn"}</p></div><button type="button" onClick={() => void move(group.kind, index, -1)} disabled={index === 0 || saving} className="flex h-9 w-9 items-center justify-center rounded-full border border-border disabled:opacity-40" aria-label={`Đưa ${item.name} lên`}><ChevronUp size={16} /></button><button type="button" onClick={() => void move(group.kind, index, 1)} disabled={index === data[group.kind].length - 1 || saving} className="flex h-9 w-9 items-center justify-center rounded-full border border-border disabled:opacity-40" aria-label={`Đưa ${item.name} xuống`}><ChevronDown size={16} /></button><button type="button" onClick={() => beginEdit(group.kind, item)} className="flex h-9 w-9 items-center justify-center rounded-full border border-border" aria-label={`Sửa ${item.name}`}><Pencil size={15} /></button></div>)}{!data[group.kind].length && <p className="p-4 text-sm text-muted-foreground">Chưa có dữ liệu.</p>}</div></section>)}</div>}
      <section className="mt-5 rounded-[22px] border border-primary/25 bg-[#f3f7ef] p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Storefront configuration</p><h2 className="mt-1 font-display text-3xl">Bộ lọc giá</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Giá trị này được đọc từ database để storefront cập nhật mà không cần sửa code hoặc redeploy.</p><form onSubmit={savePriceConfig} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-semibold">Giá tối đa (VND)<input required type="number" min="1" step="1" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Bước nhảy (VND)<input required type="number" min="1" step="1" value={priceStep} onChange={(event) => setPriceStep(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Save size={16} /> Lưu bộ lọc giá</button></form></section>
      {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-3 sm:items-center"><section role="dialog" aria-modal="true" aria-labelledby="taxonomy-editor-title" className="w-full max-w-xl rounded-[24px] border border-border bg-surface p-5 shadow-xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Chỉnh metadata</p><h2 id="taxonomy-editor-title" className="mt-1 font-display text-3xl">{groups.find((group) => group.kind === editing.kind)?.title}</h2></div><button type="button" onClick={() => setEditing(null)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Đóng"><X size={17} /></button></div><form onSubmit={saveItem} className="mt-5 grid gap-4"><label className="text-sm font-semibold">Tên hiển thị<input required value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Slug<input required pattern="[a-z0-9-]+" value={editing.slug} onChange={(event) => setEditing({ ...editing, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Thứ tự<input required type="number" min="0" value={editing.displayOrder} onChange={(event) => setEditing({ ...editing, displayOrder: Number(event.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} className="h-4 w-4 accent-primary" /> Hiển thị trên storefront</label><div className="flex flex-wrap gap-3"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Save size={16} /> Lưu</button><button type="button" onClick={() => setEditing(null)} className="rounded-full border border-border px-5 py-3 text-sm font-bold">Huỷ</button></div></form></section></div>}
    </div></main>;
}
