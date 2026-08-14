import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizedPhoneSchema } from "@/lib/auth";

const signupSchema = z.object({
  phone: normalizedPhoneSchema,
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự.").max(128),
  confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu."),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Mật khẩu xác nhận không khớp.",
});

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json({ error: firstIssue?.message || "Thông tin đăng ký chưa hợp lệ." }, { status: 400 });
    }
    const { phone, password } = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({ phone, password });
    if (error || !data.user) return NextResponse.json({ error: "Không thể tạo tài khoản. Số điện thoại có thể đã được sử dụng." }, { status: 400 });
    return NextResponse.json({ ok: true, user: { id: data.user.id, phone: data.user.phone } });
  } catch {
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
