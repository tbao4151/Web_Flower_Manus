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

// PATCH must never apply POST defaults to omitted fields. In particular, an image-only
// update must not silently turn a published product into draft or clear its flags.
const productPatchSchema = productSchemaBase.extend({
  description: z.string().trim().max(1000).optional(),
  featured: z.boolean().optional(),
  status: z.enum(["draft", "published", "hidden", "archived"]).optional(),
  saleMode: z.enum(["ready_stock", "preorder"]).optional(),
  showWhenOutOfStock: z.boolean().optional(),
}).partial().superRefine(validatePreorder);

const adminProductSelect = "id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, composition, featured, status, sale_mode, preorder_min_hours, show_when_out_of_stock, archived_at, source_caption, source_reference, created_at, updated_at, product_images(id, storage_path, alt_text, display_order, is_cover, mime_type, created_at), product_categories(category_id), product_tones(tone_id), product_occasions(occasion_id)";
const bucket = "product-images";

type SupabaseErrorLike = { code?: string; message?: string; details?: string; hint?: string };

function supabaseErrorFields(error: unknown): SupabaseErrorLike {
  const value = (error || {}) as SupabaseErrorLike;
  return { code: value.code, message: value.message, details: value.details, hint: value.hint };
}

function logSupabaseError(context: string, error: unknown) {
  console.error(context, supabaseErrorFields(error));
}

function apiError(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });
}

async function validateTaxonomyReferences(data: { categoryIds?: string[]; toneIds?: string[]; occasionIds?: string[] }) {
  const supabase = createSupabaseAdminClient();
  const checks = [
    { ids: data.categoryIds, table: "categories", code: "PRODUCT_CATEGORY_NOT_FOUND", label: "danh mục" },
    { ids: data.toneIds, table: "color_tones", code: "PRODUCT_TONE_NOT_FOUND", label: "tone màu" },
    { ids: data.occasionIds, table: "occasions", code: "PRODUCT_OCCASION_NOT_FOUND", label: "dịp tặng" },
  ] as const;
  for (const check of checks) {
    const ids = [...new Set(check.ids || [])];
    if (!ids.length) continue;
    const { data: rows, error } = await supabase.from(check.table).select("id").in("id", ids);
    if (error) {
      logSupabaseError(`[admin/products] taxonomy lookup failed: ${check.table}`, error);
      return { status: 503, code: "PRODUCT_TAXONOMY_LOOKUP_FAILED", message: `Không thể kiểm tra ${check.label}. Vui lòng thử lại.` };
    }
    const found = new Set((rows || []).map((row) => String(row.id)));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) return { status: 400, code: check.code, message: `Không tìm thấy ${check.label} đã chọn.`, details: { missingIds: missing } };
  }
  return null;
}

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
  if (!parsed.success) return apiError(400, "PRODUCT_VALIDATION_ERROR", "Thông tin sản phẩm chưa hợp lệ.", { issues: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });
  if (parsed.data.salePriceVnd != null && parsed.data.salePriceVnd > parsed.data.priceVnd) return apiError(400, "PRODUCT_SALE_PRICE_INVALID", "Giá sale không được cao hơn giá gốc.", { priceVnd: parsed.data.priceVnd, salePriceVnd: parsed.data.salePriceVnd });
  if (parsed.data.status === "published") return apiError(400, "PRODUCT_PUBLISH_REQUIRES_IMAGE", "Hãy lưu sản phẩm nháp, tải ít nhất một ảnh rồi mới bật hiển thị.");
  const { categoryIds, toneIds, occasionIds, ...product } = parsed.data;
  const taxonomyError = await validateTaxonomyReferences({ categoryIds, toneIds, occasionIds });
  if (taxonomyError) return apiError(taxonomyError.status, taxonomyError.code, taxonomyError.message, "details" in taxonomyError ? taxonomyError.details : undefined);
  const normalizedProduct = {
    ...product,
    sku: product.sku.normalize("NFC"),
    name: product.name.normalize("NFC"),
    description: product.description.normalize("NFC"),
    composition: product.composition == null ? product.composition : product.composition.normalize("NFC"),
  };
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").insert({ sku: normalizedProduct.sku, slug: normalizedProduct.slug, name: normalizedProduct.name, product_type: normalizedProduct.productType, price_vnd: normalizedProduct.priceVnd, sale_price_vnd: normalizedProduct.salePriceVnd ?? null, description: normalizedProduct.description, composition: normalizedProduct.composition ?? null, featured: normalizedProduct.featured, status: normalizedProduct.status, sale_mode: normalizedProduct.saleMode, preorder_min_hours: normalizedProduct.preorderMinHours ?? null, show_when_out_of_stock: normalizedProduct.showWhenOutOfStock }).select(adminProductSelect).single();
    if (error || !data) {
      logSupabaseError("[admin/products POST] product insert failed", error);
      if (error?.code === "23505") return apiError(409, "PRODUCT_DUPLICATE_SKU_OR_SLUG", "SKU hoặc slug đã tồn tại. Vui lòng dùng giá trị khác.");
      return apiError(500, "PRODUCT_CREATE_FAILED", "Không thể tạo sản phẩm do lỗi cơ sở dữ liệu.");
    }
    try {
      await syncRelations(data.id, { categoryIds, toneIds, occasionIds });
    } catch (error) {
      logSupabaseError("[admin/products POST] taxonomy relation sync failed", error);
      const { error: cleanupError } = await supabase.from("products").delete().eq("id", data.id);
      if (cleanupError) logSupabaseError("[admin/products POST] cleanup after relation failure failed", cleanupError);
      return apiError(400, "PRODUCT_RELATIONS_INVALID", "Không thể liên kết taxonomy cho sản phẩm; dữ liệu tạm thời đã được hoàn tác.");
    }
    return NextResponse.json({ success: true, product: withPublicImageUrls(supabase, data as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    logSupabaseError("[admin/products POST] unhandled failure", error);
    return apiError(500, "PRODUCT_CREATE_UNAVAILABLE", "Dịch vụ tạo sản phẩm tạm thời không khả dụng.");
  }
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
      logSupabaseError("[admin/products DELETE] permanent delete failed", error);
      if (error.message.includes("product_has_orders")) {
        const { count, error: countError } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
        if (countError) logSupabaseError("[admin/products DELETE] order dependency count failed", countError);
        return apiError(409, "PRODUCT_DELETE_CONFLICT", "Không thể xoá sản phẩm vì sản phẩm đã được sử dụng trong đơn hàng. Hãy ẩn hoặc lưu trữ sản phẩm.", { orderCount: count ?? null, recommendedAction: "archive_or_hide" });
      }
      if (error.message.includes("product_not_found")) return apiError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm cần xoá.");
      return apiError(400, "PRODUCT_DELETE_FAILED", "Không thể xoá vĩnh viễn sản phẩm do còn dependency hoặc lỗi dữ liệu.");
    }
    const storagePaths = (paths || []).map((item: { storage_path: string }) => item.storage_path).filter(Boolean);
    if (storagePaths.length) await supabase.storage.from(bucket).remove(storagePaths);
    return NextResponse.json({ success: true, ok: true, deleted: true });
  } catch (error) {
    logSupabaseError("[admin/products DELETE] unhandled failure", error);
    return apiError(503, "PRODUCT_DELETE_UNAVAILABLE", "Dịch vụ xoá sản phẩm tạm thời không khả dụng.");
  }
}
