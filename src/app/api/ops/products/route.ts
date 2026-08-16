import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const ids = z.array(z.string().uuid()).max(50).optional();
const productSchemaBase = z.object({
  sku: z.string().trim().min(2).max(50),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(120),
  productType: z.enum(["bouquet", "basket"]),
  priceVnd: z.number().int().nonnegative(),
  salePriceVnd: z.number().int().nonnegative().nullable().optional(),
  description: z.string().trim().max(1000).default(""),
  composition: z.string().trim().max(1000).nullable().optional(),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published", "hidden", "archived"]).default("draft"),
  saleMode: z.enum(["ready_stock", "preorder"]).default("ready_stock"),
  preorderMinHours: z.number().int().min(1).max(720).nullable().optional(),
  showWhenOutOfStock: z.boolean().default(false),
  categoryIds: ids,
  toneIds: ids,
  occasionIds: ids,
});

const validatePreorder = <T extends { saleMode?: string; preorderMinHours?: number | null }>(value: T, context: z.RefinementCtx) => {
  if (value.saleMode === "preorder" && !value.preorderMinHours) {
    context.addIssue({ code: "custom", path: ["preorderMinHours"], message: "Sản phẩm đặt trước cần thời gian chuẩn bị tối thiểu." });
  }
};

const productSchema = productSchemaBase.superRefine(validatePreorder);
const productPatchSchema = productSchemaBase.partial().superRefine(validatePreorder);

const adminProductSelect = "id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, composition, featured, status, sale_mode, preorder_min_hours, show_when_out_of_stock, archived_at, source_caption, source_reference, created_at, updated_at, product_images(id, storage_path, alt_text, display_order, is_cover, mime_type, created_at), product_categories(category_id), product_tones(tone_id), product_occasions(occasion_id)";
const bucket = "product-images";

const withPublicImageUrls = (supabase: ReturnType<typeof createSupabaseAdminClient>, product: Record<string, unknown>) => ({
  ...product,
  product_images: Array.isArray(product.product_images) ? (product.product_images as Array<Record<string, unknown>>).sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)).map((image) => ({ ...image, public_url: supabase.storage.from(bucket).getPublicUrl(String(image.storage_path || "")).data.publicUrl })) : [],
});

async function syncRelations(productId: string, data: Partial<z.infer<typeof productSchema>>) {
  const supabase = createSupabaseAdminClient();
  const relations = [
    ["product_categories", "category_id", data.categoryIds],
    ["product_tones", "tone_id", data.toneIds],
    ["product_occasions", "occasion_id", data.occasionIds],
  ] as const;
  for (const [table, key, values] of relations) {
    if (!values) continue;
    const { error: deleteError } = await supabase.from(table).delete().eq("product_id", productId);
    if (deleteError) throw deleteError;
    if (values.length) {
      const { error: insertError } = await supabase.from(table).insert(values.map((value) => ({ product_id: productId, [key]: value })));
      if (insertError) throw insertError;
    }
  }
}

