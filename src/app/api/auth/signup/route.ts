import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";
import { gmailSchema, normalizeGmail, passwordSchema, phoneSchema, otpSchema } from "@/lib/auth-validation";
import { isAuthRateLimited } from "@/lib/auth-rate-limit";

const signupSchema = z.object({
  phone: phoneSchema,
  email: gmailSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu."),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Mật khẩu xác nhận không khớp.",
});

const emailSchema = z.object({ email: gmailSchema });
const verifySchema = z.object({ email: gmailSchema, token: otpSchema });

function publicAuthError(message = "Không thể hoàn tất yêu cầu tài khoản. Vui lòng thử lại sau.", status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) return publicAuthError(parsed.error.issues[0]?.message || "Thông tin đăng ký chưa hợp lệ.");

    const email = normalizeGmail(parsed.data.email);
    if (isAuthRateLimited(request, email)) return publicAuthError("Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.", 429);

    const admin = createSupabaseAdminClient();
    const { data: existingPhone, error: phoneLookupError } = await admin.from("profiles").select("id").eq("phone", parsed.data.phone).maybeSingle();
    if (phoneLookupError) return publicAuthError("Dịch vụ tài khoản tạm thời không khả dụng.", 503);
    if (existingPhone) return publicAuthError("Số điện thoại này đã được sử dụng cho một tài khoản khác.", 409);

    const supabase = await createSupabaseServerClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${siteUrl}/xac-nhan-email`,
        data: { phone: parsed.data.phone },
      },
    });

    if (error) {
      console.error("[auth.signup] Supabase Auth error", { code: error.code, status: error.status });
      return publicAuthError(error.code === "over_request_rate_limit" ? "Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại." : "Không thể tạo tài khoản. Vui lòng kiểm tra thông tin và thử lại.", error.code === "over_request_rate_limit" ? 429 : 400);
    }
    if (!data.user) return publicAuthError("Không thể tạo tài khoản. Vui lòng thử lại sau.", 503);

    return NextResponse.json({ ok: true, pendingVerification: true, email });
  } catch (error) {
    console.error("[auth.signup] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return publicAuthError("Dịch vụ tài khoản tạm thời không khả dụng.", 503);
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = emailSchema.safeParse(await request.json());
    if (!parsed.success) return publicAuthError("Vui lòng nhập đúng địa chỉ Gmail.");
    const email = normalizeGmail(parsed.data.email);
    if (isAuthRateLimited(request, `resend:${email}`)) return publicAuthError("Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.", 429);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      console.error("[auth.signup.resend] Supabase Auth error", { code: error.code, status: error.status });
      return publicAuthError("Không thể gửi lại mã lúc này. Vui lòng chờ một chút rồi thử lại.", error.code === "over_request_rate_limit" ? 429 : 400);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth.signup.resend] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return publicAuthError("Dịch vụ email tạm thời không khả dụng.", 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) return publicAuthError("Mã xác nhận không hợp lệ.");

    const email = normalizeGmail(parsed.data.email);
    if (isAuthRateLimited(request, `verify:${email}`)) return publicAuthError("Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.", 429);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: parsed.data.token, type: "email" });
    if (error || !data.user || !data.user.email_confirmed_at) {
      console.error("[auth.signup.verify] Supabase Auth error", { code: error?.code, status: error?.status });
      return publicAuthError("Mã xác nhận không đúng hoặc đã hết hạn.", 400);
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("id, phone, role, is_active").eq("id", data.user.id).maybeSingle();
    if (profileError || !profile || !profile.phone || profile.role !== "customer") {
      await supabase.auth.signOut();
      return publicAuthError("Chưa thể hoàn tất hồ sơ tài khoản. Vui lòng thử lại sau.", 409);
    }

    return NextResponse.json({ ok: true, complete: true, redirectTo: "/tai-khoan" });
  } catch (error) {
    console.error("[auth.signup.verify] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return publicAuthError("Dịch vụ xác nhận tạm thời không khả dụng.", 503);
  }
}
