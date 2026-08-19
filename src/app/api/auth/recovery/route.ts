import { NextResponse } from "next/server";
import { z } from "zod";
import { clearManagementSessionCookie, clearRecoverySessionCookie, getCurrentUser, getRecoverySessionForUser, setRecoverySessionCookie } from "@/lib/auth";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { gmailSchema, normalizeGmail, otpSchema, passwordSchema } from "@/lib/auth-validation";
import { isAuthRateLimited } from "@/lib/auth-rate-limit";

const emailSchema = z.object({ email: gmailSchema });
const verifySchema = z.object({ email: gmailSchema, token: otpSchema });
const resetSchema = z.object({ password: passwordSchema, confirmPassword: z.string().min(1) }).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Mật khẩu xác nhận không khớp." });
const GENERIC_MESSAGE = "Nếu Gmail này được liên kết với tài khoản CÁ'S HOA, mã khôi phục sẽ được gửi tới email.";

export async function POST(request: Request) {
  try {
    const parsed = emailSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: GENERIC_MESSAGE });
    const email = normalizeGmail(parsed.data.email);
    if (isAuthRateLimited(request, `recovery:${email}`)) return NextResponse.json({ message: GENERIC_MESSAGE });

    const supabase = await createSupabaseServerClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/dat-lai-mat-khau` });
    if (error) console.error("[auth.recovery.request] Supabase Auth error", { code: error.code, status: error.status });
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("[auth.recovery.request] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Mã khôi phục không đúng hoặc đã hết hạn." }, { status: 400 });
    const email = normalizeGmail(parsed.data.email);
    if (isAuthRateLimited(request, `recovery-verify:${email}`)) return NextResponse.json({ error: "Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại." }, { status: 429 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: parsed.data.token, type: "recovery" });
    if (error || !data.user) {
      console.error("[auth.recovery.verify] Supabase Auth error", { code: error?.code, status: error?.status });
      return NextResponse.json({ error: "Mã khôi phục không đúng hoặc đã hết hạn." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles").select("id, is_active").eq("id", data.user.id).maybeSingle();
    if (!profile || profile.is_active === false) return NextResponse.json({ error: "Tài khoản hiện không hoạt động." }, { status: 403 });

    const response = NextResponse.json({ ok: true, redirectTo: "/dat-lai-mat-khau" });
    setRecoverySessionCookie(response, data.user.id);
    return response;
  } catch (error) {
    console.error("[auth.recovery.verify] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Không thể xác nhận mã khôi phục lúc này." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = resetSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Mật khẩu mới chưa hợp lệ." }, { status: 400 });

    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: "Phiên khôi phục không hợp lệ hoặc đã hết hạn." }, { status: 401 });
    const recoverySession = await getRecoverySessionForUser(currentUser.id);
    if (!recoverySession) return NextResponse.json({ error: "Phiên khôi phục không hợp lệ hoặc đã hết hạn." }, { status: 403 });

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      console.error("[auth.recovery.update] Supabase Auth error", { code: error.code, status: error.status });
      return NextResponse.json({ error: "Không thể đổi mật khẩu lúc này. Vui lòng thử lại." }, { status: 400 });
    }

    await supabase.auth.signOut({ scope: "global" });
    const response = NextResponse.json({ ok: true, redirectTo: "/dang-nhap?reset=success" });
    clearManagementSessionCookie(response);
    clearRecoverySessionCookie(response);
    return response;
  } catch (error) {
    console.error("[auth.recovery.update] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Dịch vụ đổi mật khẩu tạm thời không khả dụng." }, { status: 503 });
  }
}
