"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Mật khẩu phải có ít nhất 8 ký tự."); return; }
    if (password !== confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, confirmPassword }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Phiên khôi phục không hợp lệ hoặc đã hết hạn."); return; }
      router.replace(result.redirectTo || "/dang-nhap?reset=success");
    } catch {
      setError("Không thể kết nối tới dịch vụ đổi mật khẩu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Bảo mật tài khoản" title="Đặt mật khẩu mới." description="Chọn một mật khẩu mới có ít nhất 8 ký tự. Sau khi đổi, các phiên đăng nhập cũ sẽ được kết thúc.">
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold" htmlFor="reset-password">Mật khẩu mới
          <div className="relative mt-2"><input id="reset-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type={showPassword ? "text" : "password"} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted" aria-label={showPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>
        </label>
        <label className="block text-sm font-semibold" htmlFor="reset-confirm-password">Xác nhận mật khẩu mới
          <div className="relative mt-2"><input id="reset-confirm-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type={showConfirmation ? "text" : "password"} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowConfirmation((value) => !value)} className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted" aria-label={showConfirmation ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}>{showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>
        </label>
        {error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}{loading ? "Đang cập nhật..." : "Đặt mật khẩu mới"}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">Phiên khôi phục hết hạn? <Link href="/quen-mat-khau" className="font-bold text-primary hover:underline">Gửi lại mã</Link></p>
    </AuthShell>
  );
}
