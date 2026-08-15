import type { SupabaseClient } from "@supabase/supabase-js";
import { products as fallbackProducts, type Product, type ProductType } from "@/lib/products";

export type CatalogProductRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  product_type: ProductType;
  price_vnd: number;
  sale_price_vnd: number | null;
  description: string | null;
  composition: string | null;
  featured: boolean;
  status: "draft" | "published" | "hidden" | "archived";
  source_caption: string | null;
  source_reference: string | null;
  created_at: string;
  product_images?: Array<{
    id: string;
    storage_path: string;
    alt_text: string;
    display_order: number;
    is_cover: boolean;
  }>;
  product_categories?: Array<{ category_id: string }>;
  product_tones?: Array<{ tone_id: string }>;
  product_occasions?: Array<{ occasion_id: string }>;
};

type TaxonomyRow = { id: string; name: string; slug: string };

export const publicProductSelect = [
  "id",
  "sku",
  "slug",
  "name",
  "product_type",
  "price_vnd",
  "sale_price_vnd",
  "description",
  "composition",
  "featured",
  "status",
  "source_caption",
  "source_reference",
  "created_at",
  "product_images(id, storage_path, alt_text, display_order, is_cover)",
  "product_categories(category_id)",
  "product_tones(tone_id)",
  "product_occasions(occasion_id)",
].join(", ");

const publicUrlForPath = (supabase: SupabaseClient, storagePath: string) => {
  if (!storagePath) return "";
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://") || storagePath.startsWith("/")) return storagePath;
  return supabase.storage.from("product-images").getPublicUrl(storagePath).data.publicUrl;
};

const taxonomyNames = (relations: Array<{ category_id?: string; tone_id?: string; occasion_id?: string }> | undefined, key: "category_id" | "tone_id" | "occasion_id", lookup: Map<string, TaxonomyRow>) =>
  (relations || []).map((relation) => lookup.get(String(relation[key] || ""))?.name).filter((name): name is string => Boolean(name));

export function mapCatalogProduct(
  supabase: SupabaseClient,
  row: CatalogProductRow,
  taxonomies: { categories: Map<string, TaxonomyRow>; tones: Map<string, TaxonomyRow>; occasions: Map<string, TaxonomyRow> },
): Product {
  const images = [...(row.product_images || [])].sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id));
  const cover = images.find((image) => image.is_cover) || images[0];
  const image = cover ? publicUrlForPath(supabase, cover.storage_path) : "";
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name.normalize("NFC"),
    type: row.product_type,
    price: row.price_vnd,
    ...(row.sale_price_vnd != null ? { salePrice: row.sale_price_vnd } : {}),
    description: row.description || "",
    ...(row.composition ? { composition: row.composition } : {}),
    image,
    gallery: images.filter((item) => item.id !== cover?.id).map((item) => publicUrlForPath(supabase, item.storage_path)).filter(Boolean),
    categories: taxonomyNames(row.product_categories, "category_id", taxonomies.categories),
    tones: taxonomyNames(row.product_tones, "tone_id", taxonomies.tones),
    occasions: taxonomyNames(row.product_occasions, "occasion_id", taxonomies.occasions),
    featured: row.featured,
    status: row.status === "draft" ? "hidden" : row.status,
    sourceCaption: row.source_caption || "",
    sourceReference: row.source_reference || "",
    sourceDate: row.created_at.slice(0, 10),
  };
}

export async function fetchCatalogProducts(supabase: SupabaseClient, options: { slug?: string; publishedOnly?: boolean } = {}) {
  let query = supabase.from("products").select(publicProductSelect).order("featured", { ascending: false }).order("created_at", { ascending: false });
  if (options.slug) query = query.eq("slug", options.slug);
  if (options.publishedOnly !== false) query = query.eq("status", "published");
  const [productResult, categoryResult, toneResult, occasionResult] = await Promise.all([
    query,
    supabase.from("categories").select("id, name, slug").eq("is_active", true),
    supabase.from("color_tones").select("id, name, slug").eq("is_active", true),
    supabase.from("occasions").select("id, name, slug").eq("is_active", true),
  ]);
  if (productResult.error) throw productResult.error;
  const taxonomies = {
    categories: new Map((categoryResult.data || []).map((item) => [item.id, item as TaxonomyRow])),
    tones: new Map((toneResult.data || []).map((item) => [item.id, item as TaxonomyRow])),
    occasions: new Map((occasionResult.data || []).map((item) => [item.id, item as TaxonomyRow])),
  };
  return ((productResult.data || []) as unknown as CatalogProductRow[]).map((row) => mapCatalogProduct(supabase, row, taxonomies));
}

export const fallbackCatalogProducts = fallbackProducts;
