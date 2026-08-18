import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const statuses = ["pending_confirmation", "confirmed", "preparing", "ready", "delivering", "completed", "cancelled"] as const;
const sources = ["instagram", "zalo", "phone", "in_store", "other"] as const;
const phoneSchema = z.string().trim().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số.");

const manualOrderSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  source: z.enum(sources),
  customerName: z.string().trim().max(100).optional().default(""),
  customerPhone: z.preprocess((value) => value === "" ? undefined : value, phoneSchema.optional()),
  recipientName: z.string().trim().min(2).max(100),
  recipientPhone: phoneSchema,
  deliveryAddress: z.string().trim().min(8).max(300),
  deliveryDate: z.string().date(),
  deliveryTime: z.string().trim().min(1).max(80),
  cardMessage: z.string().trim().max(500).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  internalNote: z.string().trim().max(1000).optional().default(""),
  shippingVnd: z.number().int().min(0).max(1_000_000_000).default(0),
  initialStatus: z.enum(statuses).default("pending_confirmation"),
  items: z.array(z.union([
    z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(100), unitPriceVnd: z.number().int().min(0).max(1_000_000_000).optional() }),
    z.object({ name: z.string().trim().min(1).max(160), sku: z.string().trim().max(50).optional().default("CUSTOM"), unitPriceVnd: z.number().int().min(0).max(1_000_000_000), quantity: z.number().int().min(1).max(100), customNote: z.string().trim().max(500).optional().default("") }),
  ])).min(1).max(50),
});

export async function POST(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền thao tác đơn thủ công." }, { status: 403 });
  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 12 || idempotencyKey.length > 128) return NextResponse.json({ error: "Thiếu mã chống tạo trùng đơn hàng." }, { status: 400 });
  const parsed = manualOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Thông tin đơn thủ công chưa hợp lệ.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    const existing = await supabase.from("orders").select("order_code, handoff_summary").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.data) return NextResponse.json({ orderCode: existing.data.order_code, summary: existing.data.handoff_summary, duplicate: true });
    if (existing.error && existing.error.code !== "PGRST116") return NextResponse.json({ error: "Không thể kiểm tra đơn trùng." }, { status: 503 });

    const catalogIds = parsed.data.items.flatMap((item) => "productId" in item ? [item.productId] : []);
    const catalog = catalogIds.length ? await supabase.from("products").select("id, sku, name, price_vnd, sale_price_vnd, status").in("id", Array.from(new Set(catalogIds))) : { data: [], error: null };
    if (catalog.error) return NextResponse.json({ error: "Không thể kiểm tra sản phẩm." }, { status: 503 });
    const catalogById = new Map((catalog.data || []).map((product) => [product.id, product]));
    const items = parsed.data.items.map((item) => {
      if (!("productId" in item)) return { name: item.name, sku: item.sku || "CUSTOM", unitPriceVnd: item.unitPriceVnd, quantity: item.quantity, isCustom: true, customNote: item.customNote || "" };
      const product = catalogById.get(item.productId);
      if (!product || product.status !== "published") throw new Error("PRODUCT_UNAVAILABLE");
      return { productId: product.id, name: product.name, sku: product.sku, unitPriceVnd: item.unitPriceVnd ?? product.sale_price_vnd ?? product.price_vnd, quantity: item.quantity, isCustom: false, customNote: "" };
    });
    const customerPhone = parsed.data.customerPhone || parsed.data.recipientPhone;
    const customerName = parsed.data.customerName || parsed.data.recipientName;

    const { data, error } = await supabase.rpc("create_manual_order", {
      target_created_by: current.user.id,
      target_customer_id: parsed.data.customerId || null,
      target_source: parsed.data.source,
      target_customer_name: customerName,
      target_customer_phone: customerPhone,
      target_recipient_name: parsed.data.recipientName,
      target_recipient_phone: parsed.data.recipientPhone,
      target_delivery_address: parsed.data.deliveryAddress,
      target_delivery_date: parsed.data.deliveryDate,
      target_delivery_time: parsed.data.deliveryTime,
      target_card_message: parsed.data.cardMessage,
      target_note: parsed.data.note,
      target_internal_note: parsed.data.internalNote,
      target_shipping_vnd: parsed.data.shippingVnd,
      target_initial_status: parsed.data.initialStatus,
      target_idempotency_key: idempotencyKey,
      target_items: items,
    });
    if (error) {
      if (error.message.includes("manual_order_duplicate")) {
        const duplicate = await supabase.from("orders").select("order_code, handoff_summary").eq("idempotency_key", idempotencyKey).maybeSingle();
        if (duplicate.data) return NextResponse.json({ orderCode: duplicate.data.order_code, summary: duplicate.data.handoff_summary, duplicate: true });
      }
      if (error.message.includes("insufficient_stock")) return NextResponse.json({ error: "Không đủ nguyên liệu cho trạng thái ban đầu đã chọn." }, { status: 409 });
      if (error.message.includes("customer_not_found")) return NextResponse.json({ error: "Không tìm thấy khách hàng được liên kết." }, { status: 404 });
      if (error.message.includes("invalid_initial_status")) return NextResponse.json({ error: "Trạng thái ban đầu không hợp lệ." }, { status: 400 });
      return NextResponse.json({ error: "Không thể tạo đơn thủ công atomically. Vui lòng kiểm tra dữ liệu và thử lại." }, { status: 409 });
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.order_code) return NextResponse.json({ error: "Đơn đã tạo nhưng không nhận được mã đơn. Vui lòng kiểm tra danh sách đơn." }, { status: 503 });
    return NextResponse.json({ orderCode: row.order_code, orderId: row.order_id, duplicate: false });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_UNAVAILABLE") return NextResponse.json({ error: "Một sản phẩm đã chọn không còn được hiển thị hoặc không tồn tại." }, { status: 409 });
    return NextResponse.json({ error: "Dịch vụ tạo đơn thủ công tạm thời không khả dụng." }, { status: 503 });
  }
}
