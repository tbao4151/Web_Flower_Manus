import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentProfile, getSafeRoleRedirect } from "@/lib/auth";
import { isSafeInternalPath, phoneSchema } from "@/lib/auth-validation";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const onboardingSchema = z.object({ phone: phoneSchema, next: z.string().trim().max(512).optional() });

export async function GET() {
  try {
    const current = await getCurrentProfile();
    if (!current) return NextResponse.json({ error: "Bạn cần đăng nhập để hoàn tất hồ sơ." }, { status: 401 });
    return NextResponse.json({ email: current.user.email, phone: current.profile.phone, profile: current.profile });
  } catch (error) {
    console.error("[auth.onboarding.get] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Không thể tải thông tin hồ sơ lúc này." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const current = await getCurrentProfile();
    if (!current) return NextResponse.json({ error: "Bạn cần đăng nhập để hoàn tất hồ sơ." }, { status: 401 });
    if (current.profile.phone) return NextResponse.json({ ok: true, redirectTo: getSafeRoleRedirect(current.profile.role) });

    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Số điện thoại chưa hợp lệ." }, { status: 400 });

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("profiles").update({ phone: parsed.data.phone, updated_at: new Date().toISOString() }).eq("id", current.user.id).is("phone", null).select("id, phone, role, is_active").maybeSingle();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Số điện thoại này đã được sử dụng cho một tài khoản khác." }, { status: 409 });
      console.error("[auth.onboarding.update] Profile update error", { code: error.code });
      return NextResponse.json({ error: "Không thể lưu số điện thoại lúc này." }, { status: 503 });
    }
    if (!data) return NextResponse.json({ error: "Hồ sơ đã được hoàn tất hoặc không còn khả dụng." }, { status: 409 });

    const next = isSafeInternalPath(parsed.data.next) ? parsed.data.next : null;
    return NextResponse.json({ ok: true, redirectTo: getSafeRoleRedirect(data.role, next) });
  } catch (error) {
    console.error("[auth.onboarding.post] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Dịch vụ hoàn tất hồ sơ tạm thời không khả dụng." }, { status: 503 });
  }
}
