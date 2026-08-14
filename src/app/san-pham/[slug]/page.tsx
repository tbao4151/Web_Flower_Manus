import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { notFound } from "next/navigation";
import { fetchCatalogProducts } from "@/lib/catalog";
import { formatVnd } from "@/lib/products";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product;
  try {
    product = (await fetchCatalogProducts(createSupabaseAdminClient(), { slug, publishedOnly: true }))[0];
  } catch {
    product = undefined;
  }
  if (!product) notFound();
  const gallery = [product.image, ...product.gallery].filter(Boolean);
  return <main className="min-h-screen bg-background"><header className="border-b border-border bg-background/95"><div className="container-cas flex h-16 items-center justify-between gap-4"><Link href="/" className="font-display text-2xl">CÁ&apos;S HOA</Link><Link href="/san-pham" className="flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft size={15} /> Tất cả sản phẩm</Link></div></header><section className="container-cas grid gap-8 py-8 sm:py-12 md:grid-cols-2 md:items-start"><div><div className="overflow-hidden rounded-[28px] bg-surface-muted"><img src={gallery[0]} alt={product.name} className="aspect-square w-full object-cover" /></div>{gallery.length > 1 && <div className="mt-3 grid grid-cols-4 gap-2">{gallery.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${product.name} - ảnh ${index + 1}`} className="aspect-square w-full rounded-xl object-cover" />)}</div>}</div><article className="rounded-[28px] border border-border bg-surface p-6 sm:p-9"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{product.type === "bouquet" ? "Bó hoa" : "Giỏ hoa"} · {product.sku}</p><h1 className="mt-3 font-display text-5xl leading-tight">{product.name}</h1><p className="mt-4 text-2xl font-bold text-primary">{formatVnd(product.salePrice ?? product.price)}</p>{product.salePrice && <p className="mt-1 text-sm text-muted-foreground line-through">{formatVnd(product.price)}</p>}<p className="mt-6 text-sm leading-7 text-muted-foreground">{product.description || "Mẫu hoa được shop cập nhật từ sản phẩm thực tế. Shop sẽ xác nhận tình trạng và chi tiết giao trước khi chuẩn bị."}</p>{product.composition && <div className="mt-6 rounded-2xl bg-background p-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Thành phần hoa</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{product.composition}</p></div>}<div className="mt-7 grid gap-3 sm:grid-cols-2"><Link href={`/?add=${product.slug}`} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary font-bold text-white"><ShoppingBag size={17} /> Thêm vào giỏ</Link><Link href="/tra-cuu-don-hang" className="flex min-h-12 items-center justify-center rounded-full border border-border font-bold">Tra cứu đơn</Link></div><p className="mt-5 text-xs leading-5 text-muted-foreground">Giá giao hàng sẽ được shop xác nhận sau khi nhận thông tin đơn. Thanh toán online chưa triển khai.</p></article></section></main>;
}
