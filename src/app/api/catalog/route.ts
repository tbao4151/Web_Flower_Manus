import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchCatalogMetadata, fetchCatalogProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const [products, metadata] = await Promise.all([fetchCatalogProducts(supabase, { publishedOnly: true }), fetchCatalogMetadata(supabase)]);
    return NextResponse.json({ products, metadata }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không thể tải danh sách sản phẩm và bộ lọc." }, { status: 503 });
  }
}
