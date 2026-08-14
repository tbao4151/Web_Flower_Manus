import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const roleSchema = z.object({ userId: z.string().uuid(), role: z.enum(["customer", "staff", "admin"]), isActive: z.boolean().optional() });

export async function GET() {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có quyền quản lý nhân viên." }, { status: 403 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("profiles").select("id, full_name, phone, role, is_active, created_at, updated_at").order("created_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: "Không thể tải danh sách người dùng." }, { status: 500 });
    return NextResponse.json({ staff: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ quản trị tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có quyền thay đổi role." }, { status: 403 });
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === current.user.id && parsed.data.role !== "admin") return NextResponse.json({ error: "Thao tác role không hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { role: parsed.data.role, updated_at: new Date().toISOString() };
    if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;
    const { data, error } = await supabase.from("profiles").update(updates).eq("id", parsed.data.userId).select("id, full_name, phone, role, is_active").single();
    if (error) return NextResponse.json({ error: "Không thể cập nhật quyền người dùng." }, { status: 500 });
    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ error: "Dịch vụ quản trị tạm thời không khả dụng." }, { status: 503 });
  }
}
