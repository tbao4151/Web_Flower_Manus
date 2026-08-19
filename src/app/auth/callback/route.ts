import { NextResponse } from "next/server";
import { clearManagementSessionCookie, getSafeRoleRedirect, setManagementSessionCookie } from "@/lib/auth";
import { isGmailAddress, isSafeInternalPath } from "@/lib/auth-validation";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const safeNext = isSafeInternalPath(requestedNext) ? requestedNext : "/tai-khoan";

  if (!code) return NextResponse.redirect(new URL("/dang-nhap?oauth=error", origin));

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth.google.callback] Code exchange error", { code: exchangeError.code, status: exchangeError.status });
      return NextResponse.redirect(new URL("/dang-nhap?oauth=error", origin));
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user || !user.email || !isGmailAddress(user.email)) {
      if (user) {
        const admin = createSupabaseAdminClient();
        const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
        if (deleteError) console.error("[auth.google.callback] Rejected user cleanup error", { code: deleteError.code, status: deleteError.status });
      }
      const response = NextResponse.redirect(new URL("/dang-nhap?oauth=gmail-only", origin));
      clearManagementSessionCookie(response);
      await supabase.auth.signOut();
      return response;
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("id, phone, role, is_active").eq("id", user.id).maybeSingle();
    if (profileError || !profile || profile.is_active === false) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/dang-nhap?oauth=error", origin));
    }

    if (!profile.phone) {
      return NextResponse.redirect(new URL(`/hoan-tat-ho-so?next=${encodeURIComponent(safeNext)}`, origin));
    }

    const response = NextResponse.redirect(new URL(getSafeRoleRedirect(profile.role, safeNext), origin));
    if (profile.role === "staff" || profile.role === "admin") setManagementSessionCookie(response, user.id, profile.role);
    return response;
  } catch (error) {
    console.error("[auth.google.callback] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.redirect(new URL("/dang-nhap?oauth=error", origin));
  }
}
