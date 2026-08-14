import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeSocialUrl } from "@/lib/social";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("shop_settings")
      .select("key, value_json")
      .eq("is_public", true)
      .in("key", ["social_widget", "contact"]);

    if (error) return NextResponse.json({ error: "Không thể tải cài đặt liên hệ." }, { status: 500 });

    const socialWidget = data?.find((item) => item.key === "social_widget")?.value_json as Record<string, unknown> | undefined;
    const contact = data?.find((item) => item.key === "contact")?.value_json as Record<string, unknown> | undefined;
    const widgetEnabled = socialWidget?.enabled !== false;
    const instagramUrl = normalizeSocialUrl("instagram", socialWidget?.instagram_url ?? contact?.instagram);
    const zaloUrl = normalizeSocialUrl("zalo", socialWidget?.zalo_url ?? contact?.zalo);

    return NextResponse.json(
      { social: { enabled: widgetEnabled && Boolean(instagramUrl || zaloUrl), instagramUrl, zaloUrl } },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "Dịch vụ cài đặt tạm thời không khả dụng." }, { status: 503 });
  }
}
