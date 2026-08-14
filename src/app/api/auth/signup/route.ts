import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizedPhoneSchema, toInternalAuthEmail } from "@/lib/auth";

const signupSchema = z.object({
  phone: normalizedPhoneSchema,
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự.").max(128),
  confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu."),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Mật khẩu xác nhận không khớp.",
});

function signupErrorResponse(error: { code?: string; status?: number; message?: string }) {
  console.error("[auth.signup] Supabase Auth error", {
    code: error.code,
    status: error.status,
    message: error.message,
  });

  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return NextResponse.json({ error: "Số điện thoại này đã được đăng ký." }, { status: 400 });
    case "signup_disabled":
      return NextResponse.json({ error: "Chức năng đăng ký đang tạm khóa." }, { status: 503 });
    case "weak_password":
      return NextResponse.json({ error: "Mật khẩu chưa đạt yêu cầu." }, { status: 400 });
    case "over_request_rate_limit":
      return NextResponse.json({ error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau." }, { status: 429 });
    case "validation_failed":
      return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu chưa hợp lệ." }, { status: 400 });
    case "unexpected_failure":
      return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
    default:
      return NextResponse.json({ error: "Không thể tạo tài khoản. Vui lòng kiểm tra thông tin và thử lại." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json({ error: firstIssue?.message || "Thông tin đăng ký chưa hợp lệ." }, { status: 400 });
    }

    const { phone, password } = parsed.data;
    const email = toInternalAuthEmail(phone);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { phone },
      },
    });

    if (error) return signupErrorResponse(error);
    if (!data.user) return NextResponse.json({ error: "Không thể tạo tài khoản. Vui lòng thử lại." }, { status: 503 });

    return NextResponse.json({ ok: true, user: { id: data.user.id, phone } });
  } catch (error) {
    console.error("[auth.signup] Unexpected server error", error);
    return NextResponse.json({ error: "Dịch vụ tài khoản tạm thời không khả dụng." }, { status: 503 });
  }
}
