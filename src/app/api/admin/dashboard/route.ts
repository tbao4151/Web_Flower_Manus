import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function dateInVietnam(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

export async function GET() {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  try {
    const supabase = createSupabaseAdminClient();
    const today = dateInVietnam();
    const tomorrow = dateInVietnam(1);
    const since = new Date(Date.now() - 86400000).toISOString();
    const [pending, newOrders, preparing, todayOrders, todayRevenue, paid, lowStock, next24] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_confirmation"),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["confirmed", "preparing", "ready"]),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("delivery_date", today).in("status", ["pending_confirmation", "confirmed", "preparing", "ready", "delivering"]),
      supabase.from("orders").select("total_vnd").eq("delivery_date", today).neq("status", "cancelled"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid"),
      supabase.from("inventory_items").select("id, quantity_on_hand, quantity_reserved, low_stock_threshold").eq("is_active", true),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("delivery_date", [today, tomorrow]).in("status", ["pending_confirmation", "confirmed", "preparing", "ready", "delivering"]),
    ]);
    if (pending.error || newOrders.error || preparing.error || todayOrders.error || todayRevenue.error || paid.error || lowStock.error || next24.error) return NextResponse.json({ error: "Không thể tải số liệu dashboard." }, { status: 500 });
    const lowStockItems = (lowStock.data || []).filter((item) => Number(item.quantity_on_hand) - Number(item.quantity_reserved) <= Number(item.low_stock_threshold)).length;
    const totalToday = (todayRevenue.data || []).reduce((sum, item) => sum + Number(item.total_vnd || 0), 0);
    return NextResponse.json({
      today,
      metrics: {
        newOrders: newOrders.count || 0,
        pendingConfirmation: pending.count || 0,
        preparing: preparing.count || 0,
        todayDelivery: todayOrders.count || 0,
        todayRevenue: totalToday,
        paidOrders: paid.count || 0,
        lowStockItems,
        next24Hours: next24.count || 0,
      },
    });
  } catch {
    return NextResponse.json({ error: "Dashboard tạm thời không khả dụng." }, { status: 503 });
  }
}
