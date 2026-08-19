"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { OtpCodeInput } from "@/components/OtpCodeInput";
import { maskGmail } from "@/lib/auth-validation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json().catch(() => ({}));
      setMessage(result.message || "Nếu Gmail này được liên kết với tài khoản CÁ&apos;S HOA, mã khôi phục sẽ được gửi tới email.");
      setStep("verify");
    } catch {
      setMessage("Nếu Gmail này được liên kết với tài khoản CÁ&apos;S HOA, mã khôi phục sẽ được gửi tới email.");
      setStep("verify");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) { setError("Vui lòng nhập đủ 6 chữ số trong mã khôi phục."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/recovery", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, token: code }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Mã khôi phục không đúng hoặc đã hết hạn."); return; }
      router.replace(result.redirectTo || "/dat-lai-mat-khau");
    } catch {
      setError("Không thể kết nối tới dịch vụ khôi phục. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Khôi phục tài khoản" title="Quên mật khẩu" description="Nhập Gmail đã đăng ký. CÁ&apos;S HOA sẽ gửi mã khôi phục nếu Gmail này được liên kết với một tài khoản.">
      {step === "request" ? <form onSubmit={requestCode} className="mt-7 space-y-5"><label className="block text-sm font-semibold" htmlFor="recovery-email">Gmail<div className="relative mt-2"><Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} aria-hidden="true" /><input id="recovery-email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" type="email" inputMode="email" placeholder="example@gmail.com" autoComplete="email" required /></div></label><button type="submit" disabled={loading} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}{loading ? "Đang gửi mã..." : "Gửi mã xác nhận"}<ArrowRight size={17} aria-hidden="true" /></button></form> : <form onSubmit={verifyCode} className="mt-7 space-y-5"><div className="rounded-2xl bg-surface-muted p-4"><p className="text-xs text-muted-foreground">Mã khôi phục được gửi tới</p><p className="mt-1 break-all text-sm font-bold text-foreground">{maskGmail(email)}</p></div><OtpCodeInput value={code} onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} disabled={loading} />{error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}{message && <p role="status" className="rounded-xl bg-[#e4f0e2] px-4 py-3 text-sm leading-6 text-success">{message}</p>}<button type="submit" disabled={loading || code.length !== 6} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <KeyRound size={17} aria-hidden="true" />}{loading ? "Đang xác nhận..." : "Xác nhận mã"}<ArrowRight size={17} aria-hidden="true" /></button><button type="button" onClick={() => { setStep("request"); setCode(""); setError(""); }} className="min-h-11 w-full rounded-full border border-border bg-background text-sm font-bold text-foreground transition-colors hover:border-primary">Đổi Gmail</button></form>}
      <p className="mt-6 text-center text-sm text-muted-foreground">Nhớ mật khẩu rồi? <Link href="/dang-nhap" className="font-bold text-primary hover:underline">Đăng nhập</Link></p>
    </AuthShell>
  );
}
