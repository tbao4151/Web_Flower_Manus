"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Leaf, LoaderCircle, LockKeyhole, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") || "/tai-khoan" : "/tai-khoan";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, password }) });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(result.error || "Số điện thoại hoặc mật khẩu không đúng."); return; }
    router.replace(next);
    router.refresh();
  }

  return <main className="min-h-screen bg-background px-5 py-8 sm:px-8"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center"><Link href="/" className="mx-auto flex items-center gap-2 text-primary"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"><Leaf size={19} /></span><span className="font-display text-2xl text-foreground">CÁ&apos;S HOA</span></Link><section className="mt-8 rounded-[28px] border border-border bg-surface p-6 shadow-sm sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Tài khoản khách hàng</p><h1 className="mt-2 font-display text-4xl">Chào mừng bạn trở lại.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Đăng nhập để xem đơn hàng và lưu thông tin nhận hoa.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold">Số điện thoại<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-primary" inputMode="tel" placeholder="0356 925 367" autoComplete="tel" required /></label><label className="block text-sm font-semibold">Mật khẩu<input value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-primary" type="password" placeholder="Tối thiểu 8 ký tự" autoComplete="current-password" required /></label>{error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm text-danger">{error}</p>}<button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} /> : <LockKeyhole size={17} />} {loading ? "Đang đăng nhập..." : "Đăng nhập"}<ArrowRight size={17} /></button></form><p className="mt-6 text-center text-sm text-muted-foreground">Chưa có tài khoản? <Link href="/dang-ky" className="font-bold text-primary hover:underline">Đăng ký ngay</Link></p><Link href="/" className="mt-5 block text-center text-sm font-semibold text-muted-foreground hover:text-primary">Tiếp tục mua hoa như khách</Link></section></div></main>;
}
