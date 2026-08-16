import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có thể xem lịch sử kho." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "";
  const limit = Math.min(200, Math.max(20, Number(searchParams.get("limit") || "100")));
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("inventory_transactions").select("id, inventory_item_id, transaction_type, quantity_change, quantity_before, quantity_after, reason, note, order_id, created_at, created_by, inventory_items(name, unit)").order("created_at", { ascending: false }).limit(limit);
    if (type) query = query.eq("transaction_type", type);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Không thể tải lịch sử kho." }, { status: 500 });
    return NextResponse.json({ transactions: data || [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ lịch sử kho tạm thời không khả dụng." }, { status: 503 });
  }
}
