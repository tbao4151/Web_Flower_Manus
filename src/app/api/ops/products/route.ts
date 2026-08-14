import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const productSchema = z.object({
  sku: z.string().trim().min(2).max(50),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(120),
  productType: z.enum(["bouquet", "basket"]),
  priceVnd: z.number().int().nonnegative(),
  salePriceVnd: z.number().int().nonnegative().nullable().optional(),
  description: z.string().trim().max(1000).default(""),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published", "hidden", "archived"]).default("draft"),
});

export async function GET(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") || "20")));
  const search = searchParams.get("search")?.trim() || "";
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("products").select("id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, featured, status, created_at, updated_at, product_images(id, storage_path, alt_text, display_order, is_cover)", { count: "exact" }).order("updated_at", { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: "Không thể tải sản phẩm." }, { status: 500 });
    return NextResponse.json({ products: data ?? [], total: count ?? 0, page, pageSize });
  } catch {
    return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có thể tạo sản phẩm." }, { status: 403 });
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.salePriceVnd !== null && parsed.data.salePriceVnd !== undefined && parsed.data.salePriceVnd > parsed.data.priceVnd)) return NextResponse.json({ error: "Thông tin sản phẩm chưa hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").insert({ sku: parsed.data.sku, slug: parsed.data.slug, name: parsed.data.name, product_type: parsed.data.productType, price_vnd: parsed.data.priceVnd, sale_price_vnd: parsed.data.salePriceVnd ?? null, description: parsed.data.description, featured: parsed.data.featured, status: parsed.data.status }).select("id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, featured, status").single();
    if (error) return NextResponse.json({ error: "Không thể tạo sản phẩm. SKU hoặc slug có thể đã tồn tại." }, { status: 409 });
    return NextResponse.json({ product: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có thể sửa sản phẩm." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string } & Record<string, unknown>;
  if (!body?.id) return NextResponse.json({ error: "Thiếu ID sản phẩm." }, { status: 400 });
  const parsed = productSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Thông tin sản phẩm chưa hợp lệ." }, { status: 400 });
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) values[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = value;
  if (values.sale_price_vnd != null && values.price_vnd != null && Number(values.sale_price_vnd) > Number(values.price_vnd)) return NextResponse.json({ error: "Giá sale không được cao hơn giá gốc." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").update({ ...values, updated_at: new Date().toISOString() }).eq("id", body.id).select("id, sku, slug, name, product_type, price_vnd, sale_price_vnd, description, featured, status").single();
    if (error) return NextResponse.json({ error: "Không thể cập nhật sản phẩm." }, { status: 500 });
    return NextResponse.json({ product: data });
  } catch {
    return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có thể xoá sản phẩm." }, { status: 403 });
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
  } catch {
    return NextResponse.json({ error: "Dịch vụ sản phẩm tạm thời không khả dụng." }, { status: 503 });
  }
}
