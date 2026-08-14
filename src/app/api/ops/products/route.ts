import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const ids = z.array(z.string().uuid()).max(50).optional();
const productSchema = z.object({
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
  categoryIds: ids,
  toneIds: ids,
  occasionIds: ids,
});

async function syncRelations(productId: string, data: z.infer<typeof productSchema>) {
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

export async function GET(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") || "20")));
  const search = searchParams.get("search")?.trim() || "";
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("products").select("id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, composition, featured, status, archived_at, created_at, updated_at, product_images(id, storage_path, alt_text, display_order, is_cover), product_categories(category_id), product_tones(tone_id), product_occasions(occasion_id)", { count: "exact" }).order("updated_at", { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: "Không thể tải sản phẩm." }, { status: 500 });
    return NextResponse.json({ products: data ?? [], total: count ?? 0, page, pageSize });
  } catch { return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể tạo sản phẩm." }, { status: 403 });
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.salePriceVnd != null && parsed.data.salePriceVnd > parsed.data.priceVnd)) return NextResponse.json({ error: "Thông tin sản phẩm chưa hợp lệ." }, { status: 400 });
  const { categoryIds, toneIds, occasionIds, ...product } = parsed.data;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").insert({ sku: product.sku, slug: product.slug, name: product.name, product_type: product.productType, price_vnd: product.priceVnd, sale_price_vnd: product.salePriceVnd ?? null, description: product.description, composition: product.composition ?? null, featured: product.featured, status: product.status }).select("id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, composition, featured, status").single();
    if (error || !data) return NextResponse.json({ error: "Không thể tạo sản phẩm. SKU hoặc slug có thể đã tồn tại." }, { status: 409 });
    await syncRelations(data.id, { ...parsed.data, categoryIds, toneIds, occasionIds });
    return NextResponse.json({ product: data }, { status: 201 });
  } catch { return NextResponse.json({ error: "Không thể lưu sản phẩm hoặc taxonomy." }, { status: 400 }); }
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể sửa sản phẩm." }, { status: 403 });
  const body = await request.json().catch(() => null) as ({ id?: string } & Record<string, unknown>) | null;
  if (!body?.id) return NextResponse.json({ error: "Thiếu ID sản phẩm." }, { status: 400 });
  const parsed = productSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Thông tin sản phẩm chưa hợp lệ." }, { status: 400 });
  if (parsed.data.salePriceVnd != null && parsed.data.priceVnd != null && parsed.data.salePriceVnd > parsed.data.priceVnd) return NextResponse.json({ error: "Giá sale không được cao hơn giá gốc." }, { status: 400 });
  const { categoryIds, toneIds, occasionIds, productType, priceVnd, salePriceVnd, ...rest } = parsed.data;
  const values: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (productType !== undefined) values.product_type = productType;
  if (priceVnd !== undefined) values.price_vnd = priceVnd;
  if (salePriceVnd !== undefined) values.sale_price_vnd = salePriceVnd;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").update(values).eq("id", body.id).select("id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, composition, featured, status").single();
    if (error || !data) return NextResponse.json({ error: "Không thể cập nhật sản phẩm." }, { status: 500 });
    await syncRelations(body.id, { ...parsed.data, categoryIds, toneIds, occasionIds } as z.infer<typeof productSchema>);
    return NextResponse.json({ product: data });
  } catch { return NextResponse.json({ error: "Không thể cập nhật sản phẩm hoặc taxonomy." }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xoá sản phẩm." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu ID sản phẩm." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { count } = await supabase.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", id);
    if ((count ?? 0) > 0) {
      await supabase.from("products").update({ status: "archived", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ ok: true, archived: true });
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Không thể xoá sản phẩm." }, { status: 500 });
    return NextResponse.json({ ok: true, archived: false });
  } catch { return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 }); }
}
