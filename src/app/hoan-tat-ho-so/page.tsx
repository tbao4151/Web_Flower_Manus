"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LoaderCircle, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { normalizeGmail } from "@/lib/auth-validation";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [next] = useState(() => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") || "/tai-khoan" : "/tai-khoan");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/onboarding", { cache: "no-store" })
      .then((response) => response.json().catch(() => ({})))
      .then((result) => {
        if (result.email) setEmail(normalizeGmail(result.email));
        if (result.phone) router.replace(result.redirectTo || "/tai-khoan");
      })
      .catch(() => setError("Không thể tải thông tin hồ sơ lúc này."));
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^0\d{9}$/.test(phone)) { setError("Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, next }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "Không thể hoàn tất hồ sơ."); return; }
      router.replace(result.redirectTo || "/tai-khoan");
      router.refresh();
    } catch {
      setError("Không thể kết nối tới dịch vụ hồ sơ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="Hoàn tất hồ sơ" title="Thêm số điện thoại của bạn." description="Google đã xác nhận Gmail. Vui lòng thêm số điện thoại để CÁ&apos;S HOA có thể liên hệ khi cần thiết. Bước này là bắt buộc.">
      <div className="mt-7 rounded-2xl bg-surface-muted p-4"><p className="text-xs text-muted-foreground">Gmail đã xác nhận</p><p className="mt-1 break-all text-sm font-bold text-foreground">{email || "Đang tải..."}</p></div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <label className="block text-sm font-semibold" htmlFor="onboarding-phone">Số điện thoại <span className="text-danger">*</span>
          <div className="relative mt-2"><Phone className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} aria-hidden="true" /><input id="onboarding-phone" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" inputMode="tel" pattern="0[0-9]{9}" placeholder="0889126325" autoComplete="tel" maxLength={10} required /></div>
        </label>
        <p className="text-xs leading-5 text-muted-foreground">Vui lòng nhập chính xác số điện thoại để CÁ&apos;S HOA có thể liên hệ khi cần thiết.</p>
        {error && <p role="alert" className="rounded-xl bg-[#fae8e4] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Phone size={17} aria-hidden="true" />}{loading ? "Đang lưu..." : "Hoàn tất"}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
    </AuthShell>
  );
}
