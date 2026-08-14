"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Leaf, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") || "/tai-khoan" : "/tai-khoan";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/auth/me?next=${encodeURIComponent(next)}`, { cache: "no-store" })
      .then((response) => response.json().catch(() => ({})))
      .then((result) => {
        if (!active) return;
        if (result.user && result.profile?.is_active !== false) {
          router.replace(result.redirectTo || "/tai-khoan");
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, [next, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^0\d{9}$/.test(phone)) { setError("Số điện thoại phải gồm đúng 10 chữ số."); return; }
    setLoading(true);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, password, next }) });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(result.error || "Số điện thoại hoặc mật khẩu không đúng."); return; }
    router.replace(result.redirectTo || "/tai-khoan");
    router.refresh();
  }

  if (checkingSession) return <main className="flex min-h-screen items-center justify-center bg-background"><LoaderCircle className="animate-spin text-primary" aria-label="Đang kiểm tra phiên đăng nhập" /></main>;

  return <main className="min-h-screen bg-background px-5 py-8 sm:px-8"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center"><Link href="/" className="mx-auto flex items-center gap-2 text-primary"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"><Leaf size={19} /></span><span className="font-display text-2xl text-foreground">CÁ&apos;S HOA</span></Link><section className="mt-8 rounded-[28px] border border-border bg-surface p-6 shadow-sm sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Tài khoản khách hàng</p><h1 className="mt-2 font-display text-4xl">Chào mừng bạn trở lại.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Đăng nhập bằng số điện thoại và mật khẩu để xem đơn hàng của bạn.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold">Số điện thoại<input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary" inputMode="numeric" pattern="0[0-9]{9}" placeholder="0356925367" autoComplete="tel" maxLength={10} required /></label><label className="block text-sm font-semibold">Mật khẩu<div className="relative mt-2"><input value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none focus:border-primary" type={showPassword ? "text" : "password"} placeholder="Mật khẩu của bạn" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm text-danger">{error}</p>}<button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} /> : <LockKeyhole size={17} />} {loading ? "Đang đăng nhập..." : "Đăng nhập"}<ArrowRight size={17} /></button></form><p className="mt-6 text-center text-sm text-muted-foreground">Chưa có tài khoản? <Link href="/dang-ky" className="font-bold text-primary hover:underline">Đăng ký ngay</Link></p><Link href="/" className="mt-5 block text-center text-sm font-semibold text-muted-foreground hover:text-primary">Tiếp tục mua hoa như khách</Link></section></div></main>;
}
