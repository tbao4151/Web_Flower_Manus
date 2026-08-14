import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { fetchCatalogProducts } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await fetchCatalogProducts(createSupabaseAdminClient(), { publishedOnly: true });
    return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không thể tải danh mục sản phẩm." }, { status: 503 });
  }
}
