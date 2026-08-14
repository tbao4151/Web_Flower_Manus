import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, normalizedPhoneSchema } from "@/lib/auth";
import { normalizeDeliveryTime } from "@/lib/delivery";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const checkoutSchema = z.object({
  recipientName: z.string().trim().min(2).max(100),
  recipientPhone: normalizedPhoneSchema,
  isPickup: z.boolean().default(false),
  address: z.string().trim().max(300).optional().default(""),
  deliveryDate: z.string().date(),
  deliveryTime: z.string().trim().min(1).max(80).transform((value, context) => {
    const normalized = normalizeDeliveryTime(value);
    if (!normalized) {
      context.addIssue({ code: "custom", message: "Khung giờ chưa đúng định dạng." });
      return z.NEVER;
    }
    return normalized;
  }),
  cardMessage: z.string().trim().max(500).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
}).superRefine((value, context) => {
  if (!value.isPickup && value.address.length < 8) {
    context.addIssue({ code: "custom", path: ["address"], message: "Vui lòng nhập địa chỉ giao hoa." });
  }
});

const orderSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(50),
  checkout: checkoutSchema,
});

const makeOrderCode = () => `CSH-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const formatVnd = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 12) return NextResponse.json({ error: "Thiếu mã chống tạo trùng đơn hàng. Vui lòng thử lại." }, { status: 400 });
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const hasTimeError = parsed.error.issues.some((issue) => issue.path.join(".") === "checkout.deliveryTime");
    const error = hasTimeError ? "Khung giờ chưa đúng. Ví dụ hợp lệ: 14g, 14h, 13g-14h30 hoặc 13:00." : "Thông tin nhận hoa chưa hợp lệ.";
    return NextResponse.json({ error, fields }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const user = await getCurrentUser();
    const { data: existing } = await supabase.from("orders").select("order_code, handoff_summary").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return NextResponse.json({ orderCode: existing.order_code, summary: existing.handoff_summary, duplicate: true });

    const requestedItems = Array.from(parsed.data.items.reduce((map, item) => map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity), new Map<string, number>()).entries()).map(([productId, quantity]) => ({ productId, quantity }));
    if (requestedItems.some((item) => item.quantity > 20)) return NextResponse.json({ error: "Số lượng mỗi sản phẩm không được vượt quá 20." }, { status: 400 });
    const ids = requestedItems.map((item) => item.productId);
    const { data: catalog, error: catalogError } = await supabase.from("products").select("id, sku, name, price_vnd, sale_price_vnd, status, product_type").in("id", ids);
    if (catalogError) return NextResponse.json({ error: "Không thể kiểm tra sản phẩm hiện tại. Vui lòng thử lại sau." }, { status: 500 });
    if (!catalog || catalog.length !== ids.length) return NextResponse.json({ error: "Một sản phẩm trong giỏ không còn khả dụng." }, { status: 409 });

    const catalogById = new Map(catalog.map((item) => [item.id, item]));
    const lines = requestedItems.map((item) => {
      const product = catalogById.get(item.productId);
      if (!product || product.status !== "published") throw new Error("PRODUCT_UNAVAILABLE");
      const unitPrice = product.sale_price_vnd ?? product.price_vnd;
      return { ...item, product, unitPrice, lineTotal: unitPrice * item.quantity };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const shippingVnd = 0;
    const totalVnd = subtotal;
    const orderCode = makeOrderCode();
    const { recipientName, recipientPhone, isPickup, address, deliveryDate, deliveryTime, cardMessage, note } = parsed.data.checkout;
    const summary = [
      `CÁ'S HOA — ĐƠN ${orderCode}`,
      "Sản phẩm:",
      ...lines.map((line) => `- ${line.product.name} (${line.product.sku}) × ${line.quantity}: ${formatVnd(line.lineTotal)}đ`),
      `Tạm tính: ${formatVnd(subtotal)}đ`,
      "Giao hàng: Shop xác nhận sau",
      `Tổng tạm tính: ${formatVnd(totalVnd)}đ`,
      `Người nhận: ${recipientName} — ${recipientPhone}`,
      isPickup ? "Nhận hoa: Tự tới lấy tại shop" : `Địa chỉ: ${address}`,
      `Thời gian: ${deliveryDate}, ${deliveryTime}`,
      cardMessage ? `Thiệp: ${cardMessage}` : "",
      note ? `Ghi chú: ${note}` : "",
    ].filter(Boolean).join("\n");

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      order_code: orderCode,
      user_id: user?.id ?? null,
      idempotency_key: idempotencyKey,
      customer_name: null,
      customer_phone: null,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      is_pickup: isPickup,
      delivery_address: isPickup ? null : address,
      delivery_date: deliveryDate,
      delivery_time: deliveryTime,
      card_message: cardMessage,
      note,
      subtotal_vnd: subtotal,
      shipping_vnd: shippingVnd,
      total_vnd: totalVnd,
      status: "pending_confirmation",
      handoff_summary: summary,
    }).select("id").single();
    if (orderError || !order) return NextResponse.json({ error: "Không thể lưu đơn hàng. Vui lòng thử lại." }, { status: 500 });

    const { error: itemsError } = await supabase.from("order_items").insert(lines.map((line) => ({ order_id: order.id, product_id: line.product.id, product_sku_snapshot: line.product.sku, product_name_snapshot: line.product.name, unit_price_vnd: line.unitPrice, quantity: line.quantity, line_total_vnd: line.lineTotal })));
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Không thể hoàn tất các dòng sản phẩm của đơn. Đơn chưa được ghi nhận." }, { status: 500 });
    }
    await supabase.from("order_status_history").insert({ order_id: order.id, to_status: "pending_confirmation", note: "Đơn tạo từ storefront V2.1" });
    return NextResponse.json({ orderCode, summary });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_UNAVAILABLE") return NextResponse.json({ error: "Một sản phẩm trong giỏ không còn khả dụng." }, { status: 409 });
    return NextResponse.json({ error: "Checkout tạm thời chưa khả dụng. Vui lòng thử lại sau." }, { status: 503 });
  }
}

