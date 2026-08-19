import { NextResponse } from "next/server";
import { isSafeInternalPath } from "@/lib/auth-validation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next");
  const safeNext = isSafeInternalPath(next) ? next : "/tai-khoan";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error || !data.url) return NextResponse.redirect(new URL("/dang-nhap?oauth=error", origin));
    return NextResponse.redirect(data.url);
  } catch (error) {
    console.error("[auth.google.start] Unexpected server error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.redirect(new URL("/dang-nhap?oauth=error", origin));
  }
}
