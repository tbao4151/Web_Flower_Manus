"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Leaf, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useShopSocialSettings } from "@/components/FloatingSocialContactWidget";

type CurrentProfile = { full_name: string | null; phone: string | null; role: string };
type CatalogType = "bouquet" | "basket" | null;

const STOREFRONT_EXCLUDED_PREFIXES = ["/admin", "/staff", "/tai-khoan", "/dang-nhap", "/dang-ky"];

function isStorefrontPath(pathname: string) {
  return !STOREFRONT_EXCLUDED_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function readCatalogType() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("type");
  return value === "bouquet" || value === "basket" ? value : null;
}

export default function GlobalStorefrontHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const socialSettings = useShopSocialSettings();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [catalogType, setCatalogType] = useState<CatalogType>(null);
  const [currentSearch, setCurrentSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [cartPulse, setCartPulse] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((result) => {
        if (active) setCurrentProfile(result.profile ?? null);
      })
      .catch(() => {
        if (active) setCurrentProfile(null);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const syncLocation = () => {
      setCurrentSearch(window.location.search);
      setCatalogType(readCatalogType());
    };
    syncLocation();
    const handlePopState = () => {
      syncLocation();
      setMobileNavOpen(false);
    };
    window.addEventListener("cas-hoa-location-updated", syncLocation);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("cas-hoa-location-updated", syncLocation);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [pathname]);

  useEffect(() => {
    const readCart = () => {
      try {
        const saved = window.localStorage.getItem("cas-hoa-cart");
        if (!saved) {
          setCartCount(0);
          return;
        }
        const cart = JSON.parse(saved) as Array<{ quantity?: unknown }>;
        setCartCount(cart.reduce((sum, line) => sum + Math.min(20, Math.max(0, Number(line.quantity) || 0)), 0));
      } catch {
        setCartCount(0);
      }
    };
    const handleCartUpdated = () => {
      readCart();
      setCartPulse(true);
      window.setTimeout(() => setCartPulse(false), 500);
    };
    readCart();
    window.addEventListener("cas-hoa-cart-updated", handleCartUpdated);
    window.addEventListener("storage", readCart);
    return () => {
      window.removeEventListener("cas-hoa-cart-updated", handleCartUpdated);
      window.removeEventListener("storage", readCart);
    };
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavOpen]);

  if (!pathname || !isStorefrontPath(pathname)) return null;

  const closeMobileNav = () => setMobileNavOpen(false);
  const handleCatalogLink = (type: CatalogType) => {
    setCatalogType(type);
    closeMobileNav();
    window.dispatchEvent(new Event("cas-hoa-location-updated"));
  };
  const openCart = () => {
    window.dispatchEvent(new Event("cas-hoa-open-cart"));
    if (pathname !== "/") router.push("/?cart=1");
  };
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  };
  const isHomeActive = pathname === "/" && !currentSearch.includes("view=catalog") && !currentSearch.includes("type=");
  const isBouquetActive = pathname === "/san-pham" && catalogType === "bouquet";
  const isBasketActive = pathname === "/san-pham" && catalogType === "basket";
  const linkClass = (active: boolean) => `transition hover:text-primary ${active ? "text-primary" : ""}`;
  const mobileLinkClass = "rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-surface-muted";
  const instagramProfile = socialSettings?.instagramUrl || "";

  return (
    <div data-global-storefront-header="true" className="sticky top-0 z-40 border-b border-border/80 bg-background/95 shadow-[0_8px_24px_-22px_rgba(28,50,40,.8)] backdrop-blur-xl">
      <div className="bg-foreground px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[.16em] text-[#f6eee1] sm:text-[11px]">Có sẵn thiệp và túi · Shop xác nhận đơn sau khi nhận thông tin</div>
      <header className="bg-background/95">
        <div className="container-cas flex min-h-[68px] items-center justify-between gap-3 sm:gap-4">
          <Link href="/" onClick={closeMobileNav} className="flex shrink-0 items-center gap-2.5 text-left" aria-label="Về trang chủ CÁ'S HOA">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[#fbf8ee]"><Leaf size={18} /></span>
            <span><span className="block font-display text-[21px] leading-none">CÁ&apos;S HOA</span><span className="mt-1 block text-[8px] font-bold uppercase tracking-[.28em] text-muted-foreground">flowers &amp; feelings</span></span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold md:flex" aria-label="Điều hướng chính">
            <Link href="/" onClick={closeMobileNav} className={linkClass(isHomeActive)} aria-current={isHomeActive ? "page" : undefined}>Trang chủ</Link>
            <Link href="/san-pham?type=bouquet" onClick={() => handleCatalogLink("bouquet")} className={linkClass(isBouquetActive)} aria-current={isBouquetActive ? "page" : undefined}>Bó hoa</Link>
            <Link href="/san-pham?type=basket" onClick={() => handleCatalogLink("basket")} className={linkClass(isBasketActive)} aria-current={isBasketActive ? "page" : undefined}>Giỏ hoa</Link>
            {instagramProfile && <a href={instagramProfile} target="_blank" rel="noreferrer" className="transition hover:text-primary">Instagram <ExternalLink size={13} className="ml-1 inline" /></a>}
          </nav>
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            <Link href="/san-pham" onClick={closeMobileNav} className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-surface-muted" aria-label="Tìm kiếm sản phẩm"><Search size={18} /></Link>
            {currentProfile ? <>
              {currentProfile.role === "customer" ? <><Link href="/tai-khoan" className="hidden h-10 items-center justify-center gap-1 rounded-full px-3 text-sm font-bold text-primary hover:bg-surface-muted sm:flex"><UserRound size={15} /> Tài khoản</Link><Link href="/tai-khoan/don-hang" className="hidden h-10 items-center justify-center rounded-full px-3 text-sm font-bold text-muted-foreground hover:bg-surface-muted md:flex">Đơn hàng</Link></> : currentProfile.role === "admin" ? <Link href="/admin" className="hidden h-10 items-center justify-center rounded-full px-3 text-sm font-bold text-primary hover:bg-surface-muted sm:flex">Quản trị</Link> : <Link href="/staff" className="hidden h-10 items-center justify-center rounded-full px-3 text-sm font-bold text-primary hover:bg-surface-muted sm:flex">Khu vực nhân viên</Link>}
              <button onClick={handleLogout} className="hidden h-10 items-center justify-center rounded-full px-3 text-sm font-bold text-muted-foreground hover:bg-surface-muted lg:flex">Đăng xuất</button>
            </> : <><Link href="/dang-nhap" className="hidden h-10 items-center justify-center rounded-full px-3 text-sm font-bold text-primary hover:bg-surface-muted sm:flex">Đăng nhập</Link><Link href="/dang-ky" className="hidden h-10 items-center justify-center rounded-full px-3 text-sm font-bold text-muted-foreground hover:bg-surface-muted md:flex">Đăng ký</Link></>}
            <Link href="/tra-cuu-don-hang" onClick={closeMobileNav} className="hidden h-10 items-center justify-center rounded-full px-3 text-sm font-bold text-muted-foreground hover:bg-surface-muted lg:flex">Tra cứu đơn</Link>
            <button data-cart-target="true" onClick={openCart} className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-foreground shadow-sm transition hover:bg-surface-muted ${cartPulse ? "scale-110" : ""}`} aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}><ShoppingBag size={18} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{cartCount}</span>}</button>
            <button onClick={() => setMobileNavOpen((open) => !open)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-surface-muted md:hidden" aria-label={mobileNavOpen ? "Đóng menu" : "Mở menu"} aria-expanded={mobileNavOpen} aria-controls="global-storefront-mobile-nav">{mobileNavOpen ? <X size={19} /> : <Menu size={19} />}</button>
          </div>
        </div>
        {mobileNavOpen && <nav id="global-storefront-mobile-nav" className="border-t border-border bg-background px-4 py-3 md:hidden" aria-label="Điều hướng mobile"><div className="container-cas grid gap-1"><Link href="/" onClick={closeMobileNav} className={mobileLinkClass}>Trang chủ</Link><Link href="/san-pham?type=bouquet" onClick={() => handleCatalogLink("bouquet")} className={mobileLinkClass}>Bó hoa</Link><Link href="/san-pham?type=basket" onClick={() => handleCatalogLink("basket")} className={mobileLinkClass}>Giỏ hoa</Link>{currentProfile ? <>{currentProfile.role === "customer" ? <><Link href="/tai-khoan" onClick={closeMobileNav} className={mobileLinkClass}>Tài khoản</Link><Link href="/tai-khoan/don-hang" onClick={closeMobileNav} className={mobileLinkClass}>Đơn hàng của tôi</Link></> : currentProfile.role === "admin" ? <Link href="/admin" onClick={closeMobileNav} className={mobileLinkClass}>Quản trị</Link> : <Link href="/staff" onClick={closeMobileNav} className={mobileLinkClass}>Khu vực nhân viên</Link>}<button onClick={handleLogout} className={mobileLinkClass}>Đăng xuất</button></> : <><Link href="/dang-nhap" onClick={closeMobileNav} className={mobileLinkClass}>Đăng nhập</Link><Link href="/dang-ky" onClick={closeMobileNav} className={mobileLinkClass}>Đăng ký</Link></>}<Link href="/tra-cuu-don-hang" onClick={closeMobileNav} className={mobileLinkClass}>Tra cứu đơn</Link>{instagramProfile && <a href={instagramProfile} target="_blank" rel="noreferrer" onClick={closeMobileNav} className={mobileLinkClass}>Instagram của shop</a>}</div></nav>}
      </header>
    </div>
  );
}
