import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, normalizedPhoneSchema } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const profileSchema = z.object({ fullName: z.string().trim().max(100).optional(), phone: normalizedPhoneSchema.optional() }).refine((value) => !value.fullName || value.fullName.length >= 2, { path: ["fullName"], message: "Tên hiển thị cần ít nhất 2 ký tự." });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("profiles").select("id, full_name, phone, role, is_active, created_at").eq("id", user.id).single();
    if (error) return NextResponse.json({ error: "Không thể tải hồ sơ." }, { status: 500 });
    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin hồ sơ chưa hợp lệ." }, { status: 400 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).single();
    if (existingError || !existing) return NextResponse.json({ error: "Không thể tải hồ sơ." }, { status: 500 });
    const { data, error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName?.trim() || existing.full_name, phone: parsed.data.phone || existing.phone, updated_at: new Date().toISOString() }).eq("id", user.id).select("id, full_name, phone, role, is_active").single();
    if (error) return NextResponse.json({ error: "Không thể cập nhật hồ sơ." }, { status: 500 });
    return NextResponse.json({ profile: data });
  } catch {
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
