import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { availabilityStatusFromQuantity } from "@/lib/inventory";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().min(1).max(30),
  lowStockThreshold: z.number().int().min(0).max(100000).default(2),
  isActive: z.boolean().default(true),
  initialQuantity: z.number().int().min(0).max(1000000).default(0),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  lowStockThreshold: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

const deleteSchema = z.object({ id: z.string().uuid() });

type ApiErrorDetails = Record<string, unknown>;

const errorResponse = (code: string, message: string, status: number, details?: ApiErrorDetails) => NextResponse.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });

const validationError = (error: z.ZodError) => errorResponse("INVENTORY_VALIDATION_ERROR", "Thông tin nguyên liệu chưa hợp lệ.", 400, { issues: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });

const withAvailability = (item: Record<string, unknown>) => {
  const onHand = Number(item.quantity_on_hand || 0);
  const reserved = Number(item.quantity_reserved || 0);
  const available = Math.max(0, onHand - reserved);
  return {
    ...item,
    available_quantity: available,
    availability_status: availabilityStatusFromQuantity(available, Number(item.low_stock_threshold ?? 2)),
  };
};

const supabaseErrorMessage = (error: { code?: string; message?: string }) => `${error.code || ""} ${error.message || ""}`.toLowerCase();

export async function GET() {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể xem kho hoa.", 403);
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("inventory_items").select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").order("is_active", { ascending: false }).order("name", { ascending: true });
    if (error) {
      console.error("[inventory:list] Supabase error", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return errorResponse("INVENTORY_LIST_FAILED", "Không thể tải kho hoa.", 500);
    }
    return NextResponse.json({ inventoryItems: (data || []).map((item) => withAvailability(item as Record<string, unknown>)) });
  } catch (error) {
    console.error("[inventory:list] Unexpected error", error);
    return errorResponse("INVENTORY_SERVICE_UNAVAILABLE", "Dịch vụ kho hoa tạm thời không khả dụng.", 503);
  }
}

