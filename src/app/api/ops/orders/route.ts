import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const statuses = ["pending_confirmation", "confirmed", "preparing", "ready", "delivering", "completed", "cancelled"] as const;
const paymentMethods = ["bank_transfer", "cash", "other"] as const;
const deliveryStatuses = ["pending", "assigned", "out_for_delivery", "delivered", "pickup_ready", "picked_up", "failed"] as const;
const updateSchema = z.object({
  action: z.enum(["status", "payment", "shipping", "delivery"]).default("status"),
  orderId: z.string().uuid(),
  status: z.enum(statuses).optional(),
  note: z.string().trim().max(500).optional().default(""),
  amountVnd: z.number().int().positive().max(1_000_000_000).optional(),
  depositRequiredVnd: z.number().int().min(0).max(1_000_000_000).optional(),
  paymentMethod: z.enum(paymentMethods).optional(),
  deliveryStatus: z.enum(deliveryStatuses).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  shippingVnd: z.number().int().min(0).max(1_000_000_000).optional(),
  shippingFeeConfirmed: z.boolean().optional(),
  carrierName: z.string().trim().max(120).optional(),
  shipperName: z.string().trim().max(120).optional(),
  estimatedDeliveryAt: z.string().datetime({ offset: true }).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.action === "status" && !value.status) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Thiếu trạng thái mới." });
  if (value.action === "payment" && !value.amountVnd && value.depositRequiredVnd === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountVnd"], message: "Nhập số tiền cọc hoặc mức cọc yêu cầu." });
  if (value.action === "delivery" && !value.deliveryStatus) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryStatus"], message: "Thiếu trạng thái giao hàng." });
});

const transitions: Record<string, string[]> = {
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivering"],
  delivering: ["completed"],
  completed: [],
  cancelled: [],
};

const orderSelect = "id, order_code, customer_name, customer_phone, recipient_name, recipient_phone, is_pickup, delivery_method, delivery_address, delivery_date, delivery_time, card_message, note, internal_note, subtotal_vnd, shipping_vnd, shipping_fee_confirmed, total_vnd, deposit_required_vnd, deposit_paid_vnd, remaining_amount_vnd, payment_status, delivery_status, carrier_name, shipper_name, estimated_delivery_at, status, created_at, updated_at, order_items(product_name_snapshot, quantity, unit_price_vnd, line_total_vnd)";

const statusAliases: Record<string, string> = {
  pending: "pending_confirmation",
  pending_confirmation: "pending_confirmation",
  confirmed: "confirmed",
  preparing: "preparing",
  ready: "ready",
  delivering: "delivering",
  completed: "completed",
  cancelled: "cancelled",
};

function vietnamDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền truy cập." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || "20")));
  const search = (searchParams.get("search")?.trim() || "").replace(/[(),]/g, " ");
  const requestedStatus = (searchParams.get("status") || "all").toLowerCase();
  const status = statusAliases[requestedStatus] || requestedStatus;
  const deliveryDate = searchParams.get("deliveryDate") || "";
  const date = searchParams.get("date") || "";
  const range = searchParams.get("range") || "";
  const paymentStatus = (searchParams.get("payment_status") || searchParams.get("paymentStatus") || "").toLowerCase();
  const receiveWindow = searchParams.get("receive_window") || searchParams.get("receiveWindow") || "";
  const deliveryStatus = (searchParams.get("delivery_status") || searchParams.get("deliveryStatus") || "").toLowerCase();
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("orders").select(orderSelect, { count: "exact" }).order("created_at", { ascending: false });
    if (status !== "all" && statuses.includes(status as typeof statuses[number])) query = query.eq("status", status);
    if (deliveryDate) query = query.eq("delivery_date", deliveryDate);
    if (paymentStatus && ["unpaid", "partially_paid", "paid"].includes(paymentStatus)) query = query.eq("payment_status", paymentStatus);
    if (deliveryStatus === "not_delivered") query = query.in("delivery_status", ["pending", "assigned", "pickup_ready"]);
    else if (deliveryStatus && deliveryStatuses.includes(deliveryStatus as typeof deliveryStatuses[number])) query = query.eq("delivery_status", deliveryStatus);
    if (range === "24h") query = query.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (date === "today") {
      const today = vietnamDateKey(new Date());
      const tomorrow = addDays(today, 1);
      query = query.gte("created_at", `${today}T00:00:00+07:00`).lt("created_at", `${tomorrow}T00:00:00+07:00`);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const nextDate = addDays(date, 1);
      query = query.gte("created_at", `${date}T00:00:00+07:00`).lt("created_at", `${nextDate}T00:00:00+07:00`);
    }
    if (receiveWindow === "24-48h") {
      const today = vietnamDateKey(new Date());
      query = query.gte("delivery_date", addDays(today, 1)).lte("delivery_date", addDays(today, 2));
    }
    if (search) query = query.or(`order_code.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%,recipient_phone.ilike.%${search}%,recipient_name.ilike.%${search}%`);
    const from = (page - 1) * pageSize;
    const { data, count, error } = await query.range(from, from + pageSize - 1);
    if (error) return NextResponse.json({ error: "Không thể tải danh sách đơn." }, { status: 500 });
    return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, pageSize });
  } catch {
    return NextResponse.json({ error: "Dịch vụ vận hành tạm thời không khả dụng." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const current = await requireStaff();
  if (!current) return NextResponse.json({ error: "Bạn không có quyền thao tác." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ." }, { status: 400 });

  if (["payment", "shipping"].includes(parsed.data.action) && current.profile.role !== "admin") {
    return NextResponse.json({ error: "Chỉ Admin được quản lý cọc và phí giao hàng." }, { status: 403 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase.from("orders").select("id, status, total_vnd, is_pickup, deposit_paid_vnd, deposit_required_vnd, delivery_status").eq("id", parsed.data.orderId).single();
    if (existingError || !existing) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });

    if (parsed.data.action === "payment") {
      if (parsed.data.depositRequiredVnd !== undefined) {
        if (parsed.data.depositRequiredVnd > existing.total_vnd) return NextResponse.json({ error: "Mức cọc yêu cầu không được vượt quá tổng đơn." }, { status: 409 });
        const { error: requirementError } = await supabase.from("orders").update({ deposit_required_vnd: parsed.data.depositRequiredVnd, updated_at: new Date().toISOString() }).eq("id", parsed.data.orderId);
        if (requirementError) return NextResponse.json({ error: "Không thể lưu mức cọc yêu cầu." }, { status: 409 });
      }
      if (!parsed.data.amountVnd) return NextResponse.json({ ok: true });
      const { data, error } = await supabase.rpc("record_order_payment", {
        target_order_id: parsed.data.orderId,
        target_amount_vnd: parsed.data.amountVnd,
        target_payment_method: parsed.data.paymentMethod || "other",
        target_paid_at: parsed.data.paidAt || new Date().toISOString(),
        target_note: parsed.data.note,
      });
      if (error) {
        if (error.message.includes("payment_exceeds_total")) return NextResponse.json({ error: "Số tiền nhận không được vượt quá tổng đơn." }, { status: 409 });
        return NextResponse.json({ error: "Không thể ghi nhận tiền cọc." }, { status: 409 });
      }
      return NextResponse.json({ ok: true, order: data });
    }

    if (parsed.data.action === "delivery") {
      const currentDelivery = existing.delivery_status || "pending";
      const allowed: Record<string, string[]> = existing.is_pickup
        ? { pending: ["pickup_ready"], pickup_ready: ["picked_up", "failed"], failed: ["pickup_ready"] }
        : { pending: ["assigned", "failed"], assigned: ["out_for_delivery", "failed"], out_for_delivery: ["delivered", "failed"], failed: ["assigned"] };
      if (!allowed[currentDelivery]?.includes(parsed.data.deliveryStatus!)) return NextResponse.json({ error: "Không thể chuyển trạng thái giao hàng theo quy trình." }, { status: 409 });
      const { error } = await supabase.from("orders").update({ delivery_status: parsed.data.deliveryStatus, carrier_name: parsed.data.carrierName || null, shipper_name: parsed.data.shipperName || null, estimated_delivery_at: parsed.data.estimatedDeliveryAt ?? null, updated_at: new Date().toISOString(), internal_note: parsed.data.note || undefined }).eq("id", parsed.data.orderId);
      if (error) return NextResponse.json({ error: "Không thể cập nhật trạng thái giao hàng." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "shipping") {
      const { data, error } = await supabase.rpc("update_order_shipping", {
        target_order_id: parsed.data.orderId,
        target_shipping_vnd: parsed.data.shippingVnd ?? (existing.is_pickup ? 0 : 0),
        target_fee_confirmed: parsed.data.shippingFeeConfirmed ?? false,
        target_carrier_name: parsed.data.carrierName || null,
        target_shipper_name: parsed.data.shipperName || null,
        target_estimated_delivery_at: parsed.data.estimatedDeliveryAt || null,
        target_note: parsed.data.note,
      });
      if (error) return NextResponse.json({ error: "Không thể cập nhật thông tin giao hàng." }, { status: 409 });
      return NextResponse.json({ ok: true, order: data });
    }

    const nextStatus = parsed.data.status!;
    if (!transitions[existing.status]?.includes(nextStatus)) return NextResponse.json({ error: "Không thể chuyển trạng thái theo quy trình." }, { status: 409 });

    const { error: statusError } = await supabase.from("orders").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", parsed.data.orderId);
    if (statusError) return NextResponse.json({ error: "Không thể cập nhật đơn." }, { status: 500 });

    if (nextStatus === "confirmed") {
      const { error: reserveError } = await supabase.rpc("reserve_stock_for_order", { target_order_id: parsed.data.orderId });
      if (reserveError) {
        await supabase.from("orders").update({ status: existing.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.orderId);
        if (reserveError.message.includes("insufficient_stock")) return NextResponse.json({ error: "Không đủ nguyên liệu để xác nhận đơn. Vui lòng điều chỉnh tồn kho hoặc liên hệ khách." }, { status: 409 });
        return NextResponse.json({ error: "Không thể giữ nguyên liệu cho đơn." }, { status: 409 });
      }
    }

    if (nextStatus === "ready") {
      const { error: consumeError } = await supabase.rpc("consume_stock_for_order", { target_order_id: parsed.data.orderId });
      if (consumeError) {
        await supabase.from("orders").update({ status: existing.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.orderId);
        return NextResponse.json({ error: "Không thể ghi nhận sử dụng nguyên liệu; trạng thái đơn chưa được đổi." }, { status: 409 });
      }
    }

    if (nextStatus === "cancelled") {
      const { error: releaseError } = await supabase.rpc("release_stock_for_order", { target_order_id: parsed.data.orderId });
      if (releaseError) {
        await supabase.from("orders").update({ status: existing.status, updated_at: new Date().toISOString() }).eq("id", parsed.data.orderId);
        return NextResponse.json({ error: "Không thể hoàn trả nguyên liệu cho đơn." }, { status: 409 });
      }
    }

    const { error: historyError } = await supabase.from("order_status_history").insert({ order_id: parsed.data.orderId, from_status: existing.status, to_status: nextStatus, actor_id: current.user.id, note: parsed.data.note });
    if (historyError) return NextResponse.json({ error: "Đơn đã đổi trạng thái nhưng chưa ghi được lịch sử. Vui lòng kiểm tra lại." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dịch vụ vận hành tạm thời không khả dụng." }, { status: 503 });
  }
}
