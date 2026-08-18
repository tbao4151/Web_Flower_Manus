import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { notFound } from "next/navigation";
import ProductImageCarousel from "@/components/ProductImageCarousel";
import { fetchCatalogProducts } from "@/lib/catalog";
import { formatPreorderLeadTime } from "@/lib/inventory";
import { formatVnd } from "@/lib/products";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { getPublicShopSocialSettings } from "@/lib/social";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product;
  let socialSettings = { enabled: false, instagramUrl: "", zaloUrl: "" };
  const supabase = createSupabaseAdminClient();
  try {
    product = (await fetchCatalogProducts(supabase, { slug, publishedOnly: true }))[0];
    socialSettings = await getPublicShopSocialSettings(supabase);
  } catch {
    product = undefined;
  }
  if (!product) notFound();

  const gallery = [product.image, ...product.gallery].filter(Boolean);
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95">
        <div className="container-cas flex h-16 items-center justify-between gap-4">
          <Link href="/" className="font-display text-2xl">CÁ&apos;S HOA</Link>
          <Link href="/san-pham" className="flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft size={15} /> Tất cả sản phẩm</Link>
        </div>
      </header>
      <section className="container-cas grid gap-8 py-8 sm:py-12 md:grid-cols-[minmax(0,.92fr)_minmax(380px,1.08fr)] md:items-start">
        <ProductImageCarousel images={gallery} alt={product.name} />
        <article className="rounded-[28px] border border-border bg-surface p-6 sm:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{product.type === "bouquet" ? "Bó hoa" : "Giỏ hoa"} · {product.sku}</p>
          <h1 className="mt-3 max-w-[26ch] font-display text-[clamp(2.35rem,4.6vw,4rem)] leading-[1.14] tracking-normal">{product.name.normalize("NFC")}</h1>
          <p className="mt-4 text-2xl font-bold text-primary">{formatVnd(product.salePrice ?? product.price)}</p>
          {product.salePrice && <p className="mt-1 text-sm text-muted-foreground line-through">{formatVnd(product.price)}</p>}
          {product.saleMode === "preorder" && product.preorderMinHours ? <p className="mt-4 rounded-2xl bg-[#e4ecdf] p-4 text-sm font-semibold leading-6 text-primary">Mẫu đặt trước — cần đặt trước {formatPreorderLeadTime(product.preorderMinHours)}. Shop vẫn có thể hỗ trợ trường hợp cần gấp, bạn cứ nhắn để được kiểm tra.</p> : product.availabilityStatus && <p className={`mt-4 rounded-2xl p-4 text-sm font-semibold ${product.availabilityStatus === "OUT_OF_STOCK" ? "bg-[#fae8e4] text-danger" : product.availabilityStatus === "LOW_STOCK" ? "bg-[#fff0da] text-foreground" : "bg-[#e4ecdf] text-primary"}`}>{product.availabilityStatus === "OUT_OF_STOCK" ? "Hiện đã hết hàng" : product.availabilityStatus === "LOW_STOCK" ? "Sắp hết — shop sẽ xác nhận lại trước khi chuẩn bị" : "Còn hàng"}</p>}
          <p className="mt-6 text-sm leading-7 text-muted-foreground">{product.description || "Mẫu hoa được shop cập nhật từ sản phẩm thực tế. Shop sẽ xác nhận tình trạng và chi tiết giao trước khi chuẩn bị."}</p>
          {socialSettings.enabled && (socialSettings.instagramUrl || socialSettings.zaloUrl) && <div className="mt-5 rounded-2xl border border-primary/15 bg-[#e4ecdf] p-4"><p className="text-sm font-semibold text-primary">Cần tư vấn mẫu này hoặc cần hoa gấp?</p><p className="mt-1 text-xs leading-5 text-primary/80">Nhắn Instagram DM trước để shop kiểm tra nhanh; nếu không tiện, bạn có thể liên hệ qua Zalo.</p><div className="mt-3 flex flex-wrap gap-2">{socialSettings.instagramUrl && <a href={socialSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-xs font-bold text-white">Instagram DM</a>}{socialSettings.zaloUrl && <a href={socialSettings.zaloUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-primary/25 px-4 text-xs font-bold text-primary">Zalo</a>}</div></div>}
          {product.composition && <div className="mt-6 rounded-2xl bg-background p-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Thành phần hoa</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{product.composition}</p></div>}
          <div className="mt-7 grid gap-3 sm:grid-cols-2">{!(product.inventoryConfigured === true && product.saleMode === "ready_stock" && product.availabilityStatus === "OUT_OF_STOCK") ? <Link href={`/?add=${product.slug}`} className="press flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary font-bold text-white"><ShoppingBag size={17} /> Thêm vào giỏ</Link> : <div className="flex min-h-12 items-center justify-center rounded-full bg-muted-foreground/20 text-sm font-bold text-muted-foreground">Hiện đã hết hàng</div>}<Link href="/tra-cuu-don-hang" className="press flex min-h-12 items-center justify-center rounded-full border border-border font-bold">Tra cứu đơn</Link></div>
          <p className="mt-5 text-xs leading-5 text-muted-foreground">Giá giao hàng sẽ được shop xác nhận sau khi nhận thông tin đơn. Thanh toán online chưa triển khai.</p>
        </article>
      </section>
    </main>
  );
}
