import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const slotSchema = z.object({
  positionOne: z.string().uuid().nullable(),
  positionTwo: z.string().uuid().nullable(),
  positionThree: z.string().uuid().nullable(),
});

const productSelect = "id, slug, name, product_type, status, featured_position, product_images(id, storage_path, display_order, is_cover, alt_text)";
const bucket = "product-images";

function mapProduct(supabase: ReturnType<typeof createSupabaseAdminClient>, product: Record<string, unknown>) {
  const images = Array.isArray(product.product_images)
    ? (product.product_images as Array<Record<string, unknown>>)
        .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
        .map((image) => ({
          id: String(image.id),
          public_url: supabase.storage.from(bucket).getPublicUrl(String(image.storage_path || "")).data.publicUrl,
          is_cover: Boolean(image.is_cover),
          alt_text: String(image.alt_text || ""),
        }))
    : [];
  return {
    id: String(product.id),
    slug: String(product.slug),
    name: String(product.name),
    product_type: product.product_type,
    status: product.status,
    featured_position: product.featured_position,
    product_images: images,
  };
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể quản lý mẫu nổi bật." }, { status: 403 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("products").select(productSelect).order("name", { ascending: true });
    if (error) return NextResponse.json({ error: "Không thể tải lựa chọn mẫu nổi bật." }, { status: 500 });
    return NextResponse.json({ products: (data || []).map((product) => mapProduct(supabase, product as unknown as Record<string, unknown>)) });
  } catch {
    return NextResponse.json({ error: "Dịch vụ mẫu nổi bật tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể lưu mẫu nổi bật." }, { status: 403 });
  const parsed = slotSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lựa chọn vị trí mẫu nổi bật chưa hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("set_homepage_featured_slots", {
      position_one: parsed.data.positionOne,
      position_two: parsed.data.positionTwo,
      position_three: parsed.data.positionThree,
    });
    if (error) {
      if (error.message.includes("featured_product_duplicate")) return NextResponse.json({ error: "Mỗi sản phẩm chỉ được dùng một vị trí nổi bật." }, { status: 409 });
      if (error.message.includes("featured_product_invalid")) return NextResponse.json({ error: "Chỉ sản phẩm đang hiển thị và có ảnh hợp lệ mới được chọn." }, { status: 400 });
      if (error.message.includes("admin_required")) return NextResponse.json({ error: "Chỉ Admin mới có thể lưu mẫu nổi bật." }, { status: 403 });
      return NextResponse.json({ error: "Không thể lưu mẫu nổi bật." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, slots: data || [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ mẫu nổi bật tạm thời không khả dụng." }, { status: 503 });
  }
}
