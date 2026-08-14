import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const settingSchema = z.object({ key: z.enum(["announcement", "contact", "delivery"]), valueJson: z.record(z.string(), z.unknown()), isPublic: z.boolean().default(false) });

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
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("shop_settings").upsert({ key: parsed.data.key, value_json: parsed.data.valueJson, is_public: parsed.data.isPublic, updated_by: current.user.id, updated_at: new Date().toISOString() }).select("key, value_json, is_public, updated_at").single();
    if (error) return NextResponse.json({ error: "Không thể lưu cấu hình shop." }, { status: 500 });
    return NextResponse.json({ setting: data });
  } catch {
    return NextResponse.json({ error: "Dịch vụ quản trị tạm thời không khả dụng." }, { status: 503 });
  }
}
