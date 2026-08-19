"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, GoogleAuthButton } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [next] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") || "/tai-khoan" : "/tai-khoan");
  const [reauth] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reauth") === "1");
  const [queryMessage] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("reset") === "success" : false);
  const [oauthError] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("oauth") : null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [managementRequired, setManagementRequired] = useState(reauth);

  useEffect(() => {
    let active = true;
    fetch(`/api/auth/me?next=${encodeURIComponent(next)}`, { cache: "no-store" })
      .then((response) => response.json().catch(() => ({})))
      .then((result) => {
        if (!active) return;
        if (result.user && result.profile?.is_active !== false) {
          if (result.isProfileComplete === false) { router.replace(`/hoan-tat-ho-so?next=${encodeURIComponent(next)}`); return; }
          if (result.managementRequired) { setManagementRequired(true); setCheckingSession(false); return; }
          router.replace(result.redirectTo || "/tai-khoan");
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, [next, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!identifier.trim() || password.length < 1) { setError("Vui lòng nhập Gmail hoặc số điện thoại và mật khẩu."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier, password, next, reauth: managementRequired }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Email/Số điện thoại hoặc mật khẩu không chính xác."); return; }
      router.replace(result.redirectTo || "/tai-khoan");
      router.refresh();
    } catch {
      setError("Không thể kết nối tới dịch vụ đăng nhập. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) return <main className="flex min-h-screen items-center justify-center bg-background"><LoaderCircle className="animate-spin text-primary" aria-label="Đang kiểm tra phiên đăng nhập" /></main>;

  return (
    <AuthShell eyebrow={managementRequired ? "Phiên quản trị" : "Tài khoản khách hàng"} title={managementRequired ? "Xác thực lại để tiếp tục." : "Chào mừng bạn trở lại."} description={managementRequired ? "Vui lòng đăng nhập lại để tiếp tục quản trị. Phiên khách hàng của bạn vẫn được giữ nguyên." : "Đăng nhập bằng Gmail hoặc số điện thoại cùng mật khẩu của bạn."}>
      {queryMessage && <p role="status" className="mt-6 rounded-xl bg-[#e4f0e2] px-4 py-3 text-sm leading-6 text-success">Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.</p>}
      {oauthError === "gmail-only" && <p role="alert" className="mt-6 rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">CÁ&apos;S HOA chỉ chấp nhận tài khoản Google dùng Gmail @gmail.com.</p>}
      {oauthError === "error" && <p role="alert" className="mt-6 rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">Không thể đăng nhập bằng Google lúc này. Vui lòng thử lại.</p>}
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold" htmlFor="login-identifier">Email hoặc số điện thoại
          <input id="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type="text" inputMode="email" placeholder="example@gmail.com hoặc 0889126325" autoComplete="username" required />
        </label>
        <label className="block text-sm font-semibold" htmlFor="login-password">Mật khẩu
          <div className="relative mt-2"><input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type={showPassword ? "text" : "password"} placeholder="Mật khẩu của bạn" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>
        </label>
        <div className="flex justify-end"><Link href="/quen-mat-khau" className="text-sm font-bold text-primary hover:underline">Quên mật khẩu?</Link></div>
        {error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <LockKeyhole size={17} aria-hidden="true" />}{loading ? "Đang xác thực..." : managementRequired ? "Đăng nhập lại để quản trị" : "Đăng nhập"}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />hoặc<span className="h-px flex-1 bg-border" /></div>
      <GoogleAuthButton next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">Chưa có tài khoản? <Link href="/dang-ky" className="font-bold text-primary hover:underline">Đăng ký ngay</Link></p>
      <Link href="/" className="mt-5 block text-center text-sm font-semibold text-muted-foreground hover:text-primary">Tiếp tục mua hoa như khách</Link>
    </AuthShell>
  );
}
