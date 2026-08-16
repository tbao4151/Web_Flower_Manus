"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, ImagePlus, Pencil, Plus, RotateCcw, Save, Search, Trash2, Upload, X } from "lucide-react";

type Status = "draft" | "published" | "hidden" | "archived";
type ProductType = "bouquet" | "basket";
type ImageItem = { id: string; storage_path: string; public_url: string; alt_text: string; display_order: number; is_cover: boolean; mime_type?: string };
type Relation = { category_id?: string; tone_id?: string; occasion_id?: string };
type Product = { id: string; sku: string; slug: string; name: string; product_type: ProductType; price_vnd: number; sale_price_vnd: number | null; description: string; composition: string | null; featured: boolean; status: Status; archived_at: string | null; sale_mode?: "ready_stock" | "preorder"; preorder_min_hours?: number | null; show_when_out_of_stock?: boolean; product_images: ImageItem[]; product_categories: Relation[]; product_tones: Relation[]; product_occasions: Relation[] };
type Taxonomy = { id: string; name: string; slug: string; is_active: boolean };
type InventoryOption = { id: string; name: string; unit: string; is_active: boolean };
type RecipeRow = { inventoryItemId: string; quantityRequired: string };
type FormState = { sku: string; slug: string; name: string; productType: ProductType; priceVnd: string; salePriceVnd: string; description: string; composition: string; featured: boolean; status: Status; saleMode: "ready_stock" | "preorder"; preorderMinHours: string; showWhenOutOfStock: boolean; categoryIds: string[]; toneIds: string[]; occasionIds: string[] };

