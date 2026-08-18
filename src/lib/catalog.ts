import type { SupabaseClient } from "@supabase/supabase-js";
import { availabilityStatusFromQuantity, type AvailabilityStatus, type SaleMode } from "@/lib/inventory";
import { defaultProductImageCrop, products as fallbackProducts, type Product, type ProductImage, type ProductType } from "@/lib/products";

export type CatalogFilterConfig = { priceMaxVnd: number; priceStepVnd: number };
export type CatalogMetadata = { productTypes: Array<{ id: string; name: string; slug: string }>; categories: Array<{ id: string; name: string; slug: string }>; flowerTypes: Array<{ id: string; name: string; slug: string }>; tones: Array<{ id: string; name: string; slug: string }>; occasions: Array<{ id: string; name: string; slug: string }>; filterConfig: CatalogFilterConfig };

export type CatalogProductRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  product_type: string;
  price_vnd: number;
  sale_price_vnd: number | null;
  description: string | null;
  composition: string | null;
  featured: boolean;
  featured_position: 1 | 2 | 3 | null;
  status: "draft" | "published" | "hidden" | "archived";
  sale_mode: SaleMode;
  preorder_min_hours: number | null;
  show_when_out_of_stock: boolean;
  source_caption: string | null;
  source_reference: string | null;
  created_at: string;
  product_images?: Array<{ id: string; storage_path: string; alt_text: string; display_order: number; is_cover: boolean; crop_x?: number | null; crop_y?: number | null; crop_zoom?: number | null; focal_x?: number | null; focal_y?: number | null }>;
  product_categories?: Array<{ category_id: string }>;
  product_tones?: Array<{ tone_id: string }>;
  product_occasions?: Array<{ occasion_id: string }>;
};

type TaxonomyRow = { id: string; name: string; slug: string };
type CatalogAvailability = { quantity: number; status: AvailabilityStatus };

export const publicProductSelect = [
  "id", "sku", "slug", "name", "product_type", "price_vnd", "sale_price_vnd", "description", "composition", "featured", "featured_position", "status", "sale_mode", "preorder_min_hours", "show_when_out_of_stock", "source_caption", "source_reference", "created_at",
  "product_images(id, storage_path, alt_text, display_order, is_cover, crop_x, crop_y, crop_zoom, focal_x, focal_y)",
  "product_categories(category_id)", "product_tones(tone_id)", "product_occasions(occasion_id)",
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
  availability?: CatalogAvailability,
  inventoryConfigured = true,
): Product {
  const images = [...(row.product_images || [])].sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id));
  const cover = images.find((image) => image.is_cover) || images[0];
  const imageItems: ProductImage[] = images.map((item) => ({
    id: item.id,
    src: publicUrlForPath(supabase, item.storage_path),
    alt: item.alt_text || row.name,
    cropX: Number.isFinite(Number(item.crop_x)) ? Number(item.crop_x) : defaultProductImageCrop.cropX,
    cropY: Number.isFinite(Number(item.crop_y)) ? Number(item.crop_y) : defaultProductImageCrop.cropY,
    cropZoom: Number.isFinite(Number(item.crop_zoom)) ? Number(item.crop_zoom) : defaultProductImageCrop.cropZoom,
    focalX: Number.isFinite(Number(item.focal_x)) ? Number(item.focal_x) : defaultProductImageCrop.focalX,
    focalY: Number.isFinite(Number(item.focal_y)) ? Number(item.focal_y) : defaultProductImageCrop.focalY,
  })).filter((item) => Boolean(item.src));
  const coverImage = imageItems.find((item) => item.id === cover?.id) || imageItems[0];
  const image = coverImage?.src || "";
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
    imageCrop: coverImage ? { cropX: coverImage.cropX, cropY: coverImage.cropY, cropZoom: coverImage.cropZoom, focalX: coverImage.focalX, focalY: coverImage.focalY } : undefined,
    imageItems,
    gallery: imageItems.filter((item) => item.id !== coverImage?.id).map((item) => item.src).filter(Boolean),
    categories: taxonomyNames(row.product_categories, "category_id", taxonomies.categories),
    flowerTypes: taxonomyNames(row.product_categories, "category_id", taxonomies.categories),
    tones: taxonomyNames(row.product_tones, "tone_id", taxonomies.tones),
    occasions: taxonomyNames(row.product_occasions, "occasion_id", taxonomies.occasions),
    featured: row.featured,
    ...(row.featured_position != null ? { featuredPosition: row.featured_position } : {}),
    status: row.status === "draft" ? "hidden" : row.status,
    ...(inventoryConfigured ? { availabilityStatus: availability?.status, availableQuantity: availability?.quantity, inventoryConfigured: true } : { inventoryConfigured: false }),
    saleMode: row.sale_mode,
    ...(row.preorder_min_hours != null ? { preorderMinHours: row.preorder_min_hours } : {}),
    showWhenOutOfStock: row.show_when_out_of_stock,
    sourceCaption: row.source_caption || "",
    sourceReference: row.source_reference || "",
    sourceDate: row.created_at.slice(0, 10),
  };
}

