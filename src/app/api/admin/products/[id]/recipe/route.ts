import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const recipeSchema = z.object({
  ingredients: z.array(z.object({ inventoryItemId: z.string().uuid(), quantityRequired: z.number().int().min(1).max(100000) })).max(100).superRefine((items, context) => {
    const ids = new Set<string>();
    items.forEach((item, index) => {
      if (ids.has(item.inventoryItemId)) context.addIssue({ code: "custom", path: [index, "inventoryItemId"], message: "Nguyên liệu không được lặp lại." });
      ids.add(item.inventoryItemId);
    });
  }),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xem công thức." }, { status: 403 });
  const id = (await params).id;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Sản phẩm không hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const [productResult, recipeResult] = await Promise.all([
      supabase.from("products").select("id, name, sale_mode, preorder_min_hours, show_when_out_of_stock").eq("id", id).single(),
      supabase.from("product_ingredients").select("id, product_id, inventory_item_id, quantity_required, inventory_items(id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active)").eq("product_id", id).order("created_at", { ascending: true }),
    ]);
    if (productResult.error || !productResult.data) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
    if (recipeResult.error) return NextResponse.json({ error: "Không thể tải công thức." }, { status: 500 });
    return NextResponse.json({ product: productResult.data, ingredients: recipeResult.data || [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ công thức tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể sửa công thức." }, { status: 403 });
  const id = (await params).id;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Sản phẩm không hợp lệ." }, { status: 400 });
  const parsed = recipeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Công thức chưa hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("replace_product_recipe", { target_product_id: id, target_ingredients: parsed.data.ingredients.map((item) => ({ inventory_item_id: item.inventoryItemId, quantity_required: item.quantityRequired })) });
    if (error) {
      if (error.message.includes("product_not_found")) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
      if (error.message.includes("inventory_item_not_active")) return NextResponse.json({ error: "Công thức có nguyên liệu không còn hoạt động." }, { status: 409 });
      return NextResponse.json({ error: "Không thể lưu công thức." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dịch vụ công thức tạm thời không khả dụng." }, { status: 503 });
  }
}
