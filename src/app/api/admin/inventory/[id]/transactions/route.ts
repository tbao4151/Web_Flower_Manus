import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const idSchema = z.string().uuid();
const transactionSchema = z.object({
  transactionType: z.enum(["import", "damaged", "adjustment"]),
  quantityChange: z.number().int().min(-1000000).max(1000000).refine((value) => value !== 0, "Số lượng thay đổi không được bằng 0."),
  reason: z.string().trim().max(300).default(""),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xem lịch sử kho." }, { status: 403 });
  const id = (await params).id;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Nguyên liệu không hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const [itemResult, transactionsResult] = await Promise.all([
      supabase.from("inventory_items").select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").eq("id", id).single(),
      supabase.from("inventory_transactions").select("id, inventory_item_id, transaction_type, quantity_change, reason, order_id, created_at, created_by").eq("inventory_item_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (itemResult.error || !itemResult.data) return NextResponse.json({ error: "Không tìm thấy nguyên liệu." }, { status: 404 });
    if (transactionsResult.error) return NextResponse.json({ error: "Không thể tải lịch sử giao dịch." }, { status: 500 });
    return NextResponse.json({ inventoryItem: itemResult.data, transactions: transactionsResult.data || [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ kho hoa tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có thể điều chỉnh kho." }, { status: 403 });
  const id = (await params).id;
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "Nguyên liệu không hợp lệ." }, { status: 400 });
  const parsed = transactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Giao dịch tồn kho chưa hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("adjust_inventory_item", { target_item_id: id, target_transaction_type: parsed.data.transactionType, target_quantity_change: parsed.data.quantityChange, target_reason: parsed.data.reason, target_created_by: current.user.id });
    if (error) {
      if (error.message.includes("stock_below_reserved")) return NextResponse.json({ error: "Không thể giảm tồn thấp hơn lượng đã giữ cho đơn." }, { status: 409 });
      if (error.message.includes("inventory_item_not_found")) return NextResponse.json({ error: "Không tìm thấy nguyên liệu." }, { status: 404 });
      return NextResponse.json({ error: "Không thể ghi nhận giao dịch tồn kho." }, { status: 400 });
    }
    return NextResponse.json({ inventoryItem: Array.isArray(data) ? data[0] : data });
  } catch {
    return NextResponse.json({ error: "Dịch vụ kho hoa tạm thời không khả dụng." }, { status: 503 });
  }
}
