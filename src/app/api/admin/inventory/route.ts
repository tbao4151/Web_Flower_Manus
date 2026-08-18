import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { availabilityStatusFromQuantity } from "@/lib/inventory";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const inventoryTypeSchema = z.enum(["flower", "accessory"]);
const statusSchema = z.enum(["all", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "ARCHIVED"]);

const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  inventoryType: inventoryTypeSchema.default("flower"),
  unitId: z.string().uuid().optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  lowStockThreshold: z.number().int().min(0).max(100000).default(2),
  isActive: z.boolean().default(true),
  initialQuantity: z.number().int().min(0).max(1000000).default(0),
}).refine((value) => Boolean(value.unitId || value.unit), {
  message: "Cần chọn đơn vị tồn kho.",
  path: ["unitId"],
});

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  unitId: z.string().uuid().optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  lowStockThreshold: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => value.unitId === undefined || Boolean(value.unitId), {
  message: "Đơn vị tồn kho không hợp lệ.",
  path: ["unitId"],
});

const deleteSchema = z.object({ id: z.string().uuid() });

type InventoryType = z.infer<typeof inventoryTypeSchema>;
type ApiErrorDetails = Record<string, unknown>;
type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

type InventoryRecord = {
  id: string;
  name: string;
  unit: string;
  inventory_type: InventoryType;
  inventory_unit_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const selectFields = "id, name, unit, inventory_type, inventory_unit_id, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at";

const errorResponse = (code: string, message: string, status: number, details?: ApiErrorDetails) => NextResponse.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });

const validationError = (error: z.ZodError) => errorResponse("INVENTORY_VALIDATION_ERROR", "Thông tin kho chưa hợp lệ.", 400, { issues: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });

const withAvailability = (item: InventoryRecord) => {
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

async function resolveUnit(supabase: SupabaseClient, inventoryType: InventoryType, unitId?: string, legacyUnit?: string) {
  let query = supabase.from("inventory_units").select("id, name, inventory_type").eq("inventory_type", inventoryType).limit(1);
  if (unitId) query = query.eq("id", unitId);
  else query = query.ilike("name", legacyUnit || "");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("unit_lookup_failed");
  if (!data) throw new Error("inventory_unit_not_found");
  return data as { id: string; name: string; inventory_type: InventoryType };
}

function parseType(value: string | null): InventoryType {
  return inventoryTypeSchema.parse(value || "flower");
}

export async function GET(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể xem kho.", 403);
  const url = new URL(request.url);
  const rawType = url.searchParams.get("type");
  const search = url.searchParams.get("q")?.trim().slice(0, 100) || "";
  const rawStatus = url.searchParams.get("status") || "all";
  const parsedStatus = statusSchema.safeParse(rawStatus);
  if (!parsedStatus.success) return errorResponse("INVENTORY_FILTER_INVALID", "Bộ lọc kho không hợp lệ.", 400);

  let inventoryType: InventoryType;
  try {
    inventoryType = parseType(rawType);
  } catch {
    return errorResponse("INVENTORY_TYPE_INVALID", "Loại kho không hợp lệ.", 400);
  }

  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("inventory_items").select(selectFields).eq("inventory_type", inventoryType).order("is_active", { ascending: false }).order("name", { ascending: true }).limit(500);
    if (search) query = query.ilike("name", `%${search}%`);
    if (parsedStatus.data === "ARCHIVED") query = query.eq("is_active", false);
    else if (parsedStatus.data !== "all") query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) {
      console.error("[inventory:list] Supabase error", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return errorResponse("INVENTORY_LIST_FAILED", "Không thể tải kho.", 500);
    }
    const mapped = (data || []).map((item) => withAvailability(item as InventoryRecord));
    const inventoryItems = parsedStatus.data === "LOW_STOCK"
      ? mapped.filter((item) => item.availability_status === "LOW_STOCK" || item.availability_status === "OUT_OF_STOCK")
      : parsedStatus.data === "IN_STOCK"
        ? mapped.filter((item) => item.availability_status === "IN_STOCK")
        : parsedStatus.data === "OUT_OF_STOCK"
          ? mapped.filter((item) => item.availability_status === "OUT_OF_STOCK")
          : mapped;
    return NextResponse.json({ inventoryType, inventoryItems });
  } catch (error) {
    console.error("[inventory:list] Unexpected error", error);
    return errorResponse("INVENTORY_SERVICE_UNAVAILABLE", "Dịch vụ kho tạm thời không khả dụng.", 503);
  }
}

