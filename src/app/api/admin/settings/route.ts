import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { normalizeSocialUrl } from "@/lib/social";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const settingSchema = z.object({
  key: z.enum(["announcement", "contact", "delivery", "social_widget"]),
  valueJson: z.record(z.string(), z.unknown()),
  isPublic: z.boolean().default(false),
});

function normalizeSetting(key: string, value: Record<string, unknown>) {
  if (key !== "social_widget") return { valueJson: value, isPublic: undefined as boolean | undefined, error: null as string | null };

  const rawInstagram = typeof value.instagram_url === "string" ? value.instagram_url.trim() : "";
  const rawZalo = typeof value.zalo_url === "string" ? value.zalo_url.trim() : "";
  const instagramUrl = normalizeSocialUrl("instagram", rawInstagram);
  const zaloUrl = normalizeSocialUrl("zalo", rawZalo);
  if ((rawInstagram && !instagramUrl) || (rawZalo && !zaloUrl)) {
    return { valueJson: null, isPublic: true, error: "URL Instagram hoặc Zalo chưa hợp lệ." };
  }

  return {
    valueJson: { enabled: value.enabled === true, instagram_url: instagramUrl, zalo_url: zaloUrl },
    isPublic: true,
    error: null,
  };
}

export async function GET() {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có quyền xem cấu hình shop." }, { status: 403 });
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("shop_settings").select("key, value_json, is_public, updated_at, updated_by").order("key");
    if (error) return NextResponse.json({ error: "Không thể tải cấu hình shop." }, { status: 500 });
    return NextResponse.json({ settings: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Dịch vụ quản trị tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const current = await requireAdmin();
  if (!current) return NextResponse.json({ error: "Chỉ Admin mới có quyền sửa cấu hình shop." }, { status: 403 });
  const parsed = settingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cấu hình chưa hợp lệ." }, { status: 400 });

  const normalized = normalizeSetting(parsed.data.key, parsed.data.valueJson);
  if (normalized.error) return NextResponse.json({ error: normalized.error }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("shop_settings")
      .upsert({
        key: parsed.data.key,
        value_json: normalized.valueJson,
        is_public: normalized.isPublic ?? parsed.data.isPublic,
        updated_by: current.user.id,
        updated_at: new Date().toISOString(),
      })
      .select("key, value_json, is_public, updated_at")
      .single();
    if (error) return NextResponse.json({ error: "Không thể lưu cấu hình shop." }, { status: 500 });
    return NextResponse.json({ setting: data });
  } catch {
    return NextResponse.json({ error: "Dịch vụ quản trị tạm thời không khả dụng." }, { status: 503 });
  }
}