export async function POST(request: Request) {
  const current = await requireAdmin();
  if (!current) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể thêm nguyên liệu.", 403);
  const body = await request.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createSupabaseAdminClient();
  let createdId: string | null = null;
  try {
    const { initialQuantity, ...item } = parsed.data;
    const { data, error } = await supabase.from("inventory_items").insert({ name: item.name.normalize("NFC"), unit: item.unit.normalize("NFC"), low_stock_threshold: item.lowStockThreshold, is_active: item.isActive }).select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").single();
    if (error || !data) {
      console.error("[inventory:create] Supabase insert error", { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint });
      if (error?.code === "23505") return errorResponse("INVENTORY_DUPLICATE_NAME", "Tên nguyên liệu đã tồn tại. Hãy chọn tên khác.", 409, { field: "name" });
      return errorResponse("INVENTORY_CREATE_FAILED", "Không thể thêm nguyên liệu.", 500);
    }
    createdId = data.id;

    if (initialQuantity > 0) {
      const { error: adjustmentError } = await supabase.rpc("adjust_inventory_item", {
        target_item_id: data.id,
        target_transaction_type: "import",
        target_quantity_change: initialQuantity,
        target_reason: "Tồn đầu kỳ",
        target_created_by: current.user.id,
        target_note: "INITIAL_STOCK",
      });
      if (adjustmentError) {
        console.error("[inventory:create] Initial stock RPC error", { code: adjustmentError.code, message: adjustmentError.message, details: adjustmentError.details, hint: adjustmentError.hint });
        await supabase.from("inventory_items").delete().eq("id", data.id);
        createdId = null;
        return errorResponse("INVENTORY_INITIAL_STOCK_FAILED", "Không thể ghi nhận tồn đầu kỳ; nguyên liệu chưa được tạo.", 500);
      }
    }

    const { data: fresh, error: freshError } = await supabase.from("inventory_items").select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").eq("id", data.id).single();
    if (freshError || !fresh) {
      console.error("[inventory:create] Fresh read error", { code: freshError?.code, message: freshError?.message, details: freshError?.details, hint: freshError?.hint });
      return errorResponse("INVENTORY_READBACK_FAILED", "Nguyên liệu đã được tạo nhưng chưa thể tải lại dữ liệu. Vui lòng tải lại trang.", 500);
    }
    return NextResponse.json({ success: true, inventoryItem: withAvailability(fresh as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (createdId) await supabase.from("inventory_items").delete().eq("id", createdId);
    console.error("[inventory:create] Unexpected error", error);
    return errorResponse("INVENTORY_CREATE_FAILED", "Không thể lưu nguyên liệu.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể sửa nguyên liệu.", 403);
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { id, name, unit, lowStockThreshold, isActive } = parsed.data;
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) values.name = name.normalize("NFC");
  if (unit !== undefined) values.unit = unit.normalize("NFC");
  if (lowStockThreshold !== undefined) values.low_stock_threshold = lowStockThreshold;
  if (isActive !== undefined) values.is_active = isActive;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("inventory_items").update(values).eq("id", id).select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").single();
    if (error || !data) {
      console.error("[inventory:update] Supabase error", { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint });
      if (error?.code === "23505") return errorResponse("INVENTORY_DUPLICATE_NAME", "Tên nguyên liệu đã tồn tại. Hãy chọn tên khác.", 409, { field: "name" });
      if (error?.code === "PGRST116") return errorResponse("INVENTORY_NOT_FOUND", "Không tìm thấy nguyên liệu.", 404);
      return errorResponse("INVENTORY_UPDATE_FAILED", "Không thể cập nhật nguyên liệu.", 400);
    }
    return NextResponse.json({ success: true, inventoryItem: withAvailability(data as Record<string, unknown>) });
  } catch (error) {
    console.error("[inventory:update] Unexpected error", error);
    return errorResponse("INVENTORY_UPDATE_FAILED", "Không thể cập nhật nguyên liệu.", 503);
  }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể xóa nguyên liệu.", 403);
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { id } = parsed.data;
  try {
    const supabase = createSupabaseAdminClient();
    const [{ count: recipeCount, error: recipeError }, { count: transactionCount, error: transactionError }] = await Promise.all([
      supabase.from("product_ingredients").select("id", { count: "exact", head: true }).eq("inventory_item_id", id),
      supabase.from("inventory_transactions").select("id", { count: "exact", head: true }).eq("inventory_item_id", id),
    ]);
    if (recipeError || transactionError) {
      console.error("[inventory:delete] Dependency lookup error", { recipeError, transactionError });
      return errorResponse("INVENTORY_DELETE_CHECK_FAILED", "Không thể kiểm tra phụ thuộc trước khi xóa.", 500);
    }
    if ((recipeCount || 0) > 0 || (transactionCount || 0) > 0) {
      return errorResponse("INVENTORY_DELETE_CONFLICT", "Không thể xóa nguyên liệu đã được dùng trong công thức hoặc lịch sử tồn kho. Hãy ngừng sử dụng nguyên liệu này thay vì xóa.", 409, { recipeCount: recipeCount || 0, transactionCount: transactionCount || 0, recommendedAction: "deactivate" });
    }
    const { data, error } = await supabase.from("inventory_items").delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      console.error("[inventory:delete] Supabase error", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return errorResponse("INVENTORY_DELETE_FAILED", "Không thể xóa nguyên liệu.", 500);
    }
    if (!data) return errorResponse("INVENTORY_NOT_FOUND", "Không tìm thấy nguyên liệu.", 404);
    return NextResponse.json({ success: true, deleted: true, id });
  } catch (error) {
    console.error("[inventory:delete] Unexpected error", error);
    return errorResponse("INVENTORY_DELETE_FAILED", "Không thể xóa nguyên liệu.", 503);
  }
}
