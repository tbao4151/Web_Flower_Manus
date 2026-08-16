import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

function normalizePhone(value: string | null) {
  return (value || "").replace(/[^0-9+]/g, "").replace(/^\+84/, "0");
}

export async function GET(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  try {
    const supabase = createSupabaseAdminClient();
    const { data: orders, error } = await supabase.from("orders").select("user_id, customer_name, customer_phone, recipient_name, recipient_phone, total_vnd, created_at").order("created_at", { ascending: false }).limit(5000);
    if (error) return NextResponse.json({ error: "Không thể tải danh sách khách hàng." }, { status: 500 });
    const userIds = Array.from(new Set((orders || []).map((order) => order.user_id).filter(Boolean)));
    const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id, full_name, phone").in("id", userIds) : { data: [] };
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const grouped = new Map<string, { phone: string; name: string; email: null; userId: string | null; orderCount: number; lifetimeValue: number; latestOrderAt: string; }>();
    for (const order of orders || []) {
      const phone = normalizePhone(order.customer_phone || order.recipient_phone);
      if (!phone) continue;
      const profile = order.user_id ? profileById.get(order.user_id) : null;
      const key = phone;
      const existing = grouped.get(key);
      const name = profile?.full_name || order.customer_name || order.recipient_name || "Khách chưa đặt tên";
      if (existing) {
        existing.orderCount += 1;
        existing.lifetimeValue += Number(order.total_vnd || 0);
        if (new Date(order.created_at).getTime() > new Date(existing.latestOrderAt).getTime()) existing.latestOrderAt = order.created_at;
        if (existing.name === "Khách chưa đặt tên" && name !== existing.name) existing.name = name;
        if (!existing.userId && order.user_id) existing.userId = order.user_id;
      } else {
        grouped.set(key, { phone, name, email: null, userId: order.user_id || null, orderCount: 1, lifetimeValue: Number(order.total_vnd || 0), latestOrderAt: order.created_at });
      }
    }
    const customers = Array.from(grouped.values()).filter((customer) => {
      if (!search) return true;
      return customer.name.toLowerCase().includes(search) || customer.phone.includes(search) || (customer.email || "").toLowerCase().includes(search);
    }).sort((a, b) => new Date(b.latestOrderAt).getTime() - new Date(a.latestOrderAt).getTime());
    return NextResponse.json({ customers });
  } catch {
    return NextResponse.json({ error: "Dịch vụ khách hàng tạm thời không khả dụng." }, { status: 503 });
  }
}
