"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronLeft,
  Leaf,
  Menu,
  Copy,

  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { formatVnd, products, type Product, type ProductType } from "@/lib/products";
import { formatPreorderLeadTime, receiveDateTimeFromDelivery } from "@/lib/inventory";
import { normalizeDeliveryTime } from "@/lib/delivery";
import { useShopSocialSettings } from "@/components/FloatingSocialContactWidget";

type View = "home" | "catalog";
type Filters = { type: "all" | ProductType; category: string; tone: string; occasion: string; maxPrice: number };
type CartLine = { product: Product; quantity: number };
type SubmitState = "idle" | "submitting" | "success" | "error";
type CheckoutForm = {
  recipientName: string;
  recipientPhone: string;
  address: string;
  isPickup: boolean;
  deliveryDate: string;
  deliveryTime: string;
  cardMessage: string;
  note: string;
};

type OrderResult = { code: string; summary: string };
type FeaturedHeroProduct = { id: string; slug: string; name: string; image: string; featuredPosition: 1 | 2 | 3 };
type ProductTypeOption = { id: string; name: string; slug: string };
type FlyImage = { id: string; image: string; left: number; top: number; size: number; dx: number; dy: number; phase: "start" | "end" };

const todayPlusOne = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const getPrice = (product: Product) => product.salePrice ?? product.price;
const isOutOfStockReadyProduct = (product: Product) => product.inventoryConfigured === true && product.saleMode === "ready_stock" && product.availabilityStatus === "OUT_OF_STOCK";
const preorderHoursForCart = (cart: CartLine[]) => Math.max(0, ...cart.map((line) => line.product.saleMode === "preorder" ? line.product.preorderMinHours || 0 : 0));

