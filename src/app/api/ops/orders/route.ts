import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const statuses = ["pending_confirmation", "confirmed", "preparing", "delivering", "completed", "cancelled"] as const;
const updateSchema = z.object({ orderId: z.string().uuid(), status: z.enum(statuses), note: z.string().trim().max(300).optional().default("") });
const transitions: Record<string, string[]> = {
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["delivering", "cancelled"],
  delivering: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function GET(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(10, Number(searchParams.get("pageSize") || "20")));
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status") || "all";
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("orders").select("id, order_code, recipient_name, recipient_phone, is_pickup, delivery_address, delivery_date, delivery_time, subtotal_vnd, shipping_vnd, total_vnd, status, created_at, updated_at, order_items(product_name_snapshot, quantity, unit_price_vnd, line_total_vnd)", { count: "exact" }).order("created_at", { ascending: false });
    if (status !== "all" && statuses.includes(status as typeof statuses[number])) query = query.eq("status", status);
    if (search) query = query.or(`order_code.ilike.%${search}%,recipient_phone.ilike.%${search}%,recipient_name.ilike.%${search}%`);
    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: "Không thể tải danh sách đơn." }, { status: 500 });
    return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, pageSize });
  } catch {
    return NextResponse.json({ error: "Dịch vụ vận hành tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền thao tác." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái đơn không hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase.from("orders").select("id, status").eq("id", parsed.data.orderId).single();
    if (existingError || !existing) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
    if (!transitions[existing.status]?.includes(parsed.data.status)) return NextResponse.json({ error: "Không thể chuyển trạng thái theo quy trình." }, { status: 409 });
    const { error } = await supabase.from("orders").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.orderId);
    if (error) return NextResponse.json({ error: "Không thể cập nhật đơn." }, { status: 500 });
    await supabase.from("order_status_history").insert({ order_id: parsed.data.orderId, from_status: existing.status, to_status: parsed.data.status, actor_id: current.user.id, note: parsed.data.note });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dịch vụ vận hành tạm thời không khả dụng." }, { status: 503 });
  }
}
