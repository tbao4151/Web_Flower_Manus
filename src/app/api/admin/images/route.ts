import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const imageSchema = z.object({ id: z.string().uuid().optional(), productId: z.string().uuid(), storagePath: z.string().trim().min(1).max(500), altText: z.string().trim().max(200).default(""), displayOrder: z.number().int().min(0).max(1000).default(0), isCover: z.boolean().default(false) });

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể quản lý hình ảnh." }, { status: 403 });
  const parsed = imageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin hình ảnh chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  if (parsed.data.isCover) await supabase.from("product_images").update({ is_cover: false }).eq("product_id", parsed.data.productId);
  const { data, error } = await supabase.from("product_images").insert({ product_id: parsed.data.productId, storage_path: parsed.data.storagePath, alt_text: parsed.data.altText, display_order: parsed.data.displayOrder, is_cover: parsed.data.isCover }).select("id, product_id, storage_path, alt_text, display_order, is_cover").single();
  if (error) return NextResponse.json({ error: "Không thể lưu hình ảnh." }, { status: 400 });
  return NextResponse.json({ image: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể quản lý hình ảnh." }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid(), productId: z.string().uuid(), altText: z.string().trim().max(200).optional(), displayOrder: z.number().int().min(0).max(1000).optional(), isCover: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin hình ảnh chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  if (parsed.data.isCover) await supabase.from("product_images").update({ is_cover: false }).eq("product_id", parsed.data.productId);
  const { id, productId, ...values } = parsed.data;
  const update: Record<string, unknown> = {};
  if (values.altText !== undefined) update.alt_text = values.altText;
  if (values.displayOrder !== undefined) update.display_order = values.displayOrder;
  if (values.isCover !== undefined) update.is_cover = values.isCover;
  const { data, error } = await supabase.from("product_images").update(update).eq("id", id).eq("product_id", productId).select("id, product_id, storage_path, alt_text, display_order, is_cover").single();
  if (error) return NextResponse.json({ error: "Không thể cập nhật hình ảnh." }, { status: 400 });
  return NextResponse.json({ image: data });
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xoá hình ảnh." }, { status: 403 });
  const parsed = z.object({ id: z.string().uuid(), productId: z.string().uuid(), storagePath: z.string().trim().min(1).max(500) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thiếu thông tin hình ảnh." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("product_images").delete().eq("id", parsed.data.id).eq("product_id", parsed.data.productId);
  if (error) return NextResponse.json({ error: "Không thể xoá hình ảnh." }, { status: 400 });
  await supabase.storage.from("product-images").remove([parsed.data.storagePath]);
  return NextResponse.json({ ok: true });
}
