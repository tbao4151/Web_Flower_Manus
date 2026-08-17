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

const errorResponse = (code: string, message: string, status: number, details?: Record<string, unknown>) => NextResponse.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể xem lịch sử kho.", 403);
  const id = (await params).id;
  if (!idSchema.safeParse(id).success) return errorResponse("INVALID_INVENTORY_ID", "Nguyên liệu không hợp lệ.", 400);
  try {
    const supabase = createSupabaseAdminClient();
    const [itemResult, transactionsResult] = await Promise.all([
      supabase.from("inventory_items").select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").eq("id", id).single(),
      supabase.from("inventory_transactions").select("id, inventory_item_id, transaction_type, quantity_change, reason, order_id, created_at, created_by").eq("inventory_item_id", id).order("created_at", { ascending: false }).limit(100),
    ]);
    if (itemResult.error || !itemResult.data) return errorResponse("INVENTORY_NOT_FOUND", "Không tìm thấy nguyên liệu.", 404);
    if (transactionsResult.error) return errorResponse("INVENTORY_HISTORY_FAILED", "Không thể tải lịch sử giao dịch.", 500);
    return NextResponse.json({ inventoryItem: itemResult.data, transactions: transactionsResult.data || [] });
  } catch {
    return errorResponse("INVENTORY_SERVICE_UNAVAILABLE", "Dịch vụ kho hoa tạm thời không khả dụng.", 503);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const current = await requireAdmin();
  if (!current) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể điều chỉnh kho.", 403);
  const id = (await params).id;
  if (!idSchema.safeParse(id).success) return errorResponse("INVALID_INVENTORY_ID", "Nguyên liệu không hợp lệ.", 400);
  const parsed = transactionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("INVENTORY_TRANSACTION_VALIDATION_ERROR", "Giao dịch tồn kho chưa hợp lệ.", 400, { issues: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("adjust_inventory_item", { target_item_id: id, target_transaction_type: parsed.data.transactionType, target_quantity_change: parsed.data.quantityChange, target_reason: parsed.data.reason, target_created_by: current.user.id, target_note: "MANUAL_ADJUSTMENT" });
    if (error) {
      if (error.message.includes("stock_below_reserved")) return errorResponse("STOCK_BELOW_RESERVED", "Không thể giảm tồn thấp hơn lượng đã giữ cho đơn.", 409);
      if (error.message.includes("inventory_item_not_found")) return errorResponse("INVENTORY_NOT_FOUND", "Không tìm thấy nguyên liệu.", 404);
      console.error("[inventory:transaction] RPC error", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return errorResponse("INVENTORY_TRANSACTION_FAILED", "Không thể ghi nhận giao dịch tồn kho.", 400);
    }
    return NextResponse.json({ inventoryItem: Array.isArray(data) ? data[0] : data });
  } catch {
    return errorResponse("INVENTORY_SERVICE_UNAVAILABLE", "Dịch vụ kho hoa tạm thời không khả dụng.", 503);
  }
}