const blank: FormState = { sku: "", slug: "", name: "", productType: "bouquet", priceVnd: "", salePriceVnd: "", description: "", composition: "", featured: false, status: "draft", saleMode: "ready_stock", preorderMinHours: "", showWhenOutOfStock: false, categoryIds: [], toneIds: [], occasionIds: [] };
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const statusLabel: Record<Status, string> = { draft: "Bản nháp", published: "Đang hiển thị", hidden: "Đã ẩn", archived: "Đã lưu trữ" };

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [taxonomies, setTaxonomies] = useState<{ categories: Taxonomy[]; tones: Taxonomy[]; occasions: Taxonomy[] }>({ categories: [], tones: [], occasions: [] });
  const [form, setForm] = useState<FormState>(blank);
  const [selected, setSelected] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | Status>("all");
  const [type, setType] = useState<"all" | ProductType>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inventoryItems, setInventoryItems] = useState<InventoryOption[]>([]);
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  const [availableQuantity, setAvailableQuantity] = useState<number | null>(null);

  async function loadProducts(nextSelectedId?: string) {
    const params = new URLSearchParams({ pageSize: "100" });
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    const response = await fetch(`/api/ops/products?${params.toString()}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Không thể tải sản phẩm."); return; }
    const loaded = (result.products || []) as Product[];
    setProducts(loaded);
    const id = nextSelectedId || selected?.id;
    if (id) setSelected(loaded.find((item) => item.id === id) || null);
  }

  async function loadTaxonomies() {
    const response = await fetch("/api/admin/taxonomies", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setTaxonomies({ categories: result.categories || [], tones: result.tones || [], occasions: result.occasions || [] });
  }

  async function loadInventoryEditor(productId?: string) {
    const inventoryResponse = await fetch("/api/admin/inventory", { cache: "no-store" });
    const inventoryResult = await inventoryResponse.json().catch(() => ({}));
    if (inventoryResponse.ok) setInventoryItems((inventoryResult.inventoryItems || []) as InventoryOption[]);
    if (!productId) { setRecipe([]); setAvailableQuantity(null); return; }
    const [recipeResponse, availabilityResponse] = await Promise.all([fetch(`/api/admin/products/${productId}/recipe`, { cache: "no-store" }), fetch(`/api/admin/products/${productId}/availability`, { cache: "no-store" })]);
    const recipeResult = await recipeResponse.json().catch(() => ({}));
    const availabilityResult = await availabilityResponse.json().catch(() => ({}));
    if (recipeResponse.ok) setRecipe((recipeResult.ingredients || []).map((item: { inventory_item_id: string; quantity_required: number }) => ({ inventoryItemId: item.inventory_item_id, quantityRequired: String(item.quantity_required) })));
    if (availabilityResponse.ok) setAvailableQuantity(Number(availabilityResult.availableQuantity ?? 0));
  }

  // Product data is intentionally loaded after mount and filter changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadProducts(); }, [search, status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadTaxonomies(); }, []);
  // Recipe and availability are synchronized with the selected product and protected Admin APIs.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (showEditor) void loadInventoryEditor(selected?.id); }, [selected?.id, showEditor]);

  const visibleProducts = useMemo(() => products.filter((product) => (type === "all" || product.product_type === type) && (!featuredOnly || product.featured)), [featuredOnly, products, type]);

  const openNew = () => { setSelected(null); setForm(blank); setRecipe([]); setAvailableQuantity(null); setShowEditor(true); setError(""); setNotice(""); };
  const openEdit = (product: Product) => {
    setSelected(product);
    setForm({ sku: product.sku, slug: product.slug, name: product.name, productType: product.product_type, priceVnd: String(product.price_vnd), salePriceVnd: product.sale_price_vnd == null ? "" : String(product.sale_price_vnd), description: product.description || "", composition: product.composition || "", featured: product.featured, status: product.status, saleMode: product.sale_mode || "ready_stock", preorderMinHours: product.preorder_min_hours == null ? "" : String(product.preorder_min_hours), showWhenOutOfStock: product.show_when_out_of_stock === true, categoryIds: product.product_categories.map((item) => String(item.category_id)), toneIds: product.product_tones.map((item) => String(item.tone_id)), occasionIds: product.product_occasions.map((item) => String(item.occasion_id)) });
    setShowEditor(true); setError(""); setNotice("");
  };
  const closeEditor = () => { setShowEditor(false); setSelected(null); setError(""); setNotice(""); };
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleRelation = (key: "categoryIds" | "toneIds" | "occasionIds", id: string) => update(key, form[key].includes(id) ? form[key].filter((value) => value !== id) : [...form[key], id]);

  async function saveProduct(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const payload = { ...form, priceVnd: Number(form.priceVnd), salePriceVnd: form.salePriceVnd ? Number(form.salePriceVnd) : null, preorderMinHours: form.preorderMinHours ? Number(form.preorderMinHours) : null };
    const response = await fetch(selected ? "/api/ops/products" : "/api/ops/products", { method: selected ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(selected ? { id: selected.id, ...payload } : payload) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setError(result.error || "Không thể lưu sản phẩm."); return; }
    const id = result.product.id as string;
    setNotice("Đã lưu thông tin sản phẩm.");
    await loadProducts(id); setSelected((current) => current || result.product); setShowEditor(true); await loadInventoryEditor(id);
  }

  const addRecipeRow = () => setRecipe((current) => [...current, { inventoryItemId: "", quantityRequired: "1" }]);
  const updateRecipeRow = (index: number, key: keyof RecipeRow, value: string) => setRecipe((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const removeRecipeRow = (index: number) => setRecipe((current) => current.filter((_row, rowIndex) => rowIndex !== index));
  async function saveRecipe() {
    if (!selected) return;
    setError(""); setNotice("");
    const ingredients = recipe.filter((row) => row.inventoryItemId).map((row) => ({ inventoryItemId: row.inventoryItemId, quantityRequired: Number(row.quantityRequired) }));
    if (ingredients.some((row) => !Number.isInteger(row.quantityRequired) || row.quantityRequired < 1)) { setError("Mỗi nguyên liệu phải có định lượng là số nguyên dương."); return; }
    const response = await fetch(`/api/admin/products/${selected.id}/recipe`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ingredients }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Không thể lưu công thức."); return; }
    setNotice("Đã lưu công thức sản phẩm.");
    await loadInventoryEditor(selected.id);
  }

  async function lifecycle(product: Product, action: "hide" | "show" | "archive" | "restore" | "permanent") {
    const prompts = { hide: "Ẩn sản phẩm khỏi storefront? Sản phẩm vẫn giữ nguyên trong Admin.", show: "Hiển thị sản phẩm này trên storefront? Sản phẩm phải có ảnh cover hợp lệ.", archive: "Lưu trữ sản phẩm? Sản phẩm sẽ không còn hiển thị nhưng vẫn giữ nguyên dữ liệu.", restore: "Khôi phục sản phẩm về bản nháp?", permanent: `Bạn có chắc muốn xoá vĩnh viễn sản phẩm “${product.name}”? Hành động này không thể hoàn tác.` };
    if (!window.confirm(prompts[action])) return;
    setError("");
    const response = action === "permanent"
      ? await fetch(`/api/ops/products?id=${product.id}`, { method: "DELETE" })
      : await fetch("/api/ops/products", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: product.id, status: action === "hide" ? "hidden" : action === "show" ? "published" : action === "archive" ? "archived" : "draft" }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Không thể thay đổi trạng thái sản phẩm."); return; }
    setNotice(action === "permanent" ? "Đã xoá sản phẩm." : "Đã cập nhật trạng thái sản phẩm.");
    if (action === "permanent") closeEditor();
    await loadProducts();
  }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    if (!selected || !event.target.files?.length) return;
    setUploading(true); setError(""); setNotice("");
    const data = new FormData(); data.append("productId", selected.id); data.append("altText", selected.name); data.append("setCover", selected.product_images.length === 0 ? "true" : "false");
    Array.from(event.target.files).forEach((file) => data.append("files", file));
    const response = await fetch("/api/admin/images", { method: "POST", body: data });
    const result = await response.json().catch(() => ({}));
    setUploading(false); event.target.value = "";
    if (!response.ok) { setError(result.error || "Không thể tải ảnh."); return; }
    setNotice(`Đã tải ${result.images?.length || 0} ảnh lên Storage.`); await loadProducts(selected.id);
  }

  async function patchImage(image: ImageItem, values: Record<string, unknown>) {
    if (!selected) return;
    const response = await fetch("/api/admin/images", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: image.id, productId: selected.id, ...values }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Không thể cập nhật ảnh."); return; }
    await loadProducts(selected.id);
  }

  async function moveImage(index: number, direction: -1 | 1) {
    if (!selected) return;
    const images = [...selected.product_images].sort((a, b) => a.display_order - b.display_order);
    const other = images[index + direction]; if (!other) return;
    await patchImage(images[index], { displayOrder: other.display_order });
    await patchImage(other, { displayOrder: images[index].display_order });
    setNotice("Đã lưu thứ tự ảnh.");
  }

  async function removeImage(image: ImageItem) {
    if (!selected || !window.confirm("Xoá ảnh này khỏi sản phẩm và Storage?")) return;
    const response = await fetch("/api/admin/images", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: image.id, productId: selected.id }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Không thể xoá ảnh."); return; }
    setNotice("Đã xoá ảnh."); await loadProducts(selected.id);
  }

  const imageCount = selected?.product_images.length || 0;
  return <main className="min-h-screen bg-background px-4 py-5 sm:px-8 sm:py-7"><div className="mx-auto max-w-7xl"><section className="mt-6 rounded-[24px] border border-border bg-surface p-4 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Catalog control</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Sản phẩm</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Quản lý thông tin, hình ảnh, trạng thái hiển thị và lịch sử sản phẩm. Dữ liệu lưu trong PostgreSQL và ảnh trong Supabase Storage.</p></div><button onClick={openNew} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"><Plus size={17} /> Thêm sản phẩm</button></div>
      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto]"><label className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4"><Search size={16} className="text-muted-foreground" /><span className="sr-only">Tìm sản phẩm</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, SKU hoặc slug..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><select aria-label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value as "all" | Status)} className="min-h-11 rounded-full border border-border bg-background px-4 text-sm font-semibold"><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Lọc loại sản phẩm" value={type} onChange={(event) => setType(event.target.value as "all" | ProductType)} className="min-h-11 rounded-full border border-border bg-background px-4 text-sm font-semibold"><option value="all">Tất cả loại</option><option value="bouquet">Bó hoa</option><option value="basket">Giỏ hoa</option></select><label className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold"><input type="checkbox" checked={featuredOnly} onChange={(event) => setFeaturedOnly(event.target.checked)} className="h-4 w-4 accent-primary" /> Nổi bật</label></div>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${error ? "bg-[#fae8e4] text-danger" : "bg-[#e4ecdf] text-primary"}`}>{error || notice}</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-border bg-background"><div className="relative aspect-[4/3] bg-surface-muted">{product.product_images?.[0]?.public_url ? <img src={product.product_images[0].public_url} alt={product.product_images[0].alt_text || product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><ImagePlus size={28} /></div>}<span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-[11px] font-bold">{statusLabel[product.status]}</span></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl leading-tight">{product.name}</h2><p className="mt-1 text-xs text-muted-foreground">{product.sku} · {product.product_type === "bouquet" ? "Bó hoa" : "Giỏ hoa"}</p></div><p className="shrink-0 text-sm font-bold text-primary">{money(product.sale_price_vnd ?? product.price_vnd)}đ</p></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{product.description || "Chưa có mô tả."}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => openEdit(product)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"><Pencil size={14} /> Chỉnh sửa</button>{product.status === "published" ? <button onClick={() => void lifecycle(product, "hide")} className="min-h-10 rounded-full border border-border px-4 py-2 text-xs font-bold">Ẩn</button> : product.status === "hidden" ? <><button onClick={() => void lifecycle(product, "show")} className="min-h-10 rounded-full border border-primary px-4 py-2 text-xs font-bold text-primary">Hiển thị</button><button onClick={() => void lifecycle(product, "archive")} className="min-h-10 rounded-full border border-border px-4 py-2 text-xs font-bold">Lưu trữ</button></> : product.status === "archived" ? <button onClick={() => void lifecycle(product, "restore")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-bold"><RotateCcw size={14} /> Khôi phục</button> : <><button onClick={() => void lifecycle(product, "show")} className="min-h-10 rounded-full border border-primary px-4 py-2 text-xs font-bold text-primary">Hiển thị</button><button onClick={() => void lifecycle(product, "archive")} className="min-h-10 rounded-full border border-border px-4 py-2 text-xs font-bold">Lưu trữ</button></>}</div></div></article>)}</div>{!visibleProducts.length && <div className="mt-8 rounded-2xl bg-background p-10 text-center text-sm text-muted-foreground">Chưa có sản phẩm phù hợp.</div>}
    </section></div>
    {showEditor && <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/30 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="mx-auto max-w-5xl rounded-[28px] border border-border bg-surface p-5 shadow-xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{selected ? "Chỉnh sửa catalog" : "Sản phẩm mới"}</p><h2 id="product-editor-title" className="mt-2 font-display text-3xl sm:text-4xl">{selected?.name || "Thêm sản phẩm"}</h2></div><button onClick={closeEditor} className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Đóng trình chỉnh sửa"><X size={18} /></button></div>
      <form onSubmit={saveProduct} className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Tên sản phẩm<input required value={form.name} onChange={(event) => update("name", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">SKU<input required value={form.sku} onChange={(event) => update("sku", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Slug<input required pattern="[a-z0-9-]+" value={form.slug} onChange={(event) => update("slug", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Loại<select value={form.productType} onChange={(event) => update("productType", event.target.value as ProductType)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal"><option value="bouquet">Bó hoa</option><option value="basket">Giỏ hoa</option></select></label><label className="text-sm font-semibold">Giá gốc (VND)<input required type="number" min="0" value={form.priceVnd} onChange={(event) => update("priceVnd", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold">Giá sale (tuỳ chọn)<input type="number" min="0" value={form.salePriceVnd} onChange={(event) => update("salePriceVnd", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label><label className="text-sm font-semibold md:col-span-2">Mô tả chính thức<textarea value={form.description} onChange={(event) => update("description", event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-border bg-background p-3 font-normal" /></label><label className="text-sm font-semibold md:col-span-2">Thành phần hoa (tuỳ chọn)<textarea value={form.composition} onChange={(event) => update("composition", event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-border bg-background p-3 font-normal" /></label><label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.featured} onChange={(event) => update("featured", event.target.checked)} className="h-4 w-4 accent-primary" /> Đánh dấu nổi bật</label><label className="text-sm font-semibold">Cách bán<select value={form.saleMode} onChange={(event) => update("saleMode", event.target.value as FormState["saleMode"])} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal"><option value="ready_stock">Có sẵn</option><option value="preorder">Đặt trước</option></select></label>{form.saleMode === "preorder" && <label className="text-sm font-semibold">Đặt trước tối thiểu (giờ)<input required type="number" min="1" value={form.preorderMinHours} onChange={(event) => update("preorderMinHours", event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal" /></label>}<label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.showWhenOutOfStock} onChange={(event) => update("showWhenOutOfStock", event.target.checked)} className="h-4 w-4 accent-primary" /> Vẫn hiển thị khi hết hàng</label><label className="text-sm font-semibold">Trạng thái<select value={form.status} onChange={(event) => update("status", event.target.value as Status)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 font-normal"><option value="draft">Bản nháp</option><option value="published" disabled={!selected?.product_images?.length}>Đang hiển thị</option><option value="hidden">Đã ẩn</option><option value="archived">Đã lưu trữ</option></select></label>
        {([ ["categoryIds", "Danh mục", taxonomies.categories], ["toneIds", "Tone màu", taxonomies.tones], ["occasionIds", "Dịp tặng", taxonomies.occasions] ] as const).map(([key, label, items]) => <fieldset key={key} className="rounded-xl border border-border p-3"><legend className="px-1 text-xs font-bold uppercase tracking-[.12em] text-primary">{label}</legend><div className="mt-1 flex max-h-28 flex-wrap gap-2 overflow-y-auto">{items.filter((item) => item.is_active).map((item) => <label key={item.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${form[key].includes(item.id) ? "border-primary bg-[#e4ecdf] text-primary" : "border-border"}`}><input type="checkbox" className="sr-only" checked={form[key].includes(item.id)} onChange={() => toggleRelation(key, item.id)} />{item.name}</label>)}{!items.length && <span className="text-xs text-muted-foreground">Chưa có dữ liệu.</span>}</div></fieldset>)}
        <div className="flex flex-wrap gap-3 md:col-span-2"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"><Save size={16} />{saving ? "Đang lưu..." : "Lưu sản phẩm"}</button><button type="button" onClick={closeEditor} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold">Huỷ</button></div>
      </form>
      {selected && <section className="mt-8 border-t border-border pt-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">BOM / Recipe</p><h3 className="font-display text-3xl">Công thức sản phẩm</h3><p className="mt-1 text-sm text-muted-foreground">Chỉ Admin nhìn thấy. Khả dụng được tính tự động theo nguyên liệu hiện tại.</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Số lượng có thể làm</p><p className="font-display text-3xl text-primary">{availableQuantity === null ? "—" : availableQuantity}</p></div></div><div className="mt-5 space-y-3">{recipe.map((row, index) => <div key={`${row.inventoryItemId}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_130px_auto]"><select value={row.inventoryItemId} onChange={(event) => updateRecipeRow(index, "inventoryItemId", event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm"><option value="">Chọn nguyên liệu</option>{inventoryItems.filter((item) => item.is_active || item.id === row.inventoryItemId).map((item) => <option key={item.id} value={item.id} disabled={recipe.some((other, otherIndex) => otherIndex !== index && other.inventoryItemId === item.id)}>{item.name} ({item.unit})</option>)}</select><input type="number" min="1" step="1" value={row.quantityRequired} onChange={(event) => updateRecipeRow(index, "quantityRequired", event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm" placeholder="Định lượng" /><button type="button" onClick={() => removeRecipeRow(index)} className="flex h-11 items-center justify-center rounded-xl border border-danger px-4 text-danger" aria-label="Xóa nguyên liệu"><Trash2 size={15} /></button></div>)}<div className="flex flex-wrap gap-2"><button type="button" onClick={addRecipeRow} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-bold text-primary"><Plus size={15} /> Thêm nguyên liệu</button><button type="button" onClick={() => void saveRecipe()} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white"><Save size={15} /> Lưu công thức</button></div></div></section>}
      {selected && <section className="mt-8 border-t border-border pt-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Supabase Storage</p><h3 className="font-display text-3xl">Hình ảnh ({imageCount})</h3><p className="mt-1 text-sm text-muted-foreground">Ảnh đầu tiên là cover mặc định. Bạn có thể đổi cover, sắp xếp hoặc xoá từng ảnh.</p></div><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white"><Upload size={16} />{uploading ? "Đang tải..." : "Tải nhiều ảnh"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(event) => void uploadImages(event)} className="sr-only" /></label></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...selected.product_images].sort((a, b) => a.display_order - b.display_order).map((image, index, images) => <article key={image.id} className="overflow-hidden rounded-2xl border border-border bg-background"><div className="relative aspect-square bg-surface-muted"><img src={image.public_url} alt={image.alt_text || selected.name} className="h-full w-full object-cover" /><span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-1 text-[10px] font-bold">{image.is_cover ? "Cover" : `Ảnh ${index + 1}`}</span></div><div className="p-3"><p className="text-xs text-muted-foreground">Ảnh được lưu an toàn trong Supabase Storage.</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={index === 0} onClick={() => void moveImage(index, -1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border disabled:opacity-35" aria-label="Đưa ảnh lên trước"><ChevronUp size={15} /></button><button disabled={index === images.length - 1} onClick={() => void moveImage(index, 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border disabled:opacity-35" aria-label="Đưa ảnh xuống sau"><ChevronDown size={15} /></button>{!image.is_cover && <button onClick={() => void patchImage(image, { isCover: true })} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-bold"><Check size={14} /> Đặt cover</button>}<button onClick={() => void removeImage(image)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-danger" aria-label="Xoá ảnh"><Trash2 size={14} /></button></div></div></article>)}</div></section>}
      {selected && <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-6"><p className="mr-2 w-full text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">Vòng đời sản phẩm</p>{selected.status === "published" && <button onClick={() => void lifecycle(selected, "hide")} className="rounded-full border border-border px-4 py-2 text-xs font-bold">Ẩn khỏi shop</button>}{selected.status !== "published" && selected.status !== "archived" && <><button onClick={() => void lifecycle(selected, "show")} className="rounded-full border border-primary px-4 py-2 text-xs font-bold text-primary">Hiển thị</button><button onClick={() => void lifecycle(selected, "archive")} className="rounded-full border border-border px-4 py-2 text-xs font-bold">Lưu trữ</button></>}{selected.status === "archived" && <button onClick={() => void lifecycle(selected, "restore")} className="rounded-full border border-border px-4 py-2 text-xs font-bold">Khôi phục về nháp</button>}<button onClick={() => void lifecycle(selected, "permanent")} className="rounded-full border border-danger px-4 py-2 text-xs font-bold text-danger">Xoá vĩnh viễn</button></div>}
    </section></div>}
  </main>;
}
