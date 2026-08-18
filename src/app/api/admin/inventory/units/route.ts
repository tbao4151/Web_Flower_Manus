import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const inventoryTypeSchema = z.enum(["flower", "accessory"]);
const createSchema = z.object({
  name: z.string().trim().min(1).max(30),
  inventoryType: inventoryTypeSchema,
});
const deleteSchema = z.object({ id: z.string().uuid() });

const errorResponse = (code: string, message: string, status: number, details?: Record<string, unknown>) => NextResponse.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });

export async function GET(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể xem đơn vị kho.", 403);
  const type = new URL(request.url).searchParams.get("type") || "flower";
  const parsedType = inventoryTypeSchema.safeParse(type);
  if (!parsedType.success) return errorResponse("INVENTORY_TYPE_INVALID", "Loại kho không hợp lệ.", 400);
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("inventory_units").select("id, name, inventory_type, created_at").eq("inventory_type", parsedType.data).order("name", { ascending: true }).limit(200);
    if (error) {
      console.error("[inventory:units:list] Supabase error", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return errorResponse("INVENTORY_UNITS_LIST_FAILED", "Không thể tải đơn vị kho.", 500);
    }
    return NextResponse.json({ inventoryType: parsedType.data, units: data || [] });
  } catch (error) {
    console.error("[inventory:units:list] Unexpected error", error);
    return errorResponse("INVENTORY_SERVICE_UNAVAILABLE", "Dịch vụ đơn vị kho tạm thời không khả dụng.", 503);
  }
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể thêm đơn vị kho.", 403);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("INVENTORY_UNIT_VALIDATION_ERROR", "Đơn vị kho chưa hợp lệ.", 400, { issues: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("inventory_units").insert({ name: parsed.data.name.normalize("NFC"), inventory_type: parsed.data.inventoryType }).select("id, name, inventory_type, created_at").single();
    if (error || !data) {
      console.error("[inventory:units:create] Supabase error", { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint });
      if (error?.code === "23505") return errorResponse("INVENTORY_UNIT_DUPLICATE", "Đơn vị đã tồn tại trong loại kho này.", 409, { field: "name", inventoryType: parsed.data.inventoryType });
      return errorResponse("INVENTORY_UNIT_CREATE_FAILED", "Không thể thêm đơn vị kho.", 500);
    }
    return NextResponse.json({ success: true, unit: data }, { status: 201 });
  } catch (error) {
    console.error("[inventory:units:create] Unexpected error", error);
    return errorResponse("INVENTORY_UNIT_CREATE_FAILED", "Không thể lưu đơn vị kho.", 503);
  }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể xóa đơn vị kho.", 403);
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("INVENTORY_UNIT_VALIDATION_ERROR", "Đơn vị kho chưa hợp lệ.", 400);
  try {
    const supabase = createSupabaseAdminClient();
    const { count, error: dependencyError } = await supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("inventory_unit_id", parsed.data.id);
    if (dependencyError) return errorResponse("INVENTORY_UNIT_DELETE_CHECK_FAILED", "Không thể kiểm tra item đang dùng đơn vị này.", 500);
    if ((count || 0) > 0) return errorResponse("INVENTORY_UNIT_DELETE_CONFLICT", "Không thể xóa đơn vị đang được sử dụng bởi item trong kho.", 409, { itemCount: count || 0 });
    const { data, error } = await supabase.from("inventory_units").delete().eq("id", parsed.data.id).select("id").maybeSingle();
    if (error) {
      console.error("[inventory:units:delete] Supabase error", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return errorResponse("INVENTORY_UNIT_DELETE_FAILED", "Không thể xóa đơn vị kho.", 500);
    }
    if (!data) return errorResponse("INVENTORY_UNIT_NOT_FOUND", "Không tìm thấy đơn vị kho.", 404);
    return NextResponse.json({ success: true, deleted: true, id: parsed.data.id });
  } catch (error) {
    console.error("[inventory:units:delete] Unexpected error", error);
    return errorResponse("INVENTORY_UNIT_DELETE_FAILED", "Không thể xóa đơn vị kho.", 503);
  }
}
