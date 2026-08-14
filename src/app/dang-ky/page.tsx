"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Leaf, LoaderCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName, phone, password }) });
    const result = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError(result.error || "Không thể tạo tài khoản."); return; }
    if (result.needsConfirmation) setMessage("Tài khoản đã được tạo. Hệ thống Auth hiện yêu cầu xác nhận số điện thoại trước khi đăng nhập.");
    else router.replace("/tai-khoan");
  }

  return <main className="min-h-screen bg-background px-5 py-8 sm:px-8"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center"><Link href="/" className="mx-auto flex items-center gap-2 text-primary"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"><Leaf size={19} /></span><span className="font-display text-2xl text-foreground">CÁ&apos;S HOA</span></Link><section className="mt-8 rounded-[28px] border border-border bg-surface p-6 shadow-sm sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Tạo tài khoản khách hàng</p><h1 className="mt-2 font-display text-4xl">Lưu lại những đơn hoa.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Dùng số điện thoại Việt Nam và mật khẩu. Tài khoản mới luôn bắt đầu với quyền Customer.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold">Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-primary" placeholder="Nguyễn Văn A" autoComplete="name" required /></label><label className="block text-sm font-semibold">Số điện thoại<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-primary" inputMode="tel" placeholder="0356 925 367" autoComplete="tel" required /></label><label className="block text-sm font-semibold">Mật khẩu<input value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-primary" type="password" placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" minLength={8} required /></label>{error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm text-danger">{error}</p>}{message && <p role="status" className="rounded-xl bg-[#e4ecdf] px-4 py-3 text-sm text-primary">{message}</p>}<button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} /> : <UserRound size={17} />} {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}<ArrowRight size={17} /></button></form><p className="mt-6 text-center text-sm text-muted-foreground">Đã có tài khoản? <Link href="/dang-nhap" className="font-bold text-primary hover:underline">Đăng nhập</Link></p></section></div></main>;
}