export async function POST(request: Request) {
  const current = await requireAdmin();
  if (!current) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể thêm kho item.", 403);
  const body = await request.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const supabase = createSupabaseAdminClient();
  let createdId: string | null = null;
  try {
    const { initialQuantity, inventoryType, unitId, unit, ...metadata } = parsed.data;
    let selectedUnit;
    try {
      selectedUnit = await resolveUnit(supabase, inventoryType, unitId, unit);
    } catch (error) {
      if (error instanceof Error && error.message === "inventory_unit_not_found") return errorResponse("INVENTORY_UNIT_NOT_FOUND", "Đơn vị không tồn tại hoặc không thuộc loại kho này.", 400, { field: "unitId" });
      throw error;
    }
    const { data, error } = await supabase.from("inventory_items").insert({
      name: metadata.name.normalize("NFC"),
      unit: selectedUnit.name.normalize("NFC"),
      inventory_type: inventoryType,
      inventory_unit_id: selectedUnit.id,
      low_stock_threshold: metadata.lowStockThreshold,
      is_active: metadata.isActive,
    }).select(selectFields).single();
    if (error || !data) {
      console.error("[inventory:create] Supabase insert error", { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint });
      if (error?.code === "23505") return errorResponse("INVENTORY_DUPLICATE_NAME", "Tên item đã tồn tại trong loại kho này. Hãy chọn tên khác.", 409, { field: "name", inventoryType });
      return errorResponse("INVENTORY_CREATE_FAILED", "Không thể thêm item vào kho.", 500);
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
        return errorResponse("INVENTORY_INITIAL_STOCK_FAILED", "Không thể ghi nhận tồn đầu kỳ; item chưa được tạo.", 500);
      }
    }

    const { data: fresh, error: freshError } = await supabase.from("inventory_items").select(selectFields).eq("id", data.id).single();
    if (freshError || !fresh) {
      console.error("[inventory:create] Fresh read error", { code: freshError?.code, message: freshError?.message, details: freshError?.details, hint: freshError?.hint });
      return errorResponse("INVENTORY_READBACK_FAILED", "Item đã được tạo nhưng chưa thể tải lại dữ liệu. Vui lòng tải lại trang.", 500);
    }
    return NextResponse.json({ success: true, inventoryItem: withAvailability(fresh as InventoryRecord) }, { status: 201 });
  } catch (error) {
    if (createdId) await supabase.from("inventory_items").delete().eq("id", createdId);
    console.error("[inventory:create] Unexpected error", error);
    return errorResponse("INVENTORY_CREATE_FAILED", "Không thể lưu item vào kho.", 503);
  }
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể sửa kho item.", 403);
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { id, name, unitId, unit, lowStockThreshold, isActive } = parsed.data;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: currentItem, error: currentError } = await supabase.from("inventory_items").select("inventory_type, inventory_unit_id").eq("id", id).single();
    if (currentError || !currentItem) return errorResponse("INVENTORY_NOT_FOUND", "Không tìm thấy item trong kho.", 404);
    let selectedUnit;
    if (unitId !== undefined || unit !== undefined) {
      try {
        selectedUnit = await resolveUnit(supabase, currentItem.inventory_type as InventoryType, unitId, unit);
      } catch (error) {
        if (error instanceof Error && error.message === "inventory_unit_not_found") return errorResponse("INVENTORY_UNIT_NOT_FOUND", "Đơn vị không tồn tại hoặc không thuộc loại kho này.", 400, { field: "unitId" });
        throw error;
      }
    }
    const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) values.name = name.normalize("NFC");
    if (selectedUnit) {
      values.unit = selectedUnit.name.normalize("NFC");
      values.inventory_unit_id = selectedUnit.id;
    }
    if (lowStockThreshold !== undefined) values.low_stock_threshold = lowStockThreshold;
    if (isActive !== undefined) values.is_active = isActive;
    const { data, error } = await supabase.from("inventory_items").update(values).eq("id", id).select(selectFields).single();
    if (error || !data) {
      console.error("[inventory:update] Supabase error", { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint });
      if (error?.code === "23505") return errorResponse("INVENTORY_DUPLICATE_NAME", "Tên item đã tồn tại trong loại kho này. Hãy chọn tên khác.", 409, { field: "name" });
      if (error?.code === "PGRST116") return errorResponse("INVENTORY_NOT_FOUND", "Không tìm thấy item trong kho.", 404);
      return errorResponse("INVENTORY_UPDATE_FAILED", "Không thể cập nhật item.", 400);
    }
    return NextResponse.json({ success: true, inventoryItem: withAvailability(data as InventoryRecord) });
  } catch (error) {
    console.error("[inventory:update] Unexpected error", error);
    return errorResponse("INVENTORY_UPDATE_FAILED", "Không thể cập nhật item.", 503);
  }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return errorResponse("FORBIDDEN", "Chỉ Admin mới có thể xóa kho item.", 403);
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
      return errorResponse("INVENTORY_DELETE_CONFLICT", "Không thể xóa item đã được dùng trong công thức hoặc lịch sử tồn kho. Hãy lưu trữ item thay vì xóa.", 409, { recipeCount: recipeCount || 0, transactionCount: transactionCount || 0, recommendedAction: "deactivate" });
    }
    const { data, error } = await supabase.from("inventory_items").delete().eq("id", id).select("id").maybeSingle();
    if (error) {
      console.error("[inventory:delete] Supabase error", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return errorResponse("INVENTORY_DELETE_FAILED", "Không thể xóa item khỏi kho.", 500);
    }
    if (!data) return errorResponse("INVENTORY_NOT_FOUND", "Không tìm thấy item trong kho.", 404);
    return NextResponse.json({ success: true, deleted: true, id });
  } catch (error) {
    console.error("[inventory:delete] Unexpected error", error);
    return errorResponse("INVENTORY_DELETE_FAILED", "Không thể xóa item khỏi kho.", 503);
  }
}
