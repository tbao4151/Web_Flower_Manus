"use client";

import { FormEvent, useEffect, useState } from "react";

type Kind = "categories" | "tones" | "occasions";
type Item = { id: string; name: string; slug: string; is_active: boolean; display_order: number };
const labels: Record<Kind, string> = { categories: "Loại hoa", tones: "Tone màu", occasions: "Dịp tặng" };

export default function TaxonomyManager({ kind }: { kind: Kind }) {
  const [items, setItems] = useState<Item[]>([]); const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  async function load() { const response = await fetch("/api/admin/taxonomies"); const result = await response.json().catch(() => ({})); if (!response.ok) { setError(result.error || "Không thể tải dữ liệu."); } else setItems(result[kind] || []); setLoading(false); }
  // The page is intentionally hydrated from the server-authorized endpoint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Async server data is intentionally loaded after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [kind]);
  async function save(event: FormEvent) { event.preventDefault(); setError(""); const response = await fetch("/api/admin/taxonomies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, name, slug }) }); const result = await response.json().catch(() => ({})); if (!response.ok) setError(result.error || "Không thể lưu."); else { setName("");; setSlug(""); await load(); } }
  async function hide(id: string) { const response = await fetch("/api/admin/taxonomies", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id }) }); if (response.ok) await load(); else setError("Không thể ẩn taxonomy."); }
  return <section className="mt-7 max-w-3xl rounded-[24px] border border-border bg-surface p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Catalog taxonomy</p><h1 className="mt-2 font-display text-4xl">{labels[kind]}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Quản lý taxonomy độc lập với sản phẩm. Xoá trên giao diện chỉ ẩn để không phá lịch sử đơn hàng.</p><form onSubmit={save} className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3" placeholder={`Tên ${labels[kind].toLowerCase()}`} required /><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="h-11 rounded-xl border border-border bg-background px-3" placeholder="slug-khong-dau" required /><button className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white">Thêm</button></form>{error && <p role="alert" className="mt-4 rounded-xl bg-[#fae8e4] p-3 text-sm text-danger">{error}</p>}{loading ? <p className="mt-6 text-sm text-muted-foreground">Đang tải...</p> : <div className="mt-6 divide-y divide-border rounded-2xl border border-border">{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.slug}</p></div>{item.is_active ? <button onClick={() => hide(item.id)} className="rounded-full border border-border px-3 py-2 text-xs font-bold hover:border-danger hover:text-danger">Ẩn</button> : <span className="rounded-full bg-background px-3 py-2 text-xs font-bold text-muted-foreground">Đã ẩn</span>}</div>)}{!items.length && <p className="p-5 text-sm text-muted-foreground">Chưa có dữ liệu.</p>}</div>}</section>;
}
