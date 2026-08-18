import { NextResponse } from "next/server";
import { requireAdmin, toVietnamLocalPhone } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

type OrderRow = {
  user_id: string | null;
  total_vnd: number | null;
  created_at: string;
};

function normalizePhone(value: string | null) {
  const compact = (value || "").replace(/[^0-9+]/g, "");
  return toVietnamLocalPhone(compact);
}

function isProfileMatch(profile: ProfileRow, search: string) {
  const normalizedSearch = search.toLocaleLowerCase("vi-VN");
  const normalizedSearchPhone = normalizePhone(search);
  const name = (profile.full_name || "").toLocaleLowerCase("vi-VN");
  const phone = normalizePhone(profile.phone);
  return name.includes(normalizedSearch) || (normalizedSearchPhone.length > 0 && phone.includes(normalizedSearchPhone));
}

async function loadAllOrders(supabase: ReturnType<typeof createSupabaseAdminClient>, profileIds: string[]) {
  const orders: OrderRow[] = [];
  const pageSize = 1000;
  const profileIdChunkSize = 200;

  for (let chunkStart = 0; chunkStart < profileIds.length; chunkStart += profileIdChunkSize) {
    const profileIdChunk = profileIds.slice(chunkStart, chunkStart + profileIdChunkSize);
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("user_id, total_vnd, created_at")
        .in("user_id", profileIdChunk)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;

      const page = (data || []) as OrderRow[];
      orders.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }
  }

  return orders;
}

export async function GET(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const hasSearch = search.length > 0;
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    let profileQuery = supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false });

    // Empty search is intentionally limited by profile registration time only.
    // Search mode deliberately omits this filter so old accounts remain discoverable.
    if (!hasSearch) profileQuery = profileQuery.gte("created_at", recentCutoff);

    const { data: profileData, error: profileError } = await profileQuery;
    if (profileError) return NextResponse.json({ error: "Không thể tải danh sách tài khoản khách hàng." }, { status: 500 });

    const profiles = ((profileData || []) as ProfileRow[]).filter((profile) => !hasSearch || isProfileMatch(profile, search));
    const profileIds = profiles.map((profile) => profile.id);
    const orders = profileIds.length ? await loadAllOrders(supabase, profileIds) : [];
    const orderStats = new Map<string, { orderCount: number; lifetimeValue: number; latestOrderAt: string | null }>();

    for (const order of orders) {
      if (!order.user_id) continue;
      const currentStats = orderStats.get(order.user_id) || { orderCount: 0, lifetimeValue: 0, latestOrderAt: null };
      currentStats.orderCount += 1;
      currentStats.lifetimeValue += Number(order.total_vnd || 0);
      if (!currentStats.latestOrderAt || new Date(order.created_at).getTime() > new Date(currentStats.latestOrderAt).getTime()) {
        currentStats.latestOrderAt = order.created_at;
      }
      orderStats.set(order.user_id, currentStats);
    }

    const customers = profiles.map((profile) => {
      const stats = orderStats.get(profile.id) || { orderCount: 0, lifetimeValue: 0, latestOrderAt: null };
      return {
        id: profile.id,
        name: profile.full_name || "Chưa cập nhật tên",
        phone: profile.phone || "—",
        orderCount: stats.orderCount,
        lifetimeValue: stats.lifetimeValue,
        latestOrderAt: stats.latestOrderAt,
        createdAt: profile.created_at,
      };
    });

    return NextResponse.json({ customers, scope: hasSearch ? "search" : "recent", recentWindowDays: 30 });
  } catch {
    return NextResponse.json({ error: "Dịch vụ khách hàng tạm thời không khả dụng." }, { status: 503 });
  }
}
