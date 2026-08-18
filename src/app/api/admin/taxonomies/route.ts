import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const kindSchema = z.enum(["productTypes", "categories", "flowerTypes", "tones", "occasions"]);
const tableFor = (kind: z.infer<typeof kindSchema>) => kind === "productTypes" ? "product_types" : kind === "categories" || kind === "flowerTypes" ? "categories" : kind === "tones" ? "color_tones" : "occasions";
const canonicalKind = (kind: z.infer<typeof kindSchema>) => kind === "flowerTypes" ? "categories" : kind;
const inputSchema = z.object({
  kind: kindSchema,
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
});
const deleteSchema = z.object({
  kind: kindSchema,
  id: z.string().uuid(),
  operation: z.enum(["delete", "unlink_delete", "transfer_delete"]).default("delete"),
  replacementId: z.string().uuid().optional(),
});

type TaxonomyItem = { id: string; name: string; slug: string; is_active: boolean; display_order: number; created_at: string; usage_count?: number };
type SupabaseErrorLike = { code?: string; message?: string };

function errorMessage(error: unknown) {
  return String((error as SupabaseErrorLike | null)?.message || "");
}

function errorCode(error: unknown) {
  return String((error as SupabaseErrorLike | null)?.code || "");
}

function usageMap(rows: Array<Record<string, unknown>> | null | undefined, field: string) {
  const counts = new Map<string, number>();
  for (const row of rows || []) {
    const value = String(row[field] || "");
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

async function loadUsageCounts(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const [productTypes, categories, tones, occasions] = await Promise.all([
    supabase.from("products").select("product_type"),
    supabase.from("product_categories").select("category_id"),
    supabase.from("product_tones").select("tone_id"),
    supabase.from("product_occasions").select("occasion_id"),
  ]);
  const failed = [productTypes, categories, tones, occasions].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return {
    productTypes: usageMap((productTypes.data || []) as Array<Record<string, unknown>>, "product_type"),
    categories: usageMap((categories.data || []) as Array<Record<string, unknown>>, "category_id"),
    tones: usageMap((tones.data || []) as Array<Record<string, unknown>>, "tone_id"),
    occasions: usageMap((occasions.data || []) as Array<Record<string, unknown>>, "occasion_id"),
  };
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  const supabase = createSupabaseAdminClient();
  const kinds = ["productTypes", "categories", "tones", "occasions"] as const;
  try {
    const [results, usage] = await Promise.all([
      Promise.all(kinds.map(async (kind) => {
        const { data, error } = await supabase.from(tableFor(kind)).select("id, name, slug, is_active, display_order, created_at").order("display_order").order("name");
        if (error) throw error;
        return [kind, data || []] as const;
      })),
      loadUsageCounts(supabase),
    ]);
    const payload = Object.fromEntries(results) as Record<string, TaxonomyItem[]>;
    for (const kind of kinds) {
      const countMap = usage[canonicalKind(kind) as keyof typeof usage];
      payload[kind] = (payload[kind] || []).map((item) => ({ ...item, usage_count: countMap.get(kind === "productTypes" ? item.slug : item.id) || 0 }));
    }
    return NextResponse.json({ ...payload, flowerTypes: payload.categories || [] });
  } catch {
    return NextResponse.json({ error: "Không thể tải dữ liệu phân loại." }, { status: 500 });
  }
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
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin xoá phân loại chưa hợp lệ." }, { status: 400 });
  const { kind, id, operation, replacementId } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("delete_taxonomy_item", {
    target_kind: canonicalKind(kind),
    target_id: id,
    operation,
    replacement_product_type_id: replacementId || null,
  });
  if (!error) return NextResponse.json({ ok: true, result: data });

  const message = errorMessage(error);
  const usageMatch = message.match(/^taxonomy_in_use:(\d+)$/);
  if (usageMatch) {
    return NextResponse.json({ error: "Mục phân loại đang được sản phẩm sử dụng.", code: "TAXONOMY_IN_USE", usageCount: Number(usageMatch[1]) }, { status: 409 });
  }
  if (message === "replacement_product_type_required") return NextResponse.json({ error: "Hãy chọn dạng sản phẩm thay thế trước khi xoá.", code: "REPLACEMENT_REQUIRED" }, { status: 400 });
  if (message === "replacement_product_type_invalid") return NextResponse.json({ error: "Dạng sản phẩm thay thế không hợp lệ hoặc đang bị ẩn.", code: "REPLACEMENT_INVALID" }, { status: 400 });
  if (message === "taxonomy_not_found") return NextResponse.json({ error: "Không tìm thấy mục phân loại.", code: "TAXONOMY_NOT_FOUND" }, { status: 404 });
  if (errorCode(error) === "23503") return NextResponse.json({ error: "Không thể xoá vì mục này vừa phát sinh liên kết sản phẩm. Hãy tải lại dữ liệu rồi thử lại.", code: "TAXONOMY_IN_USE" }, { status: 409 });
  return NextResponse.json({ error: "Không thể xoá phân loại. Dữ liệu chưa được thay đổi.", code: "TAXONOMY_DELETE_FAILED" }, { status: 400 });
}