async function hasCoverImage(productId: string) {
  const { data, error } = await createSupabaseAdminClient().from("product_images").select("id").eq("product_id", productId).eq("is_cover", true).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function GET(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || "20")));
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "";
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("products").select(adminProductSelect, { count: "exact" }).order("updated_at", { ascending: false });
    const safeSearch = search.replace(/[^\p{L}\p{N} _-]/gu, " ").trim();
    if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,sku.ilike.%${safeSearch}%,slug.ilike.%${safeSearch}%`);
    if (["draft", "published", "hidden", "archived"].includes(status)) query = query.eq("status", status);
    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: "Không thể tải sản phẩm." }, { status: 500 });
    return NextResponse.json({ products: (data || []).map((product) => withPublicImageUrls(supabase, product as unknown as Record<string, unknown>)), total: count ?? 0, page, pageSize });
  } catch { return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể tạo sản phẩm." }, { status: 403 });
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.salePriceVnd != null && parsed.data.salePriceVnd > parsed.data.priceVnd)) return NextResponse.json({ error: "Thông tin sản phẩm chưa hợp lệ." }, { status: 400 });
  if (parsed.data.status === "published") return NextResponse.json({ error: "Hãy lưu sản phẩm nháp, tải ít nhất một ảnh rồi mới bật hiển thị." }, { status: 400 });
  const { categoryIds, toneIds, occasionIds, ...product } = parsed.data;
  const normalizedProduct = {
    ...product,
    sku: product.sku.normalize("NFC"),
    name: product.name.normalize("NFC"),
    description: product.description.normalize("NFC"),
    composition: product.composition == null ? product.composition : product.composition.normalize("NFC"),
  };
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").insert({ sku: normalizedProduct.sku, slug: normalizedProduct.slug, name: normalizedProduct.name, product_type: normalizedProduct.productType, price_vnd: normalizedProduct.priceVnd, sale_price_vnd: normalizedProduct.salePriceVnd ?? null, description: normalizedProduct.description,       composition: normalizedProduct.composition ?? null, featured: normalizedProduct.featured, status: normalizedProduct.status, sale_mode: normalizedProduct.saleMode, preorder_min_hours: normalizedProduct.preorderMinHours ?? null, show_when_out_of_stock: normalizedProduct.showWhenOutOfStock }).select(adminProductSelect).single();
    if (error || !data) return NextResponse.json({ error: "Không thể tạo sản phẩm. SKU hoặc slug có thể đã tồn tại." }, { status: 409 });
    await syncRelations(data.id, { categoryIds, toneIds, occasionIds });
    return NextResponse.json({ product: withPublicImageUrls(supabase, data as unknown as Record<string, unknown>) }, { status: 201 });
  } catch { return NextResponse.json({ error: "Không thể lưu sản phẩm hoặc taxonomy." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể sửa sản phẩm." }, { status: 403 });
  try {
    const body = await request.json().catch(() => null) as ({ id?: string } & Record<string, unknown>) | null;
    if (!body?.id || !z.string().uuid().safeParse(body.id).success) return NextResponse.json({ error: "Thiếu ID sản phẩm." }, { status: 400 });
    const parsed = productPatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Thông tin sản phẩm chưa hợp lệ." }, { status: 400 });
    if (parsed.data.salePriceVnd != null && parsed.data.priceVnd != null && parsed.data.salePriceVnd > parsed.data.priceVnd) return NextResponse.json({ error: "Giá sale không được cao hơn giá gốc." }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    const { data: current, error: currentError } = await supabase.from("products").select("id, status").eq("id", body.id).single();
    if (currentError || !current) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
    if (parsed.data.status === "published" && !(await hasCoverImage(body.id))) return NextResponse.json({ error: "Không thể hiển thị sản phẩm khi chưa có ảnh cover." }, { status: 400 });
    const { categoryIds, toneIds, occasionIds, productType, priceVnd, salePriceVnd, status, saleMode, preorderMinHours, showWhenOutOfStock, ...rest } = parsed.data;
    const values: Record<string, unknown> = {
      ...rest,
      ...(typeof rest.sku === "string" ? { sku: rest.sku.normalize("NFC") } : {}),
      ...(typeof rest.name === "string" ? { name: rest.name.normalize("NFC") } : {}),
      ...(typeof rest.description === "string" ? { description: rest.description.normalize("NFC") } : {}),
      ...(typeof rest.composition === "string" ? { composition: rest.composition.normalize("NFC") } : {}),
      updated_at: new Date().toISOString(),
    };
    if (productType !== undefined) values.product_type = productType;
    if (priceVnd !== undefined) values.price_vnd = priceVnd;
    if (salePriceVnd !== undefined) values.sale_price_vnd = salePriceVnd;
    if (saleMode !== undefined) values.sale_mode = saleMode;
    if (preorderMinHours !== undefined) values.preorder_min_hours = preorderMinHours;
    if (showWhenOutOfStock !== undefined) values.show_when_out_of_stock = showWhenOutOfStock;
    if (status !== undefined) {
      values.status = status;
      values.archived_at = status === "archived" ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from("products").update(values).eq("id", body.id);
    if (error) {
      console.error("[admin/products PATCH] update failed", { productId: body.id, error: error.message, code: error.code });
      return NextResponse.json({ error: "Không thể cập nhật sản phẩm." }, { status: 500 });
    }
    await syncRelations(body.id, { categoryIds, toneIds, occasionIds });
    const { data, error: reloadError } = await supabase.from("products").select(adminProductSelect).eq("id", body.id).single();
    if (reloadError || !data) {
      console.error("[admin/products PATCH] reload failed", { productId: body.id, error: reloadError?.message, code: reloadError?.code });
      return NextResponse.json({ error: "Đã lưu nhưng không thể tải lại sản phẩm." }, { status: 500 });
    }
    return NextResponse.json({ product: withPublicImageUrls(supabase, data as unknown as Record<string, unknown>) });
  } catch (error) {
    console.error("[admin/products PATCH] unhandled failure", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Không thể cập nhật sản phẩm hoặc taxonomy." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xoá sản phẩm." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const action = params.get("action");
  if (!id || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Thiếu ID sản phẩm." }, { status: 400 });
  if (action && action !== "permanent") return NextResponse.json({ error: "DELETE chỉ dùng cho xoá vĩnh viễn. Hãy dùng PATCH để đổi trạng thái sản phẩm." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data: paths, error } = await supabase.rpc("permanently_delete_product", { target_product_id: id });
    if (error) {
      if (error.message.includes("product_has_orders")) return NextResponse.json({ error: "Sản phẩm đã xuất hiện trong đơn hàng nên không thể xoá vĩnh viễn. Hãy ẩn hoặc lưu trữ sản phẩm." }, { status: 409 });
      return NextResponse.json({ error: "Không thể xoá vĩnh viễn sản phẩm." }, { status: 400 });
    }
    const storagePaths = (paths || []).map((item: { storage_path: string }) => item.storage_path).filter(Boolean);
    if (storagePaths.length) await supabase.storage.from(bucket).remove(storagePaths);
    return NextResponse.json({ ok: true, deleted: true });
  } catch { return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 }); }
}
