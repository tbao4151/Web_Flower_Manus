"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Leaf, LoaderCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handlePhoneChange(value: string) {
    setPhone(value.replace(/\D/g, "").slice(0, 10));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^0\d{9}$/.test(phone)) { setError("Số điện thoại phải gồm đúng 10 chữ số."); return; }
    if (password.length < 8) { setError("Mật khẩu phải có ít nhất 8 ký tự."); return; }
    if (password !== confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; }
    setLoading(true);
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, password, confirmPassword }) });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(result.error || "Không thể tạo tài khoản."); return; }
    router.replace("/tai-khoan");
    router.refresh();
  }

  return <main className="min-h-screen bg-background px-5 py-8 sm:px-8"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center"><Link href="/" className="mx-auto flex items-center gap-2 text-primary"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"><Leaf size={19} /></span><span className="font-display text-2xl text-foreground">CÁ&apos;S HOA</span></Link><section className="mt-8 rounded-[28px] border border-border bg-surface p-6 shadow-sm sm:p-8"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Tạo tài khoản khách hàng</p><h1 className="mt-2 font-display text-4xl">Lưu lại những đơn hoa.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Dùng số điện thoại Việt Nam và mật khẩu. Tài khoản mới luôn bắt đầu với quyền Customer.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm font-semibold">Số điện thoại<input value={phone} onChange={(event) => handlePhoneChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary" inputMode="numeric" pattern="0[0-9]{9}" placeholder="0356925367" autoComplete="tel" maxLength={10} required /></label><p className="-mt-2 text-xs leading-5 text-muted-foreground">Vui lòng nhập chính xác số điện thoại. Nếu thông tin không đúng, shop có thể không liên hệ được khi đơn hàng phát sinh vấn đề. CÁ&apos;S HOA không chịu trách nhiệm đối với gián đoạn liên hệ do thông tin khách hàng cung cấp không chính xác.</p><label className="block text-sm font-semibold">Mật khẩu<div className="relative mt-2"><input value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none focus:border-primary" type={showPassword ? "text" : "password"} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label><label className="block text-sm font-semibold">Xác nhận mật khẩu<div className="relative mt-2"><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-12 text-base outline-none focus:border-primary" type={showConfirmation ? "text" : "password"} placeholder="Nhập lại mật khẩu" autoComplete="new-password" minLength={8} required /><button type="button" onClick={() => setShowConfirmation((value) => !value)} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground" aria-label={showConfirmation ? "Ẩn mật khẩu xác nhận" : "Hiện mật khẩu xác nhận"}>{showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm text-danger">{error}</p>}<button disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary font-bold text-white disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} /> : <UserRound size={17} />} {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}<ArrowRight size={17} /></button></form><p className="mt-6 text-center text-sm text-muted-foreground">Đã có tài khoản? <Link href="/dang-nhap" className="font-bold text-primary hover:underline">Đăng nhập</Link></p></section></div></main>;
}
