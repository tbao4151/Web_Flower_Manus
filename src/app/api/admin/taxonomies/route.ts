import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const kindSchema = z.enum(["productTypes", "categories", "flowerTypes", "tones", "occasions"]);
const inputSchema = z.object({
  kind: kindSchema,
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
});
const tableFor = (kind: z.infer<typeof kindSchema>) => kind === "productTypes" ? "product_types" : kind === "categories" || kind === "flowerTypes" ? "categories" : kind === "tones" ? "color_tones" : "occasions";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  const supabase = createSupabaseAdminClient();
  const kinds = ["productTypes", "categories", "tones", "occasions"] as const;
  const results = await Promise.all(kinds.map(async (kind) => {
    const { data, error } = await supabase.from(tableFor(kind)).select("id, name, slug, is_active, display_order, created_at").order("display_order").order("name");
    return [kind, error ? [] : data] as const;
  }));
  const payload = Object.fromEntries(results);
  return NextResponse.json({ ...payload, flowerTypes: payload.categories || [] });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin phân loại chưa hợp lệ." }, { status: 400 });
  const { kind, id, name, slug, isActive = true, displayOrder = 0 } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const table = tableFor(kind);
  const query = id
    ? supabase.from(table).update({ name, slug, is_active: isActive, display_order: displayOrder }).eq("id", id).select("id, name, slug, is_active, display_order").single()
    : supabase.from(table).insert({ name, slug, is_active: isActive, display_order: displayOrder }).select("id, name, slug, is_active, display_order").single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Không thể lưu phân loại. Tên hoặc slug có thể đã tồn tại, hoặc loại hoa đang được sản phẩm sử dụng." }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  const parsed = z.object({ kind: kindSchema, id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thiếu phân loại cần ẩn." }, { status: 400 });
  const { error } = await createSupabaseAdminClient().from(tableFor(parsed.data.kind)).update({ is_active: false }).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "Không thể ẩn phân loại." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
