import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || "100")));
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("profiles").select("id, full_name, phone").eq("role", "customer").eq("is_active", true).order("full_name", { ascending: true }).limit(limit);
    if (search) query = query.or(`full_name.ilike.%${search.replace(/[(),]/g, " ")}%,phone.ilike.%${search.replace(/[(),]/g, " ")}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Không thể tải danh sách khách hàng." }, { status: 500 });
    return NextResponse.json({ customers: data || [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ khách hàng tạm thời không khả dụng." }, { status: 503 });
  }
}