function HeroFeaturedImage({ product, loading, slot, className }: { product?: FeaturedHeroProduct; loading: boolean; slot: string; className: string }) {
  if (loading) return <div aria-label={`${slot} đang tải`} className={`animate-pulse bg-surface-muted ${className}`} />;
  if (!product) return <div aria-label={`${slot} chưa được chọn`} className={`flex items-center justify-center bg-surface-muted px-6 text-center text-xs font-semibold text-muted-foreground ${className}`}>Mẫu nổi bật đang được cập nhật</div>;
  return <a href={`/san-pham/${product.slug}`} aria-label={`Xem chi tiết ${product.name}`} className={`group block overflow-hidden bg-surface-muted outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}><img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /></a>;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"featured" | "newest" | "low" | "high">("featured");
  const [filters, setFilters] = useState<Filters>({ type: "all", category: "all", tone: "all", occasion: "all", maxPrice: 0 });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartReady, setCartReady] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [checkout, setCheckout] = useState<CheckoutForm>({ recipientName: "", recipientPhone: "", address: "", isPickup: false, deliveryDate: todayPlusOne(), deliveryTime: "", cardMessage: "", note: "" });
  const [currentProfile, setCurrentProfile] = useState<{ full_name: string | null; phone: string | null; role: string } | null>(null);
  const [productTypes, setProductTypes] = useState<ProductTypeOption[]>([]);
  const [priceConfig, setPriceConfig] = useState({ maxVnd: 0, stepVnd: 0 });
  const [flyImage, setFlyImage] = useState<FlyImage | null>(null);
  const [cartPulse, setCartPulse] = useState(false);
  const cartPulseTimeout = useRef<number | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(products);
  const [featuredHero, setFeaturedHero] = useState<FeaturedHeroProduct[]>([]);
  const [featuredHeroLoading, setFeaturedHeroLoading] = useState(true);
  const [isReceiverSelf, setIsReceiverSelf] = useState(false);
  const socialSettings = useShopSocialSettings();
  const instagramProfile = socialSettings?.instagramUrl || "";
  const zaloUrl = socialSettings?.zaloUrl || "";

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.ok ? response.json() : { user: null }).then((result) => setCurrentProfile(result.profile ?? null)).catch(() => setCurrentProfile(null));
    fetch("/api/catalog", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("catalog_unavailable");
      return response.json();
    }).then((result) => {
      setCatalogProducts(Array.isArray(result?.products) ? result.products as Product[] : []);
      setProductTypes(Array.isArray(result?.metadata?.productTypes) ? result.metadata.productTypes as ProductTypeOption[] : []);
      const config = result?.metadata?.filterConfig;
      setPriceConfig({ maxVnd: Number(config?.priceMaxVnd) > 0 ? Number(config.priceMaxVnd) : 0, stepVnd: Number(config?.priceStepVnd) > 0 ? Number(config.priceStepVnd) : 0 });
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const syncCatalogUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type");
      // URL state is synchronized intentionally for CTA deep links and browser navigation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveView(params.get("view") === "catalog" || type === "bouquet" || type === "basket" ? "catalog" : "home");
      if (params.get("cart") === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCartOpen(true);
      }
      if (type === "bouquet" || type === "basket") setFilters((current) => ({ ...current, type }));
    };
    syncCatalogUrl();
    window.addEventListener("popstate", syncCatalogUrl);
    return () => window.removeEventListener("popstate", syncCatalogUrl);
  }, []);

  useEffect(() => {
    fetch("/api/catalog/featured", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("featured_unavailable");
        return response.json();
      })
      .then((result) => setFeaturedHero(Array.isArray(result?.products) ? result.products as FeaturedHeroProduct[] : []))
      .catch(() => setFeaturedHero([]))
      .finally(() => setFeaturedHeroLoading(false));
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cas-hoa-cart");
      if (saved) {
        const savedCart = JSON.parse(saved) as Array<{ productId: string; quantity: number }>;
        // Cart restoration is intentionally browser-only to avoid trusting client prices during checkout.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCart(savedCart.flatMap((line) => {
          const product = catalogProducts.find((item) => item.id === line.productId);
          return product ? [{ product, quantity: Math.min(20, Math.max(1, line.quantity)) }] : [];
        }));
      }
    } catch {
      window.localStorage.removeItem("cas-hoa-cart");
    } finally {
      setCartReady(true);
    }
  }, [catalogProducts]);

  useEffect(() => {
    if (cartReady) {
      window.localStorage.setItem("cas-hoa-cart", JSON.stringify(cart.map((line) => ({ productId: line.product.id, quantity: line.quantity }))));
      window.dispatchEvent(new Event("cas-hoa-cart-updated"));
    }
  }, [cart, cartReady]);

  useEffect(() => {
    const openCart = () => setCartOpen(true);
    window.addEventListener("cas-hoa-open-cart", openCart);
    return () => window.removeEventListener("cas-hoa-open-cart", openCart);
  }, []);

  const allFlowerTypes = Array.from(new Set(catalogProducts.flatMap((product) => product.flowerTypes ?? product.categories))).sort();
  const allTones = Array.from(new Set(catalogProducts.flatMap((product) => product.tones))).sort();
  const allOccasions = Array.from(new Set(catalogProducts.flatMap((product) => product.occasions))).sort();
  const activeProducts = catalogProducts.filter((product) => product.status === "published");
  const catalogPriceMax = priceConfig.maxVnd > 0 ? priceConfig.maxVnd : Math.max(0, ...activeProducts.map(getPrice));
  const catalogPriceStep = priceConfig.stepVnd > 0 ? priceConfig.stepVnd : Math.max(1, Math.ceil(catalogPriceMax / 20));
  const selectedMaxPrice = filters.maxPrice > 0 ? Math.min(filters.maxPrice, catalogPriceMax) : catalogPriceMax;
  const featured = activeProducts.filter((product) => product.featured);
  const visibleProducts = (() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = activeProducts.filter((product) => {
      const searchable = [product.name, product.sku, ...(product.flowerTypes ?? product.categories), product.sourceCaption].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesType = filters.type === "all" || product.type === filters.type;
      const matchesFlowerType = filters.category === "all" || (product.flowerTypes ?? product.categories).includes(filters.category);
      const matchesTone = filters.tone === "all" || product.tones.includes(filters.tone);
      const matchesOccasion = filters.occasion === "all" || product.occasions.includes(filters.occasion);
      return matchesQuery && matchesType && matchesFlowerType && matchesTone && matchesOccasion && getPrice(product) <= selectedMaxPrice;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "low") return getPrice(a) - getPrice(b);
      if (sort === "high") return getPrice(b) - getPrice(a);
      if (sort === "newest") return b.sourceDate.localeCompare(a.sourceDate);
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.sourceDate.localeCompare(a.sourceDate);
    });
  })();

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + getPrice(line.product) * line.quantity, 0);
  const shipping = 0;
  const total = subtotal;

  const goCatalog = (type?: "all" | ProductType) => {
    setActiveView("catalog");
    if (type) setFilters((current) => ({ ...current, type }));
    const params = new URLSearchParams(window.location.search);
    params.set("view", "catalog");
    if (type === "bouquet" || type === "basket") params.set("type", type);
    if (type === "all") params.delete("type");
    window.history.pushState({}, "", params.toString() ? `/?${params.toString()}` : "/");
    window.dispatchEvent(new Event("cas-hoa-location-updated"));
    window.setTimeout(() => document.getElementById("catalog-search")?.focus(), 60);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => {
    setActiveView("home");
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new Event("cas-hoa-location-updated"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const triggerCartFeedback = (product: Product) => {
    const source = document.querySelector(`[data-product-image="${product.id}"]`) as HTMLElement | null;
    const target = document.querySelector("[data-cart-target=\"true\"]") as HTMLElement | null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCartPulse(true);
    if (cartPulseTimeout.current) window.clearTimeout(cartPulseTimeout.current);
    cartPulseTimeout.current = window.setTimeout(() => setCartPulse(false), 700);
    if (reducedMotion || !source || !target) return;
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const size = Math.max(36, Math.min(72, sourceRect.width * 0.24));
    const startLeft = sourceRect.left + (sourceRect.width - size) / 2;
    const startTop = sourceRect.top + (sourceRect.height - size) / 2;
    const targetLeft = targetRect.left + targetRect.width / 2 - size / 2;
    const targetTop = targetRect.top + targetRect.height / 2 - size / 2;
    setFlyImage({ id: product.id, image: product.image, left: startLeft, top: startTop, size, dx: targetLeft - startLeft, dy: targetTop - startTop, phase: "start" });
    window.requestAnimationFrame(() => setFlyImage((current) => current ? { ...current, phase: "end" } : null));
    window.setTimeout(() => setFlyImage(null), 760);
  };

  const addToCart = (product: Product) => {
    if (isOutOfStockReadyProduct(product)) {
      setErrorMessage("Mẫu hoa này hiện đã hết nguyên liệu sẵn có. Bạn có thể liên hệ shop để hỏi lịch đặt trước.");
      return false;
    }
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      if (found) return current.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(20, line.quantity + 1) } : line);
      return [...current, { product, quantity: 1 }];
    });
    setErrorMessage("");
    triggerCartFeedback(product);
    return true;
  };

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("add");
    if (!slug) return;
    const product = catalogProducts.find((item) => item.slug === slug && item.status === "published");
    if (product && !isOutOfStockReadyProduct(product)) {
      // This one-shot URL action intentionally updates the cart after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      addToCart(product);
      setCartOpen(true);
      window.history.replaceState({}, "", "/");
    }
    // Product-detail add links are one-shot and removed from history after handling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogProducts]);

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) => current.flatMap((line) => line.product.id !== productId ? [line] : line.quantity + delta <= 0 ? [] : [{ ...line, quantity: Math.min(20, line.quantity + delta) }]));
  };

  const updateCheckout = (field: keyof CheckoutForm, value: string) => setCheckout((current) => ({ ...current, [field]: value }));

  const createOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cart.length) return;
    const requiredPreorderHours = preorderHoursForCart(cart);
    if (requiredPreorderHours > 0) {
      const normalizedTime = normalizeDeliveryTime(checkout.deliveryTime);
      const receiveAt = normalizedTime ? receiveDateTimeFromDelivery(checkout.deliveryDate, normalizedTime) : null;
      if (!receiveAt || receiveAt.getTime() - Date.now() < requiredPreorderHours * 60 * 60 * 1000) {
        setSubmitState("error");
        setErrorMessage(`Giỏ hàng có mẫu đặt trước, cần đặt trước ${formatPreorderLeadTime(requiredPreorderHours)}. Bạn có thể chọn thời gian xa hơn hoặc liên hệ shop để được hỗ trợ qua Instagram DM hoặc Zalo.`);
        return;
      }
    }
    setSubmitState("submitting");
    setErrorMessage("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })), checkout }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Không thể tạo đơn hàng.");
      setOrderResult({ code: payload.orderCode, summary: payload.summary });
      setSubmitState("success");
      setCart([]);
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(error instanceof Error ? error.message : "Không thể tạo đơn hàng.");
    }
  };

  const copySummary = async () => {
    if (!orderResult) return;
    await navigator.clipboard.writeText(orderResult.summary);
    setErrorMessage("Đã copy nội dung đơn. Bạn hãy dán vào cuộc trò chuyện với shop.");
  };

  const resetFilters = () => {
    setQuery("");
    setFilters({ type: "all", category: "all", tone: "all", occasion: "all", maxPrice: catalogPriceMax });
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {flyImage && <img aria-hidden="true" src={flyImage.image} alt="" className="pointer-events-none fixed z-[70] rounded-full object-cover shadow-lg" style={{ left: flyImage.left, top: flyImage.top, width: flyImage.size, height: flyImage.size, opacity: flyImage.phase === "end" ? 0.22 : 1, transform: flyImage.phase === "end" ? `translate(${flyImage.dx}px, ${flyImage.dy}px) scale(.35)` : "translate(0, 0) scale(1)", transition: "transform 650ms cubic-bezier(.2,.8,.2,1), opacity 650ms ease" }} />}

      {activeView === "home" ? <>
        <section className="container-cas py-8 sm:py-10 md:py-12" aria-labelledby="hero-title"><div className="mx-auto max-w-6xl"><h1 id="hero-title" className="sr-only">Mẫu hoa nổi bật của CÁ&apos;S HOA</h1><div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Mẫu hoa nổi bật</p><div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-2.5"><button onClick={() => goCatalog("bouquet")} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-xs font-bold uppercase tracking-[.06em] text-white hover:bg-primary-hover sm:min-w-36 sm:px-4 sm:text-sm">Xem bó hoa <ArrowRight size={16} /></button><button onClick={() => goCatalog("basket")} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-primary bg-background px-3 text-xs font-bold uppercase tracking-[.06em] text-primary hover:bg-[#e4ecdf] sm:min-w-36 sm:px-4 sm:text-sm">Xem giỏ hoa <ArrowRight size={16} /></button></div></div><div className="grid grid-cols-3 gap-2.5 sm:gap-3 lg:gap-4"><HeroFeaturedImage product={featuredHero.find((item) => item.featuredPosition === 1)} loading={featuredHeroLoading} slot="Ảnh nổi bật thứ nhất" className="aspect-[2/3] rounded-[24px_24px_8px_24px] sm:rounded-[28px_28px_10px_28px]" /><HeroFeaturedImage product={featuredHero.find((item) => item.featuredPosition === 2)} loading={featuredHeroLoading} slot="Ảnh nổi bật thứ hai" className="aspect-[2/3] rounded-[24px_8px_24px_24px] sm:rounded-[28px_10px_28px_28px]" /><HeroFeaturedImage product={featuredHero.find((item) => item.featuredPosition === 3)} loading={featuredHeroLoading} slot="Ảnh nổi bật thứ ba" className="aspect-[2/3] rounded-[8px_24px_24px_24px] sm:rounded-[10px_28px_28px_28px]" /></div></div></section>
        <section className="border-y border-border bg-surface py-8"><div className="container-cas"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Mua nhanh</p><h2 className="mt-1 font-display text-3xl sm:text-4xl">Bạn đang tìm gì?</h2></div><button onClick={() => goCatalog()} className="hidden items-center gap-1 text-sm font-bold text-primary sm:flex">Tất cả sản phẩm <ArrowRight size={15} /></button></div><div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4"><QuickShopButton label="Bó hoa" detail="Mẫu đang có" image="/ig-assets/garden.jpg" onClick={() => goCatalog("bouquet")} /><QuickShopButton label="Giỏ hoa" detail="Xem sản phẩm" image="/ig-assets/cam-tu-cau.jpg" onClick={() => goCatalog("basket")} /><QuickShopButton label="Dưới 350.000đ" detail="Chọn theo giá" image="/ig-assets/son-sac-thuy-chung.jpg" onClick={() => { setFilters((current) => ({ ...current, maxPrice: 350000 })); goCatalog(); }} /><QuickShopButton label="Mẫu mới" detail="Vừa cập nhật" image="/ig-assets/ly-xanh.jpg" onClick={() => { setSort("newest"); goCatalog(); }} /></div><button onClick={() => goCatalog()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-bold text-primary sm:hidden">Xem tất cả sản phẩm <ArrowRight size={15} /></button></div></section>
        <section className="container-cas py-10 sm:py-14"><div className="mb-6 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Đang được chọn</p><h2 className="mt-2 font-display text-4xl sm:text-5xl">Bó hoa mới cập nhật.</h2></div><button onClick={() => goCatalog()} className="hidden items-center gap-1 text-sm font-bold text-primary sm:flex">Xem tất cả <ArrowRight size={15} /></button></div><div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">{featured.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />)}</div></section>
        <section className="bg-surface py-10 sm:py-14"><div className="container-cas grid gap-7 md:grid-cols-[.8fr_1.2fr] md:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Theo dõi mẫu thật</p><h2 className="mt-2 font-display text-4xl sm:text-5xl">Hoa mới lên Instagram.</h2><p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">Xem thêm các mẫu hoa và thông tin giá được shop công khai trên tài khoản chính thức.</p>{instagramProfile && <a href={instagramProfile} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover">Nhắn Instagram DM <ExternalLink size={15} /></a>}</div><div className="grid grid-cols-3 gap-2.5 sm:gap-3"><a href="https://www.instagram.com/p/Dbc8XX0lAL4/" target="_blank" rel="noreferrer"><img src="/ig-assets/hoa-ly.jpg" alt="Xem bài đăng Hoa ly trên Instagram" className="aspect-square w-full rounded-2xl object-cover transition hover:opacity-80" /></a><a href="https://www.instagram.com/p/DbKovTNgadK/" target="_blank" rel="noreferrer"><img src="/ig-assets/cam-tu-cau.jpg" alt="Xem bài đăng Cẩm tú cầu trên Instagram" className="aspect-square w-full rounded-2xl object-cover transition hover:opacity-80" /></a><a href="https://www.instagram.com/p/DbFXU4-AZDP/" target="_blank" rel="noreferrer"><img src="/ig-assets/phi-yen.jpg" alt="Xem bài đăng Phi yến trên Instagram" className="aspect-square w-full rounded-2xl object-cover transition hover:opacity-80" /></a></div></div></section>
        <section className="container-cas py-10 sm:py-14"><div className="rounded-[26px] bg-foreground px-6 py-9 text-[#f9f5ea] sm:px-10 sm:py-12"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#c7d5bd]">CÁ&apos;S HOA</p><h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Tiệm hoa tươi online cho những điều khó nói.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-[#d8dfd1]">Chọn mẫu hoa, thêm lời nhắn và gửi thông tin đơn qua Instagram DM trước, hoặc Zalo sau khi website đã lưu đơn.</p><button onClick={() => goCatalog()} className="press mt-6 flex min-h-12 items-center gap-2 rounded-full bg-[#f4dfd3] px-5 text-sm font-bold text-foreground hover:bg-white">Chọn hoa ngay <ArrowRight size={16} /></button></div></section>
      </> : <CatalogHeader query={query} setQuery={setQuery} goHome={goHome} setFiltersOpen={setFiltersOpen} filters={filters} setFilters={setFilters} sort={sort} setSort={setSort} visibleProducts={visibleProducts} resetFilters={resetFilters} onAdd={addToCart} productTypes={productTypes} flowerTypes={allFlowerTypes} tones={allTones} occasions={allOccasions} priceMax={catalogPriceMax} priceStep={catalogPriceStep} />}

      <footer className="border-t border-border bg-surface"><div className="container-cas grid gap-8 py-10 sm:grid-cols-[1.3fr_1fr_1fr] sm:py-12"><div><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[#fbf8ee]"><Leaf size={18} /></span><span className="font-display text-2xl">CÁ&apos;S HOA</span></div><p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">Tiệm hoa tươi online. Luôn kèm sẵn thiệp và túi.</p></div><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Liên hệ</p><p className="mt-3 text-sm leading-7 text-muted-foreground">{instagramProfile && <><a className="hover:text-primary" href={instagramProfile} target="_blank" rel="noopener noreferrer">Instagram DM</a><br /></>}{zaloUrl && <a className="hover:text-primary" href={zaloUrl} target="_blank" rel="noopener noreferrer">Zalo</a>}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Địa chỉ</p><p className="mt-3 text-sm leading-7 text-muted-foreground">126/13 đường số 17<br />Linh Xuân, Thủ Đức, HCM</p></div></div><div className="container-cas flex flex-col gap-2 border-t border-border py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>© 2026 CÁ&apos;S HOA</span>{instagramProfile && <a href={instagramProfile} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Nhắn Instagram DM <ExternalLink size={12} className="ml-1 inline" /></a>}</div></footer>

      {detail && <ProductDetail product={detail} onClose={() => setDetail(null)} onAdd={() => { addToCart(detail); setDetail(null); setCartOpen(true); }} />}
      {cartOpen && <CartDrawer cart={cart} cartCount={cartCount} subtotal={subtotal} shipping={shipping} total={total} onClose={() => setCartOpen(false)} onChangeQuantity={changeQuantity} onRemove={(id) => setCart((current) => current.filter((line) => line.product.id !== id))} onCheckout={() => { setCheckoutOpen(true); setCartOpen(false); }} onBrowse={() => { setCartOpen(false); goCatalog(); }} />}
      {checkoutOpen && <CheckoutModal checkout={checkout} updateCheckout={updateCheckout} cart={cart} total={total} submitState={submitState} errorMessage={errorMessage} orderResult={orderResult} instagramUrl={instagramProfile} zaloUrl={zaloUrl} currentProfile={currentProfile} isReceiverSelf={isReceiverSelf} onToggleReceiverSelf={(checked) => { setIsReceiverSelf(checked); if (checked) setCheckout((value) => ({ ...value, recipientPhone: currentProfile?.phone ?? "", recipientName: currentProfile?.full_name ?? value.recipientName })); }} onTogglePickup={(checked) => setCheckout((value) => ({ ...value, isPickup: checked }))} onClose={() => { setCheckoutOpen(false); setSubmitState("idle"); }} onSubmit={createOrder} onCopy={copySummary} />}
      {filtersOpen && <div className="fixed inset-0 z-50 bg-foreground/25" onClick={() => setFiltersOpen(false)}><aside onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-0 right-0 max-h-[86vh] overflow-y-auto rounded-t-[28px] bg-surface p-5" aria-label="Bộ lọc sản phẩm"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Lọc nhanh</p><h2 className="mt-1 font-display text-3xl">Bộ lọc</h2></div><button onClick={() => setFiltersOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted" aria-label="Đóng bộ lọc"><X size={18} /></button></div><FilterBlock filters={filters} setFilters={setFilters} productTypes={productTypes} flowerTypes={allFlowerTypes} tones={allTones} occasions={allOccasions} priceMax={catalogPriceMax} priceStep={catalogPriceStep} /><button onClick={() => setFiltersOpen(false)} className="mt-7 flex min-h-12 w-full items-center justify-center rounded-full bg-primary font-bold text-white">Xem kết quả</button></aside></div>}
    </main>
  );
}

function QuickShopButton({ label, detail, image, onClick }: { label: string; detail: string; image: string; onClick: () => void }) {
  return <button onClick={onClick} className="group relative min-w-0 overflow-hidden rounded-2xl text-left"><img src={image} alt="" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 to-transparent p-3 pt-8 text-white"><strong className="block truncate text-sm">{label}</strong><span className="mt-0.5 block truncate text-[11px] text-white/75">{detail}</span></span></button>;
}

function CatalogHeader({ query, setQuery, goHome, setFiltersOpen, filters, setFilters, sort, setSort, visibleProducts, resetFilters, onAdd, productTypes, flowerTypes, tones, occasions, priceMax, priceStep }: { query: string; setQuery: (value: string) => void; goHome: () => void; setFiltersOpen: (value: boolean) => void; filters: Filters; setFilters: (value: Filters) => void; sort: "featured" | "newest" | "low" | "high"; setSort: (value: "featured" | "newest" | "low" | "high") => void; visibleProducts: Product[]; resetFilters: () => void; onAdd: (product: Product) => void; productTypes: ProductTypeOption[]; flowerTypes: string[]; tones: string[]; occasions: string[]; priceMax: number; priceStep: number }) {
  return <section className="container-cas py-7 sm:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><button onClick={goHome} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-primary"><ChevronLeft size={16} /> Về trang chủ</button><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Cửa hàng CÁ&apos;S HOA</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Chọn bó hoa.</h1></div><div className="flex w-full items-center gap-2 rounded-full border border-border bg-surface px-4 py-3 sm:max-w-[350px]"><Search size={17} className="text-muted-foreground" /><input id="catalog-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoa, mã sản phẩm..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></div></div><div className="mt-6 flex items-center justify-between gap-2 border-y border-border py-3"><button onClick={() => setFiltersOpen(true)} className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-bold md:hidden"><Menu size={16} /> Bộ lọc</button><p className="text-sm text-muted-foreground"><strong className="text-foreground">{visibleProducts.length}</strong> sản phẩm</p><div className="relative ml-auto flex items-center gap-2 text-sm"><span className="hidden text-muted-foreground sm:inline">Sắp xếp:</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="appearance-none rounded-full border border-border bg-surface py-2 pl-3 pr-8 font-semibold outline-none"><option value="featured">Nổi bật</option><option value="newest">Mới cập nhật</option><option value="low">Giá thấp đến cao</option><option value="high">Giá cao đến thấp</option></select><ChevronDown className="pointer-events-none absolute right-2.5" size={15} /></div></div><div className="mt-5 flex gap-2 overflow-x-auto pb-1 md:hidden"><FilterPill active={filters.type === "all"} label="Tất cả" onClick={() => setFilters({ ...filters, type: "all" })} />{productTypes.map((type) => <FilterPill key={type.id} active={filters.type === type.slug} label={type.name} onClick={() => setFilters({ ...filters, type: type.slug })} />)}</div><div className="mt-7 grid gap-7 md:grid-cols-[205px_1fr]"><aside className="hidden space-y-5 md:block"><FilterBlock filters={filters} setFilters={setFilters} productTypes={productTypes} flowerTypes={flowerTypes} tones={tones} occasions={occasions} priceMax={priceMax} priceStep={priceStep} /><button onClick={resetFilters} className="text-sm font-bold text-primary">Xóa bộ lọc</button></aside><div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">{visibleProducts.length ? visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => onAdd(product)} />) : <div className="col-span-full rounded-[22px] bg-surface px-5 py-14 text-center"><p className="font-display text-2xl sm:text-3xl">Chưa tìm thấy sản phẩm</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Thử từ khóa, loại hoa, tone màu hoặc khoảng giá khác nhé.</p><button onClick={resetFilters} className="mt-5 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">Xóa bộ lọc</button></div>}</div></div></section>;
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-primary bg-[#e4ecdf] text-primary" : "border-border bg-surface"}`}>{label}</button>;
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const outOfStock = isOutOfStockReadyProduct(product);
  return <article className="group flex min-w-0 flex-col"><a href={`/san-pham/${product.slug}`} className="block w-full flex-1 text-left"><div className="relative overflow-hidden rounded-[18px] bg-surface-muted"><img data-product-image={product.id} src={product.image} alt={product.name} className="aspect-[2/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />{product.featured && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-primary">Mới</span>}{product.saleMode === "preorder" && product.preorderMinHours ? <span className="absolute bottom-2 left-2 rounded-full bg-foreground/85 px-2 py-1 text-[9px] font-bold text-white">Đặt trước</span> : product.availabilityStatus && <span className={`absolute bottom-2 left-2 rounded-full px-2 py-1 text-[9px] font-bold ${product.availabilityStatus === "OUT_OF_STOCK" ? "bg-danger text-white" : product.availabilityStatus === "LOW_STOCK" ? "bg-[#f3d8b7] text-foreground" : "bg-[#dfeadd] text-primary"}`}>{product.availabilityStatus === "OUT_OF_STOCK" ? "Hết hàng" : product.availabilityStatus === "LOW_STOCK" ? "Sắp hết" : "Còn hàng"}</span>}</div><div className="mt-2.5 min-w-0"><div className="flex min-h-[2.7rem] items-start"><h3 className="line-clamp-2 min-w-0 font-display text-[17px] leading-tight sm:text-xl">{product.name}</h3></div><div className="mt-1 flex min-h-6 items-center gap-1.5 whitespace-nowrap"><span className="text-sm font-bold text-primary sm:text-base">{formatVnd(getPrice(product))}</span>{product.salePrice && <span className="text-xs text-muted-foreground line-through">{formatVnd(product.price)}</span>}</div><div className="mt-1 min-h-[3.1rem]">{product.saleMode === "preorder" && product.preorderMinHours ? <p className="text-[11px] font-semibold leading-5 text-primary sm:text-xs">Đặt trước {formatPreorderLeadTime(product.preorderMinHours)}</p> : product.description ? <p className="line-clamp-3 text-[11px] leading-5 text-muted-foreground sm:text-xs">{product.description}</p> : <span aria-hidden="true" />}</div></div></a><button disabled={outOfStock} onClick={onAdd} className="press mt-2 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-border text-xs font-bold text-primary transition hover:border-primary hover:bg-[#e4ecdf] disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-muted-foreground sm:min-h-10 sm:text-sm"><Plus size={14} /> {outOfStock ? "Hết hàng" : "Thêm nhanh"}</button></article>;
}

