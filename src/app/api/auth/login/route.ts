import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserByPhone, getCurrentProfile, getSafeRoleRedirect, setManagementSessionCookie } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { gmailSchema, isGmailAddress, normalizeGmail, normalizeVietnamPhone, passwordSchema, phoneSchema } from "@/lib/auth-validation";
import { isAuthRateLimited } from "@/lib/auth-rate-limit";

const identifierSchema = z.string().trim().min(1).max(320);
const loginSchema = z.object({
  identifier: identifierSchema,
  password: passwordSchema,
  next: z.string().trim().max(512).optional(),
  reauth: z.coerce.boolean().optional().default(false),
});

const GENERIC_ERROR = "Email/Số điện thoại hoặc mật khẩu không chính xác.";

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });

    const rawIdentifier = parsed.data.identifier.trim();
    const isEmail = rawIdentifier.includes("@");
    let email = "";

    if (isEmail) {
      const parsedEmail = gmailSchema.safeParse(rawIdentifier);
      if (!parsedEmail.success) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
      email = normalizeGmail(parsedEmail.data);
    } else {
      const phone = normalizeVietnamPhone(rawIdentifier);
      const parsedPhone = phoneSchema.safeParse(phone);
      if (!parsedPhone.success) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
      const resolved = await getAuthUserByPhone(parsedPhone.data);
      if (!resolved?.user.email) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
      email = normalizeGmail(resolved.user.email);
    }

    if (!isGmailAddress(email)) return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    if (isAuthRateLimited(request, email)) return NextResponse.json({ error: "Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại." }, { status: 429 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error || !data.user) {
      console.error("[auth.login] Supabase Auth error", { code: error?.code, status: error?.status });
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    const current = await getCurrentProfile();
    if (!current || !current.profile.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    if (!current.profile.phone) {
      return NextResponse.json({ ok: true, redirectTo: "/hoan-tat-ho-so" });
    }

    const response = NextResponse.json({
      ok: true,
      user: { id: current.user.id },
      profile: current.profile,
      redirectTo: getSafeRoleRedirect(current.profile.role, parsed.data.next),
      managementRequired: current.profile.role === "staff" || current.profile.role === "admin" ? Boolean(parsed.data.reauth) : false,
    });
    if (current.profile.role === "staff" || current.profile.role === "admin") setManagementSessionCookie(response, current.user.id, current.profile.role);
    return response;
  } catch (error) {
    console.error("[auth.login] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
