import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const BUCKET = "product-images";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const imageIdSchema = z.object({ id: z.string().uuid(), productId: z.string().uuid() });
const cropValue = z.number().finite().min(0).max(1);
const cropZoom = z.number().finite().min(1).max(3);

const extensionFor = (file: File) => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]{2,5}$/.test(extension)) return extension === "jpeg" ? "jpg" : extension;
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
};

const publicUrl = (supabase: ReturnType<typeof createSupabaseAdminClient>, storagePath: string) =>
  supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;

async function productExists(productId: string) {
  const { data, error } = await createSupabaseAdminClient().from("products").select("id").eq("id", productId).maybeSingle();
  return !error && Boolean(data);
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể tải hình ảnh." }, { status: 403 });
  const formData = await request.formData();
  const productId = z.string().uuid().safeParse(String(formData.get("productId") || ""));
  const altText = z.string().trim().max(200).safeParse(String(formData.get("altText") || ""));
  const setCover = formData.get("setCover") === "true";
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (!productId.success || !altText.success || !files.length) return NextResponse.json({ error: "Vui lòng chọn ít nhất một ảnh hợp lệ." }, { status: 400 });
  if (files.length > 10) return NextResponse.json({ error: "Mỗi lần chỉ được tải tối đa 10 ảnh." }, { status: 400 });
  if (!await productExists(productId.data)) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
  for (const file of files) {
    if (!allowedMimeTypes.has(file.type) || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Ảnh phải là JPG, PNG hoặc WebP và không quá 10MB mỗi file." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase.from("product_images").select("id, display_order, is_cover").eq("product_id", productId.data).order("display_order").order("created_at");
  if (existingError) return NextResponse.json({ error: "Không thể đọc danh sách hình ảnh hiện tại." }, { status: 500 });
  const uploadedPaths: string[] = [];
  const insertedImages: Array<Record<string, unknown>> = [];
  try {
    if (setCover && existing?.some((image) => image.is_cover)) {
      const { error } = await supabase.from("product_images").update({ is_cover: false }).eq("product_id", productId.data);
      if (error) throw error;
    }
    let nextOrder = Math.max(-1, ...(existing || []).map((image) => image.display_order)) + 1;
    for (const [index, file] of files.entries()) {
      const storagePath = `${productId.data}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const upload = await supabase.storage.from(BUCKET).upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false, cacheControl: "31536000" });
      if (upload.error) throw upload.error;
      uploadedPaths.push(storagePath);
      const isCover = (setCover && index === 0) || (!existing?.length && index === 0);
      if (isCover) {
        const { error } = await supabase.from("product_images").update({ is_cover: false }).eq("product_id", productId.data);
        if (error) throw error;
      }
      const { data, error } = await supabase.from("product_images").insert({ product_id: productId.data, storage_path: storagePath, alt_text: altText.data, display_order: nextOrder++, is_cover: isCover, mime_type: file.type }).select("id, product_id, storage_path, alt_text, display_order, is_cover, mime_type, crop_x, crop_y, crop_zoom, focal_x, focal_y").single();
      if (error || !data) throw error || new Error("Không thể lưu metadata ảnh.");
      insertedImages.push({ ...data, public_url: publicUrl(supabase, storagePath) });
    }
    return NextResponse.json({ images: insertedImages }, { status: 201 });
  } catch {
    if (uploadedPaths.length) await supabase.storage.from(BUCKET).remove(uploadedPaths);
    return NextResponse.json({ error: "Không thể tải và lưu hình ảnh." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể quản lý hình ảnh." }, { status: 403 });
  const parsed = z.object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    altText: z.string().trim().max(200).optional(),
    displayOrder: z.number().int().min(0).max(1000).optional(),
    isCover: z.boolean().optional(),
    cropX: cropValue.optional(),
    cropY: cropValue.optional(),
    cropZoom: cropZoom.optional(),
    focalX: cropValue.optional(),
    focalY: cropValue.optional(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin hình ảnh chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const [{ data: currentImage, error: imageError }, { data: product, error: productError }] = await Promise.all([
    supabase.from("product_images").select("id, storage_path, is_cover").eq("id", parsed.data.id).eq("product_id", parsed.data.productId).single(),
    supabase.from("products").select("status").eq("id", parsed.data.productId).single(),
  ]);
  if (imageError || !currentImage) return NextResponse.json({ error: "Không tìm thấy hình ảnh." }, { status: 404 });
  if (productError || !product) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
  if (parsed.data.isCover === false && currentImage.is_cover && product.status === "published") return NextResponse.json({ error: "Sản phẩm đang hiển thị phải giữ một ảnh cover." }, { status: 400 });
  if (parsed.data.isCover) {
    const { error } = await supabase.from("product_images").update({ is_cover: false }).eq("product_id", parsed.data.productId);
    if (error) return NextResponse.json({ error: "Không thể đổi ảnh cover." }, { status: 400 });
  }
  const { id, productId, ...values } = parsed.data;
  const update: Record<string, unknown> = {};
  if (values.altText !== undefined) update.alt_text = values.altText;
  if (values.displayOrder !== undefined) update.display_order = values.displayOrder;
  if (values.isCover !== undefined) update.is_cover = values.isCover;
  if (values.cropX !== undefined) update.crop_x = values.cropX;
  if (values.cropY !== undefined) update.crop_y = values.cropY;
  if (values.cropZoom !== undefined) update.crop_zoom = values.cropZoom;
  if (values.focalX !== undefined) update.focal_x = values.focalX;
  if (values.focalY !== undefined) update.focal_y = values.focalY;
  if (!Object.keys(update).length) return NextResponse.json({ error: "Không có thay đổi hình ảnh." }, { status: 400 });
  const { data, error } = await supabase.from("product_images").update(update).eq("id", id).eq("product_id", productId).select("id, product_id, storage_path, alt_text, display_order, is_cover, mime_type, crop_x, crop_y, crop_zoom, focal_x, focal_y").single();
  if (error || !data) return NextResponse.json({ error: "Không thể cập nhật hình ảnh." }, { status: 400 });
  return NextResponse.json({ image: { ...data, public_url: publicUrl(supabase, data.storage_path) } });
}

export async function DELETE(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Chỉ Admin mới có thể xoá hình ảnh." }, { status: 403 });
  const parsed = imageIdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thiếu thông tin hình ảnh." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: image, error: imageError } = await supabase.from("product_images").select("id, storage_path, is_cover").eq("id", parsed.data.id).eq("product_id", parsed.data.productId).single();
  if (imageError || !image) return NextResponse.json({ error: "Không tìm thấy hình ảnh." }, { status: 404 });
  const [{ count }, { data: product }] = await Promise.all([
    supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", parsed.data.productId),
    supabase.from("products").select("status").eq("id", parsed.data.productId).single(),
  ]);
  if ((count || 0) <= 1 && product?.status === "published") return NextResponse.json({ error: "Sản phẩm đang hiển thị phải còn ít nhất một ảnh cover." }, { status: 400 });
  const { error } = await supabase.from("product_images").delete().eq("id", image.id).eq("product_id", parsed.data.productId);
  if (error) return NextResponse.json({ error: "Không thể xoá hình ảnh." }, { status: 400 });
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.storage_path]);
  if (storageError) return NextResponse.json({ ok: true, warning: "Đã xoá metadata nhưng chưa xoá được file Storage." });
  if (image.is_cover) {
    const { data: nextImage } = await supabase.from("product_images").select("id").eq("product_id", parsed.data.productId).order("display_order").order("created_at").limit(1).maybeSingle();
    if (nextImage) await supabase.from("product_images").update({ is_cover: true }).eq("id", nextImage.id);
  }
  return NextResponse.json({ ok: true });
}