function ProductDetail({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: () => void }) {
  const outOfStock = isOutOfStockReadyProduct(product);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={`Chi tiết ${product.name}`}><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] bg-surface sm:rounded-[28px]"><div className="grid md:grid-cols-2"><div className="relative aspect-square bg-surface-muted"><img src={product.image} alt={product.name} className="h-full w-full object-cover" /><button onClick={onClose} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90" aria-label="Đóng chi tiết"><X size={19} /></button></div><div className="flex flex-col p-6 sm:p-9"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-primary"><span>{product.type === "bouquet" ? "Bó hoa" : "Giỏ hoa"}</span><span className="text-border">•</span><span>{product.sku}</span></div><h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{product.name}</h2><p className="mt-3 text-2xl font-bold text-primary">{formatVnd(getPrice(product))}</p>{product.saleMode === "preorder" && product.preorderMinHours ? <p className="mt-3 rounded-xl bg-[#e4ecdf] p-3 text-sm font-semibold leading-6 text-primary">Mẫu đặt trước — cần đặt trước {formatPreorderLeadTime(product.preorderMinHours)}.</p> : product.availabilityStatus && <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${product.availabilityStatus === "OUT_OF_STOCK" ? "bg-[#fae8e4] text-danger" : product.availabilityStatus === "LOW_STOCK" ? "bg-[#fff0da] text-foreground" : "bg-[#e4ecdf] text-primary"}`}>{product.availabilityStatus === "OUT_OF_STOCK" ? "Hiện đã hết hàng" : product.availabilityStatus === "LOW_STOCK" ? "Sắp hết — shop sẽ xác nhận lại tồn thực tế" : "Còn hàng"}</p>}{product.description && <p className="mt-5 text-sm leading-7 text-muted-foreground">{product.description}</p>}<div className="mt-6 rounded-2xl bg-background p-4 text-sm leading-6 text-muted-foreground"><p>Thông tin giá và hình ảnh được lấy từ bài đăng Instagram đã chọn của shop.</p><a href={product.sourceReference} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-bold text-primary hover:underline">Xem bài đăng gốc <ExternalLink size={14} /></a></div><div className="mt-auto pt-7"><button disabled={outOfStock} onClick={onAdd} className="press flex min-h-13 w-full items-center justify-center gap-3 rounded-full bg-primary font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted-foreground"><ShoppingBag size={18} /> {outOfStock ? "Hiện đã hết hàng" : "Thêm vào giỏ hàng"}</button></div></div></div></div></div>;
}

