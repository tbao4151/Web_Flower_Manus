import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("orders").select("id, order_code, recipient_name, recipient_phone, delivery_address, delivery_date, delivery_time, subtotal_vnd, shipping_vnd, total_vnd, status, created_at, order_items(product_name_snapshot, quantity, unit_price_vnd, line_total_vnd)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: "Không thể tải đơn hàng." }, { status: 500 });
    return NextResponse.json({ orders: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
