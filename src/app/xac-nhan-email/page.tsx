"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { OtpCodeInput } from "@/components/OtpCodeInput";
import { maskGmail } from "@/lib/auth-validation";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const [email] = useState(() => typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("email") || "").toLowerCase() : "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!email || !/^\d{6}$/.test(code)) { setError("Vui lòng nhập đủ 6 chữ số trong mã xác nhận."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, token: code }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Mã xác nhận không đúng hoặc đã hết hạn."); return; }
      router.replace(result.redirectTo || "/tai-khoan");
      router.refresh();
    } catch {
      setError("Không thể kết nối tới dịch vụ xác nhận. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!email || cooldown > 0 || resending) return;
    setError("");
    setNotice("");
    setResending(true);
    try {
      const response = await fetch("/api/auth/signup", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Không thể gửi lại mã lúc này."); return; }
      setCooldown(60);
      setNotice("Mã mới đã được gửi. Vui lòng kiểm tra hộp thư Gmail.");
    } catch {
      setError("Không thể kết nối tới dịch vụ email. Vui lòng thử lại.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell eyebrow="Xác nhận Gmail" title="Kiểm tra hộp thư của bạn." description="Chúng tôi đã gửi mã xác nhận gồm 6 chữ số tới Gmail của bạn. Tài khoản chỉ hoàn tất sau khi mã được xác nhận.">
      <div className="mt-7 rounded-2xl bg-surface-muted p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary"><MailCheck size={19} aria-hidden="true" /></span><div className="min-w-0"><p className="text-xs text-muted-foreground">Mã được gửi tới</p><p className="truncate text-sm font-bold text-foreground">{email ? maskGmail(email) : "Gmail của bạn"}</p></div></div></div>
      <form onSubmit={verify} className="mt-7 space-y-5">
        <OtpCodeInput value={code} onChange={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} disabled={loading} />
        {error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-[#e4f0e2] px-4 py-3 text-sm leading-6 text-success">{notice}</p>}
        <button type="submit" disabled={loading || code.length !== 6} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}{loading ? "Đang xác nhận..." : "Xác nhận"}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <button type="button" onClick={resend} disabled={resending || cooldown > 0 || !email} className="mt-5 flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-bold text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50">{resending ? "Đang gửi lại..." : cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : "Gửi lại mã"}</button>
      <p className="mt-6 text-center text-sm text-muted-foreground">Nhập sai Gmail? <Link href="/dang-ky" className="font-bold text-primary hover:underline">Đăng ký lại</Link></p>
    </AuthShell>
  );
}
