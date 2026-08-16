"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type ShopSocialSettings = {
  enabled: boolean;
  instagramUrl: string;
  zaloUrl: string;
};

const DISMISS_KEY = "cas-hoa-floating-social-dismissed";

export function useShopSocialSettings() {
  const [settings, setSettings] = useState<ShopSocialSettings | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/shop-settings", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { social?: ShopSocialSettings } | null) => {
        if (active && payload?.social) setSettings(payload.social);
      })
      .catch(() => {
        if (active) setSettings(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}

function InstagramMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

function ZaloMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="currentColor" />
      <path d="M7.2 8.2h7.1l-5.4 6h5.9v1.7H7l5.4-6H7.2z" fill="var(--background)" />
      <path d="M15.1 8.2h1.7v7.7h-1.7z" fill="var(--background)" />
    </svg>
  );
}

function isStorefrontPath(pathname: string) {
  return !["/admin", "/staff", "/tai-khoan", "/dang-nhap", "/dang-ky"].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function FloatingSocialContactWidget() {
  const settings = useShopSocialSettings();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // If storage is unavailable, the widget remains dismissed for this render only.
    }
  };

  if (!settings?.enabled || dismissed || !pathname || !isStorefrontPath(pathname)) return null;
  if (!settings.instagramUrl && !settings.zaloUrl) return null;

  return (
    <div
      className="fixed z-20 flex flex-col items-start gap-2"
      style={{
        left: "max(12px, calc(env(safe-area-inset-left, 0px) + 12px))",
        bottom: "calc(var(--cas-bottom-nav-height, 0px) + env(safe-area-inset-bottom, 0px) + 12px)",
      }}
      aria-label="Liên hệ nhanh với CÁ'S HOA"
    >
      <div className="relative flex items-center gap-1.5 rounded-2xl border border-border bg-background/95 p-1.5 shadow-[0_8px_24px_rgba(36,53,45,.14)] backdrop-blur-sm">
        {settings.instagramUrl && <SocialLink href={settings.instagramUrl} label="Instagram" icon={<InstagramMark />} />}
        {settings.zaloUrl && <SocialLink href={settings.zaloUrl} label="Zalo" icon={<ZaloMark />} />}
        <button
          type="button"
          onClick={dismiss}
          className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none"
          aria-label="Đóng liên hệ nhanh"
          title="Đóng"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex min-h-11 min-w-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-foreground transition hover:bg-surface-muted focus-visible:outline-none"
      aria-label={label === "Instagram" ? "Mở Instagram DM của CÁ'S HOA" : `Mở ${label} của CÁ'S HOA`}
      title={label === "Instagram" ? "Nhắn Instagram DM" : label}
    >
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
      <span className="pointer-events-none absolute bottom-full left-0 mb-2 hidden whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[11px] font-semibold text-background opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 md:block">{label === "Instagram" ? "Nhắn Instagram DM" : `Mở ${label}`}</span>
    </a>
  );
}
