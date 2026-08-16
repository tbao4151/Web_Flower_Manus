import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { availabilityStatusFromQuantity } from "@/lib/inventory";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xem khả dụng nội bộ." }, { status: 403 });
  const id = (await params).id;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Sản phẩm không hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const [productResult, settingsResult, ingredientsResult, availabilityResult] = await Promise.all([
      supabase.from("products").select("id, name, sale_mode, preorder_min_hours, show_when_out_of_stock").eq("id", id).single(),
      supabase.from("shop_settings").select("low_stock_threshold").eq("key", "inventory").maybeSingle(),
      supabase.from("product_ingredients").select("id, inventory_item_id, quantity_required, inventory_items(id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active)").eq("product_id", id).order("created_at", { ascending: true }),
      supabase.rpc("compute_product_availability", { target_product_id: id }),
    ]);
    if (productResult.error || !productResult.data) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
    if (ingredientsResult.error || availabilityResult.error) return NextResponse.json({ error: "Không thể tính khả dụng sản phẩm." }, { status: 500 });
    const availableQuantity = Math.max(0, Number(availabilityResult.data || 0));
    const lowStockThreshold = Math.max(0, Number(settingsResult.data?.low_stock_threshold ?? 2));
    return NextResponse.json({
      product: productResult.data,
      availableQuantity,
      availabilityStatus: availabilityStatusFromQuantity(availableQuantity, lowStockThreshold),
      inventoryConfigured: Boolean((ingredientsResult.data || []).length),
      ingredients: ingredientsResult.data || [],
    });
  } catch {
    return NextResponse.json({ error: "Dịch vụ khả dụng tạm thời không khả dụng." }, { status: 503 });
  }
}