const lookupSchema = z.object({ orderCode: z.string().trim().toUpperCase().regex(/^CSH-\d{4}-[A-Z0-9]{8}$/), recipientPhone: normalizedPhoneSchema });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = lookupSchema.safeParse({ orderCode: searchParams.get("orderCode"), recipientPhone: searchParams.get("recipientPhone") });
  if (!parsed.success) return NextResponse.json({ error: "Không tìm thấy đơn hàng phù hợp." }, { status: 404 });
  try {
    const supabase = createSupabaseAdminClient();
    const phoneHash = createHash("sha256").update(parsed.data.recipientPhone).digest("hex");
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase.from("order_lookup_audit").select("id", { count: "exact", head: true }).eq("order_code", parsed.data.orderCode).eq("phone_hash", phoneHash).gte("created_at", since);
    if ((count ?? 0) >= 10) return NextResponse.json({ error: "Bạn đã thử quá nhiều lần. Vui lòng chờ ít phút rồi thử lại." }, { status: 429 });
    const { data: order } = await supabase.from("orders").select("order_code, recipient_name, recipient_phone, is_pickup, delivery_address, delivery_date, delivery_time, subtotal_vnd, shipping_vnd, total_vnd, status, created_at, order_items(product_name_snapshot, product_sku_snapshot, unit_price_vnd, quantity, line_total_vnd)").eq("order_code", parsed.data.orderCode).eq("recipient_phone", parsed.data.recipientPhone).maybeSingle();
    await supabase.from("order_lookup_audit").insert({ order_code: parsed.data.orderCode, phone_hash: phoneHash, succeeded: Boolean(order) });
    if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng phù hợp." }, { status: 404 });
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Không thể tra cứu đơn hàng lúc này." }, { status: 503 });
  }
}
