"use client";

import { useEffect, useState } from "react";
import AdminNav from "../_components/AdminNav";

type Setting = { key: string; value_json?: Record<string, unknown> };

export default function AdminSettingsPage() {
  const [announcement, setAnnouncement] = useState("");
  const [socialEnabled, setSocialEnabled] = useState(true);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [zaloUrl, setZaloUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((response) => response.json())
      .then((result: { settings?: Setting[] }) => {
        const settings = result.settings || [];
        const announcementSetting = settings.find((value) => value.key === "announcement");
        const socialSetting = settings.find((value) => value.key === "social_widget");
        const contactSetting = settings.find((value) => value.key === "contact");
        const contact = contactSetting?.value_json || {};
        const social = socialSetting?.value_json || {};
        setAnnouncement(typeof announcementSetting?.value_json?.text === "string" ? announcementSetting.value_json.text : "");
        setSocialEnabled(social.enabled !== false);
        setInstagramUrl(typeof social.instagram_url === "string" ? social.instagram_url : typeof contact.instagram === "string" ? contact.instagram : "");
        setZaloUrl(typeof social.zalo_url === "string" ? social.zalo_url : typeof contact.zalo === "string" ? contact.zalo : "");
      })
      .catch(() => setMessage("Không thể tải cài đặt."));
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const [announcementResponse, socialResponse] = await Promise.all([
        fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: "announcement", valueJson: { text: announcement, enabled: Boolean(announcement.trim()) }, isPublic: true }),
        }),
        fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: "social_widget", valueJson: { enabled: socialEnabled, instagram_url: instagramUrl, zalo_url: zaloUrl }, isPublic: true }),
        }),
      ]);
      const socialResult = await socialResponse.json().catch(() => ({}));
      if (!announcementResponse.ok || !socialResponse.ok) throw new Error(socialResult.error || "Không thể lưu cài đặt.");
      setMessage("Đã lưu cài đặt shop.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminNav />
        <section className="mt-7 max-w-2xl rounded-[24px] border border-border bg-surface p-5 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Shop settings</p>
          <h1 className="mt-2 font-display text-4xl">Cài đặt shop</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Chỉ cấu hình nội dung vận hành công khai. Không lưu secret hoặc thông tin nhạy cảm trong settings.</p>

          <label className="mt-6 block text-sm font-semibold">
            Thông báo trên shop
            <textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} className="mt-2 min-h-32 w-full rounded-xl border border-border bg-background p-4" placeholder="Ví dụ: Shop nhận đơn trước 15:00 mỗi ngày..." />
          </label>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-sm font-bold">Floating Social Contact Widget</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Hiển thị nút liên hệ Instagram DM trước, sau đó đến Zalo ở góc dưới storefront. Nếu URL để trống, nút tương ứng sẽ không hiển thị.</p>
            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm font-semibold">
              <input type="checkbox" checked={socialEnabled} onChange={(event) => setSocialEnabled(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
              <span><span className="block">Bật Floating Social Contact Widget</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">Khách có thể đóng widget trong một phiên trình duyệt; phiên mới sẽ hiển thị lại.</span></span>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Instagram DM URL
              <input value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm" placeholder="https://ig.me/m/ten-shop" inputMode="url" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Ưu tiên link DM dạng `https://ig.me/m/ten-shop`; URL profile Instagram cũng sẽ được chuẩn hóa sang luồng DM khi có thể.</span>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Zalo URL / số điện thoại
              <input value={zaloUrl} onChange={(event) => setZaloUrl(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm" placeholder="https://zalo.me/... hoặc 0356925367" inputMode="url" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Có thể nhập link Zalo hoặc số điện thoại; server sẽ chuẩn hóa số điện thoại thành link `zalo.me`.</span>
            </label>
          </div>

          <button onClick={() => void save()} disabled={saving} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu cài đặt"}</button>
          {message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
        </section>
      </div>
    </main>
  );
}
