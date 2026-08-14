import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().regex(/^(0|\+84)[0-9\s.-]{8,14}$/, "Số điện thoại không hợp lệ"),
  recipientName: z.string().trim().min(2).max(100),
  recipientPhone: z.string().trim().regex(/^(0|\+84)[0-9\s.-]{8,14}$/, "Số điện thoại không hợp lệ"),
  address: z.string().trim().min(8).max(300),
  deliveryDate: z.string().date(),
  deliveryTime: z.string().trim().min(3).max(80),
  cardMessage: z.string().trim().max(500).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

const orderSchema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(50),
  checkout: checkoutSchema,
});

const makeOrderCode = () => `CSH-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Checkout chưa được kết nối Supabase. Hãy cấu hình NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY ở server trước khi nhận đơn thật." }, { status: 503 });
  }

  const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 12) return NextResponse.json({ error: "Thiếu mã chống tạo trùng đơn hàng. Vui lòng thử lại." }, { status: 400 });

  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin đặt hoa chưa hợp lệ.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
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
  const shippingVnd = subtotal >= 1000000 ? 0 : 30000;
  const totalVnd = subtotal + shippingVnd;
  const orderCode = makeOrderCode();
  const summary = [
    `CÁ'S HOA — ĐƠN ${orderCode}`,
    `Sản phẩm:`,
    ...lines.map((line) => `- ${line.product.name} (${line.product.sku}) × ${line.quantity}: ${new Intl.NumberFormat("vi-VN").format(line.lineTotal)}đ`),
    `Tạm tính: ${new Intl.NumberFormat("vi-VN").format(subtotal)}đ`,
    `Giao hàng: ${shippingVnd ? new Intl.NumberFormat("vi-VN").format(shippingVnd) + "đ" : "Miễn phí"}`,
    `Tổng cộng: ${new Intl.NumberFormat("vi-VN").format(totalVnd)}đ`,
    `Người đặt: ${parsed.data.checkout.customerName} — ${parsed.data.checkout.customerPhone}`,
    `Người nhận: ${parsed.data.checkout.recipientName} — ${parsed.data.checkout.recipientPhone}`,
    `Địa chỉ: ${parsed.data.checkout.address}`,
    `Giao ngày: ${parsed.data.checkout.deliveryDate}, ${parsed.data.checkout.deliveryTime}`,
    parsed.data.checkout.cardMessage ? `Thiệp: ${parsed.data.checkout.cardMessage}` : "",
    parsed.data.checkout.note ? `Ghi chú: ${parsed.data.checkout.note}` : "",
  ].filter(Boolean).join("\n");

  const { data: order, error: orderError } = await supabase.from("orders").insert({
    order_code: orderCode,
    idempotency_key: idempotencyKey,
    customer_name: parsed.data.checkout.customerName,
    customer_phone: parsed.data.checkout.customerPhone,
    recipient_name: parsed.data.checkout.recipientName,
    recipient_phone: parsed.data.checkout.recipientPhone,
    delivery_address: parsed.data.checkout.address,
    delivery_date: parsed.data.checkout.deliveryDate,
    delivery_time: parsed.data.checkout.deliveryTime,
    card_message: parsed.data.checkout.cardMessage,
    note: parsed.data.checkout.note,
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

  await supabase.from("order_status_history").insert({ order_id: order.id, to_status: "pending_confirmation", note: "Đơn tạo từ storefront" });
  return NextResponse.json({ orderCode, summary });
}
