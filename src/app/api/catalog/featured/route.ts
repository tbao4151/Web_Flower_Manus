import { NextResponse } from "next/server";
import { fetchCatalogProducts } from "@/lib/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await fetchCatalogProducts(createSupabaseAdminClient(), {
      publishedOnly: true,
      featuredOnly: true,
      includeUnavailable: true,
    });
    const featured = products
      .filter((product) => product.featuredPosition && product.image)
      .map(({ id, slug, name, image, featuredPosition }) => ({ id, slug, name, image, featuredPosition }));
    return NextResponse.json(
      { products: featured },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Không thể tải mẫu nổi bật trang chủ." }, { status: 503 });
  }
}
