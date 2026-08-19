"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, GoogleAuthButton } from "@/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^0\d{9}$/.test(phone)) { setError("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0."); return; }
    if (!/^[^@\s]+@gmail\.com$/i.test(email.trim())) { setError("Vui lòng sử dụng địa chỉ Gmail @gmail.com."); return; }
    if (password.length < 8) { setError("Mật khẩu phải có ít nhất 8 ký tự."); return; }
    if (password !== confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, email, password, confirmPassword }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Không thể tạo tài khoản."); return; }
      router.replace(`/xac-nhan-email?email=${encodeURIComponent(result.email || email.trim().toLowerCase())}`);
    } catch {
      setError("Không thể kết nối tới dịch vụ tài khoản. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Tạo tài khoản khách hàng" title="Lưu lại những đơn hoa." description="Dùng Gmail để xác nhận tài khoản, và số điện thoại để CÁ&apos;S HOA liên hệ khi cần thiết.">
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold" htmlFor="signup-phone">Số điện thoại <span className="text-danger">*</span>
          <input id="signup-phone" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" inputMode="tel" pattern="0[0-9]{9}" placeholder="0889126325" autoComplete="tel" maxLength={10} required />
        </label>
        <p className="-mt-2 text-xs leading-5 text-muted-foreground">Vui lòng nhập chính xác số điện thoại để CÁ&apos;S HOA có thể liên hệ khi cần thiết.</p>
        <label className="block text-sm font-semibold" htmlFor="signup-email">Gmail <span className="text-danger">*</span>
          <input id="signup-email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type="email" inputMode="email" placeholder="example@gmail.com" autoComplete="email" required />
        </label>
        <label className="block text-sm font-semibold" htmlFor="signup-password">Mật khẩu <span className="text-danger">*</span>
          <div className="relative mt-2"><input id="signup-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type={showPassword ? "text" : "password"} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>
        </label>
        <label className="block text-sm font-semibold" htmlFor="signup-confirm-password">Xác nhận mật khẩu <span className="text-danger">*</span>
          <div className="relative mt-2"><input id="signup-confirm-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type={showConfirmation ? "text" : "password"} placeholder="Nhập lại mật khẩu" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowConfirmation((value) => !value)} className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted" aria-label={showConfirmation ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}>{showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>
        </label>
        {error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <UserRound size={17} aria-hidden="true" />} {loading ? "Đang gửi mã xác nhận..." : "Tạo tài khoản"}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />hoặc<span className="h-px flex-1 bg-border" /></div>
      <GoogleAuthButton />
      <p className="mt-6 text-center text-sm text-muted-foreground">Đã có tài khoản? <Link href="/dang-nhap" className="font-bold text-primary hover:underline">Đăng nhập</Link></p>
    </AuthShell>
  );
}
