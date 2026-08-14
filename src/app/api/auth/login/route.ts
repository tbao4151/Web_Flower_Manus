import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizedPhoneSchema, toVietnamE164Phone } from "@/lib/auth";

const loginSchema = z.object({ phone: normalizedPhoneSchema, password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu không đúng." }, { status: 401 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ phone: toVietnamE164Phone(parsed.data.phone), password: parsed.data.password });
    if (error || !data.user) return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu không đúng." }, { status: 401 });
    return NextResponse.json({ ok: true, user: { id: data.user.id, phone: data.user.phone } });
  } catch {
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