export async function fetchCatalogMetadata(supabase: SupabaseClient): Promise<CatalogMetadata> {
  const [productTypesResult, categoryResult, toneResult, occasionResult, settingsResult] = await Promise.all([
    supabase.from("product_types").select("id, name, slug").eq("is_active", true).order("display_order").order("name"),
    supabase.from("categories").select("id, name, slug").eq("is_active", true).order("display_order").order("name"),
    supabase.from("color_tones").select("id, name, slug").eq("is_active", true).order("display_order").order("name"),
    supabase.from("occasions").select("id, name, slug").eq("is_active", true).order("display_order").order("name"),
    supabase.from("shop_settings").select("value_json").eq("key", "catalog_filters").eq("is_public", true).maybeSingle(),
  ]);
  const value = (settingsResult.data?.value_json || {}) as { price_max_vnd?: unknown; price_step_vnd?: unknown };
  const priceMaxVnd = Number.isInteger(Number(value.price_max_vnd)) && Number(value.price_max_vnd) > 0 ? Number(value.price_max_vnd) : 0;
  const priceStepVnd = Number.isInteger(Number(value.price_step_vnd)) && Number(value.price_step_vnd) > 0 ? Number(value.price_step_vnd) : 0;
  return {
    productTypes: (productTypesResult.data || []) as Array<{ id: string; name: string; slug: string }>,
    categories: (categoryResult.data || []) as Array<{ id: string; name: string; slug: string }>,
    flowerTypes: (categoryResult.data || []) as Array<{ id: string; name: string; slug: string }>,
    tones: (toneResult.data || []) as Array<{ id: string; name: string; slug: string }>,
    occasions: (occasionResult.data || []) as Array<{ id: string; name: string; slug: string }>,
    filterConfig: { priceMaxVnd, priceStepVnd },
  };
}

export async function fetchCatalogProducts(supabase: SupabaseClient, options: { slug?: string; publishedOnly?: boolean; featuredOnly?: boolean; includeUnavailable?: boolean } = {}) {
  let query = supabase.from("products").select(publicProductSelect).order("featured", { ascending: false }).order("created_at", { ascending: false });
  if (options.slug) query = query.eq("slug", options.slug);
  if (options.featuredOnly) query = query.not("featured_position", "is", null);
  if (options.publishedOnly !== false) query = query.eq("status", "published");
  const [productResult, categoryResult, toneResult, occasionResult, settingsResult] = await Promise.all([
    query,
    supabase.from("categories").select("id, name, slug").eq("is_active", true),
    supabase.from("color_tones").select("id, name, slug").eq("is_active", true),
    supabase.from("occasions").select("id, name, slug").eq("is_active", true),
    supabase.from("shop_settings").select("low_stock_threshold").eq("key", "inventory").maybeSingle(),
  ]);
  if (productResult.error) throw productResult.error;
  const rows = (productResult.data || []) as unknown as CatalogProductRow[];
  const recipeResult = rows.length
    ? await supabase.from("product_ingredients").select("product_id").in("product_id", rows.map((row) => row.id))
    : { data: [], error: null };
  if (recipeResult.error) throw recipeResult.error;
  const configuredProductIds = new Set((recipeResult.data || []).map((item) => item.product_id));
  const taxonomies = {
    categories: new Map((categoryResult.data || []).map((item) => [item.id, item as TaxonomyRow])),
    tones: new Map((toneResult.data || []).map((item) => [item.id, item as TaxonomyRow])),
    occasions: new Map((occasionResult.data || []).map((item) => [item.id, item as TaxonomyRow])),
  };
  const lowStockThreshold = Math.max(0, Number(settingsResult.data?.low_stock_threshold ?? 2));
  const availabilityEntries = await Promise.all(rows.filter((row) => configuredProductIds.has(row.id)).map(async (row) => {
    const { data, error } = await supabase.rpc("compute_product_availability", { target_product_id: row.id });
    if (error) throw error;
    const quantity = Math.max(0, Number(data || 0));
    return [row.id, { quantity, status: availabilityStatusFromQuantity(quantity, lowStockThreshold) }] as const;
  }));
  const availability = new Map(availabilityEntries);
  return rows
    .map((row) => mapCatalogProduct(supabase, row, taxonomies, availability.get(row.id), configuredProductIds.has(row.id)))
    .filter((product) => {
      if (options.includeUnavailable || options.publishedOnly === false || product.status !== "published" || !product.inventoryConfigured) return true;
      return product.saleMode === "preorder" || product.availabilityStatus !== "OUT_OF_STOCK" || product.showWhenOutOfStock;
    });
}

export const fallbackCatalogProducts = fallbackProducts;
