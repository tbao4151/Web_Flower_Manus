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

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xem kho hoa." }, { status: 403 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("inventory_items").select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").order("is_active", { ascending: false }).order("name", { ascending: true });
    if (error) return NextResponse.json({ error: "Không thể tải kho hoa." }, { status: 500 });
    return NextResponse.json({ inventoryItems: (data || []).map((item) => withAvailability(item as Record<string, unknown>)) });
  } catch {
    return NextResponse.json({ error: "Dịch vụ kho hoa tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có thể thêm nguyên liệu." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Thông tin nguyên liệu chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  try {
    const { initialQuantity, ...item } = parsed.data;
    const { data, error } = await supabase.from("inventory_items").insert({ name: item.name.normalize("NFC"), unit: item.unit.normalize("NFC"), low_stock_threshold: item.lowStockThreshold, is_active: item.isActive }).select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").single();
    if (error || !data) return NextResponse.json({ error: "Không thể thêm nguyên liệu. Tên có thể đã tồn tại." }, { status: 409 });
    if (initialQuantity > 0) {
      const { error: adjustmentError } = await supabase.rpc("adjust_inventory_item", { target_item_id: data.id, target_transaction_type: "import", target_quantity_change: initialQuantity, target_reason: "Tồn đầu kỳ", target_created_by: current.user.id });
      if (adjustmentError) {
        await supabase.from("inventory_items").delete().eq("id", data.id);
        return NextResponse.json({ error: "Không thể ghi nhận tồn đầu kỳ." }, { status: 400 });
      }
    }
    const { data: fresh } = await supabase.from("inventory_items").select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").eq("id", data.id).single();
    return NextResponse.json({ inventoryItem: withAvailability((fresh || data) as Record<string, unknown>) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Không thể lưu nguyên liệu." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể sửa nguyên liệu." }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin nguyên liệu chưa hợp lệ." }, { status: 400 });
  const { id, name, unit, lowStockThreshold, isActive } = parsed.data;
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) values.name = name.normalize("NFC");
  if (unit !== undefined) values.unit = unit.normalize("NFC");
  if (lowStockThreshold !== undefined) values.low_stock_threshold = lowStockThreshold;
  if (isActive !== undefined) values.is_active = isActive;
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("inventory_items").update(values).eq("id", id).select("id, name, unit, quantity_on_hand, quantity_reserved, low_stock_threshold, is_active, created_at, updated_at").single();
    if (error || !data) return NextResponse.json({ error: "Không thể cập nhật nguyên liệu." }, { status: 400 });
    return NextResponse.json({ inventoryItem: withAvailability(data as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ error: "Không thể cập nhật nguyên liệu." }, { status: 503 });
  }
}
