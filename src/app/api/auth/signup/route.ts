import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizedPhoneSchema } from "@/lib/auth";

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: normalizedPhoneSchema,
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Vui lòng kiểm tra lại thông tin đăng ký." }, { status: 400 });
    const { fullName, phone, password } = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ phone, password, options: { data: { full_name: fullName } } });
    if (error || !data.user) return NextResponse.json({ error: "Không thể tạo tài khoản. Vui lòng thử lại sau." }, { status: 400 });
    return NextResponse.json({ ok: true, user: { id: data.user.id, phone: data.user.phone }, needsConfirmation: !data.session });
  } catch {
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