function FilterBlock({ filters, setFilters, productTypes, flowerTypes, tones, occasions, priceMax, priceStep }: { filters: Filters; setFilters: (filters: Filters) => void; productTypes: ProductTypeOption[]; flowerTypes: string[]; tones: string[]; occasions: string[]; priceMax: number; priceStep: number }) {
  const maxPrice = Math.max(priceStep, priceMax);
  const value = Math.min(filters.maxPrice || maxPrice, maxPrice);
  return <div className="space-y-5"><div><p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Dạng sản phẩm</p><div className="flex flex-wrap gap-2 md:block md:space-y-1.5"><FilterPill active={filters.type === "all"} label="Tất cả" onClick={() => setFilters({ ...filters, type: "all" })} />{productTypes.map((type) => <FilterPill key={type.id} active={filters.type === type.slug} label={type.name} onClick={() => setFilters({ ...filters, type: type.slug })} />)}</div></div>{flowerTypes.length > 0 && <div><p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Loại hoa</p><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"><option value="all">Tất cả</option>{flowerTypes.map((flowerType) => <option key={flowerType}>{flowerType}</option>)}</select></div>}{tones.length > 0 && <div><p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Tone màu</p><select value={filters.tone} onChange={(event) => setFilters({ ...filters, tone: event.target.value })} className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"><option value="all">Tất cả</option>{tones.map((tone) => <option key={tone}>{tone}</option>)}</select></div>}{occasions.length > 0 && <div><p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Dịp tặng</p><select value={filters.occasion} onChange={(event) => setFilters({ ...filters, occasion: event.target.value })} className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"><option value="all">Tất cả</option>{occasions.map((occasion) => <option key={occasion}>{occasion}</option>)}</select></div>}<div><div className="mb-2.5 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Giá tối đa</p><span className="text-xs font-bold text-primary">{formatVnd(value)}</span></div><input aria-label="Giá tối đa" type="range" min={priceStep} max={maxPrice} step={priceStep} value={value} onChange={(event) => setFilters({ ...filters, maxPrice: Number(event.target.value) })} className="w-full accent-[#71866c]" /></div></div>;
}

function CartDrawer({ cart, cartCount, subtotal, shipping, total, onClose, onChangeQuantity, onRemove, onCheckout, onBrowse }: { cart: CartLine[]; cartCount: number; subtotal: number; shipping: number; total: number; onClose: () => void; onChangeQuantity: (id: string, delta: number) => void; onRemove: (id: string) => void; onCheckout: () => void; onBrowse: () => void }) {
  return <div className="fixed inset-0 z-40 bg-foreground/25" onClick={onClose}><aside onClick={(event) => event.stopPropagation()} className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-surface shadow-2xl" aria-label="Giỏ hàng"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Đơn hàng của bạn</p><h2 className="mt-1 font-display text-3xl">Giỏ hoa <span className="text-primary">({cartCount})</span></h2></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted" aria-label="Đóng giỏ hàng"><X size={19} /></button></div>{cart.length ? <><div className="flex-1 space-y-5 overflow-y-auto p-5">{cart.map((line) => <div key={line.product.id} className="flex gap-3"><img src={line.product.image} alt="" className="h-20 w-20 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="font-display text-lg leading-tight">{line.product.name}</p><p className="mt-1 text-sm font-semibold text-primary">{formatVnd(getPrice(line.product))}</p><div className="mt-2 flex items-center gap-2"><button onClick={() => onChangeQuantity(line.product.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border" aria-label="Giảm số lượng"><Minus size={14} /></button><span className="w-5 text-center text-sm font-bold">{line.quantity}</span><button onClick={() => onChangeQuantity(line.product.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border" aria-label="Tăng số lượng"><Plus size={14} /></button></div></div><button onClick={() => onRemove(line.product.id)} className="self-start text-muted-foreground hover:text-danger" aria-label={`Xóa ${line.product.name}`}><X size={16} /></button></div>)}</div><div className="border-t border-border bg-background p-5"><div className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Tạm tính</span><span>{formatVnd(subtotal)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Phí giao hàng</span><span>Shop xác nhận sau</span></div><div className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-bold"><span>Tổng cộng</span><span className="text-primary">{formatVnd(total)}</span></div></div><button onClick={onCheckout} className="press mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-primary font-bold text-white hover:bg-primary-hover">Tiếp tục đặt hoa <ArrowRight size={18} /></button><p className="mt-3 text-center text-xs text-muted-foreground">Chưa cần thanh toán online — shop sẽ liên hệ xác nhận.</p></div></> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-primary"><ShoppingBag size={27} /></span><h3 className="mt-5 font-display text-2xl">Giỏ hàng đang trống</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Chọn một bó hoa thật xinh để bắt đầu gửi yêu thương.</p><button onClick={onBrowse} className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">Xem bộ sưu tập</button></div>}</aside></div>;
}

function CheckoutModal({ checkout, updateCheckout, cart, total, submitState, errorMessage, orderResult, instagramUrl, zaloUrl, currentProfile, isReceiverSelf, onToggleReceiverSelf, onTogglePickup, onClose, onSubmit, onCopy }: { checkout: CheckoutForm; updateCheckout: (field: keyof CheckoutForm, value: string) => void; cart: CartLine[]; total: number; submitState: SubmitState; errorMessage: string; orderResult: OrderResult | null; instagramUrl: string; zaloUrl: string; currentProfile: { full_name: string | null; phone: string | null; role: string } | null; isReceiverSelf: boolean; onToggleReceiverSelf: (checked: boolean) => void; onTogglePickup: (checked: boolean) => void; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCopy: () => void }) {
  const preorderHours = preorderHoursForCart(cart);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/30 p-0 backdrop-blur-sm sm:p-5"><div className="mx-auto min-h-full w-full max-w-3xl bg-surface sm:my-5 sm:min-h-0 sm:rounded-[28px]"><div className="flex items-center justify-between border-b border-border p-5 sm:p-7"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Bước cuối cùng</p><h2 className="mt-1 font-display text-3xl">Thông tin nhận hoa</h2></div><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted" aria-label="Đóng checkout"><X size={19} /></button></div>{submitState === "success" && orderResult ? <div className="p-7 text-center sm:p-14"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dfeadd] text-success"><Check size={30} /></span><p className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-success">Đã tạo đơn thành công</p><h2 className="mt-3 font-display text-4xl">Cảm ơn bạn đã đặt hoa</h2><p className="mx-auto mt-4 max-w-md leading-7 text-muted-foreground">Mã đơn hàng của bạn là <strong className="text-foreground">{orderResult.code}</strong>. Shop sẽ liên hệ để xác nhận đơn trước khi chuẩn bị.</p><div className="mt-7 rounded-2xl bg-background p-4 text-left text-sm leading-6 text-muted-foreground"><pre className="whitespace-pre-wrap font-sans">{orderResult.summary}</pre></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><button onClick={onCopy} className="press flex min-h-12 items-center justify-center gap-2 rounded-full border border-border font-bold"><Copy size={17} /> Copy đơn</button>{instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="press flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary font-bold text-white">Instagram DM</a>}{zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="press flex min-h-12 items-center justify-center gap-2 rounded-full border border-border font-bold">Zalo</a>}</div><p className="mt-4 text-xs text-muted-foreground">Website đã lưu đơn trước khi mở kênh liên hệ. Bạn hãy dán nội dung đã copy vào cuộc trò chuyện.</p>{errorMessage && <p className="mt-4 text-sm text-success">{errorMessage}</p>}</div> : <form onSubmit={onSubmit} className="p-5 sm:p-8">{preorderHours > 0 && <div className="mb-5 rounded-2xl border border-primary/20 bg-[#e4ecdf] p-4 text-sm leading-6 text-primary"><strong className="block">Mẫu đặt trước trong giỏ</strong><span className="mt-1 block">Vui lòng chọn thời gian nhận cách hiện tại ít nhất {formatPreorderLeadTime(preorderHours)}. Nếu cần gấp hơn, shop vẫn có thể hỗ trợ thủ công qua {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">Instagram DM</a>}{instagramUrl && zaloUrl && " hoặc "}{zaloUrl && <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline">Zalo</a>}.</span></div>}<div className="grid gap-5 md:grid-cols-2">{currentProfile?.role === "customer" && <label className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm md:col-span-2"><input type="checkbox" checked={isReceiverSelf} onChange={(event) => onToggleReceiverSelf(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" /><span><strong className="block">Tôi là người nhận</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">Dùng số điện thoại tài khoản và tên hồ sơ của bạn nếu đã có.</span></span></label>}<label className="flex items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm md:col-span-2"><input type="checkbox" checked={checkout.isPickup} onChange={(event) => onTogglePickup(event.target.checked)} className="mt-1 h-4 w-4 accent-[var(--primary)]" /><span><strong className="block">Tự tới lấy hoa</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">Không cần nhập địa chỉ giao. Shop sẽ xác nhận thời gian nhận tại cửa hàng.</span></span></label><Field label="Tên người nhận" required value={checkout.recipientName} onChange={(value) => updateCheckout("recipientName", value)} placeholder="Tên người nhận hoa" /><div><Field label="Số điện thoại người nhận" required value={checkout.recipientPhone} onChange={(value) => updateCheckout("recipientPhone", value)} placeholder="0356925367" type="tel" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Vui lòng kiểm tra kỹ số điện thoại để shop có thể liên hệ khi cần. CÁ&apos;S HOA không chịu trách nhiệm đối với gián đoạn giao/nhận do thông tin liên hệ được cung cấp không chính xác.</p></div>{checkout.isPickup ? <p className="rounded-2xl bg-surface-muted p-4 text-sm leading-6 text-muted-foreground md:col-span-2">Đơn này sẽ được đánh dấu <strong className="text-foreground">tự tới lấy tại shop</strong>, vì vậy không cần địa chỉ giao hoa.</p> : <Field label="Địa chỉ giao hoa" required value={checkout.address} onChange={(value) => updateCheckout("address", value)} placeholder="Số nhà, đường, phường, quận..." wide />}<Field label="Ngày nhận" required value={checkout.deliveryDate} onChange={(value) => updateCheckout("deliveryDate", value)} placeholder="Chọn ngày nhận" type="date" /><div><Field label={checkout.isPickup ? "Khung giờ tới lấy" : "Khung giờ giao"} required value={checkout.deliveryTime} onChange={(value) => updateCheckout("deliveryTime", value)} placeholder="Ví dụ: 14g, 13g-14h30 hoặc 13:00" /><p className="mt-2 text-xs leading-5 text-muted-foreground">Shop sẽ tự chuẩn hóa về dạng 24 giờ, ví dụ <strong>13:00 - 14:30</strong>.</p></div><Field label="Lời nhắn trên thiệp" value={checkout.cardMessage} onChange={(value) => updateCheckout("cardMessage", value)} placeholder="Gửi một lời thật đẹp..." wide textarea /><Field label="Ghi chú cho shop" value={checkout.note} onChange={(value) => updateCheckout("note", value)} placeholder="Màu sắc, cách liên hệ khi giao..." wide textarea /></div><div className="mt-7 rounded-2xl bg-surface-muted p-5"><div className="flex items-center gap-2 text-sm font-bold"><ShoppingBag size={17} className="text-primary" /> Tóm tắt đơn hàng</div><div className="mt-4 space-y-2 text-sm">{cart.map((line) => <div key={line.product.id} className="flex justify-between gap-3"><span className="text-muted-foreground">{line.product.name} × {line.quantity}</span><span>{formatVnd(getPrice(line.product) * line.quantity)}</span></div>)}<div className="mt-3 flex justify-between border-t border-border pt-3 font-bold"><span>Tạm tính</span><span className="text-primary">{formatVnd(total)}</span></div></div></div>{submitState === "error" && <div className="mt-5 rounded-2xl bg-[#fae8e4] p-4 text-sm leading-6 text-danger">{errorMessage}</div>}<button disabled={submitState === "submitting"} className="press mt-6 flex min-h-13 w-full items-center justify-center gap-3 rounded-full bg-primary font-bold text-white disabled:cursor-wait disabled:opacity-60">{submitState === "submitting" ? "Đang tạo đơn..." : "Xác nhận đặt hoa"}<ArrowRight size={18} /></button><p className="mt-3 text-center text-xs text-muted-foreground">Chưa có thanh toán online. Shop sẽ xác nhận đơn qua Instagram DM trước, hoặc Zalo.</p></form>}</div></div>;
}

function Field({ label, value, onChange, placeholder, type = "text", required = false, wide = false, textarea = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; required?: boolean; wide?: boolean; textarea?: boolean }) {
  return <label className={`${wide ? "md:col-span-2" : ""} block`}><span className="mb-2 block text-sm font-semibold">{label}{required && <span className="ml-1 text-accent">*</span>}</span>{textarea ? <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary" /> : <input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} className="h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary" />}</label>;
}

