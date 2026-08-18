import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentProfile, getSafeRoleRedirect, normalizedPhoneSchema, setManagementSessionCookie, toInternalAuthEmail } from "@/lib/auth";

const loginSchema = z.object({ phone: normalizedPhoneSchema, password: z.string().min(1).max(128), next: z.string().trim().max(512).optional(), reauth: z.coerce.boolean().optional().default(false) });

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu không đúng." }, { status: 401 });

    const email = toInternalAuthEmail(parsed.data.phone);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error) {
      console.error("[auth.login] Supabase Auth error", { code: error.code, status: error.status, message: error.message });
      return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu không đúng." }, { status: 401 });
    }
    if (!data.user) return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu không đúng." }, { status: 401 });

    const current = await getCurrentProfile();
    if (!current || !current.profile.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Tài khoản hiện không hoạt động. Vui lòng liên hệ CÁ'S HOA." }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true, user: { id: data.user.id, phone: parsed.data.phone }, profile: current.profile, redirectTo: getSafeRoleRedirect(current.profile.role, parsed.data.next) });
    if (current.profile.role === "staff" || current.profile.role === "admin") setManagementSessionCookie(response, current.user.id, current.profile.role);
    return response;
  } catch (error) {
    console.error("[auth.login] Unexpected server error", error);
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
