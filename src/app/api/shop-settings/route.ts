import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getPublicShopSocialSettings } from "@/lib/social";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const social = await getPublicShopSocialSettings(supabase);
    return NextResponse.json(
      { social },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "Dịch vụ cài đặt tạm thời không khả dụng." }, { status: 503 });
  }
}
