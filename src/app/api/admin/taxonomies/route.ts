import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const kindSchema = z.enum(["categories", "tones", "occasions"]);
const inputSchema = z.object({ kind: kindSchema, id: z.string().uuid().optional(), name: z.string().trim().min(1).max(80), slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/), isActive: z.boolean().optional(), displayOrder: z.number().int().min(0).max(10000).optional() });
const tableFor = (kind: z.infer<typeof kindSchema>) => kind === "categories" ? "categories" : kind === "tones" ? "color_tones" : "occasions";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  const supabase = createSupabaseAdminClient();
  const results = await Promise.all((['categories', 'tones', 'occasions'] as const).map(async (kind) => {
    const { data, error } = await supabase.from(tableFor(kind)).select("id, name, slug, is_active, display_order, created_at").order("display_order").order("name");
    return [kind, error ? [] : data] as const;
  }));
  return NextResponse.json(Object.fromEntries(results));
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin taxonomy chưa hợp lệ." }, { status: 400 });
  const { kind, id, name, slug, isActive = true, displayOrder = 0 } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const table = tableFor(kind);
  const query = id ? supabase.from(table).update({ name, slug, is_active: isActive, display_order: displayOrder }).eq("id", id).select("id, name, slug, is_active, display_order").single() : supabase.from(table).insert({ name, slug, is_active: isActive, display_order: displayOrder }).select("id, name, slug, is_active, display_order").single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Không thể lưu taxonomy. Tên hoặc slug có thể đã tồn tại." }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  const parsed = z.object({ kind: kindSchema, id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thiếu taxonomy cần xóa." }, { status: 400 });
  const { error } = await createSupabaseAdminClient().from(tableFor(parsed.data.kind)).update({ is_active: false }).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "Không thể ẩn taxonomy." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
