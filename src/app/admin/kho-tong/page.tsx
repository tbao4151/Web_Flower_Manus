import Link from "next/link";

const warehouses = [
  {
    href: "/admin/kho-hoa",
    eyebrow: "FLOWER",
    title: "Kho Hoa",
    description: "Hoa, cành, bông, lá và các nguyên liệu thực vật. Theo dõi tồn khả dụng, mức tối thiểu và lịch sử giao dịch.",
    className: "bg-[#e4ecdf] text-primary",
  },
  {
    href: "/admin/kho-phu-kien",
    eyebrow: "ACCESSORY",
    title: "Kho Phụ kiện",
    description: "Giấy gói, ruy băng, nơ, túi, thiệp, giỏ, xốp, lưới, dây, hộp và phụ kiện vận hành shop.",
    className: "bg-[#f8e5ed] text-[#8d4962]",
  },
] as const;

export default function WarehouseOverviewPage() {
  return <main className="min-h-screen bg-background"><section className="container-cas py-8 sm:py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">Quản trị kho</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Kho tổng.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">Một hệ thống inventory dùng chung, phân loại theo `flower` và `accessory`. Chọn khu vực để quản lý item, đơn vị, tồn kho và lịch sử giao dịch.</p></div><Link href="/admin" className="rounded-full border border-border px-4 py-2 text-sm font-bold text-primary">Về tổng quan</Link></div><div className="mt-8 grid gap-5 md:grid-cols-2">{warehouses.map((warehouse) => <Link key={warehouse.href} href={warehouse.href} className="group rounded-3xl border border-border bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-8"><div className="flex items-start justify-between gap-4"><span className={`rounded-full px-3 py-1 text-[10px] font-bold tracking-[.16em] ${warehouse.className}`}>{warehouse.eyebrow}</span><span aria-hidden="true" className="text-2xl text-primary transition-transform group-hover:translate-x-1">→</span></div><h2 className="mt-8 font-display text-3xl sm:text-4xl">{warehouse.title}</h2><p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{warehouse.description}</p><span className="mt-7 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-bold text-white">Mở {warehouse.title}</span></Link>)}</div><div className="mt-8 rounded-2xl border border-border bg-surface p-5 text-sm leading-7 text-muted-foreground"><strong className="text-foreground">Nguyên tắc tồn kho:</strong> mọi nhập, xuất, hư hao và điều chỉnh số lượng đều được ghi vào `inventory_transactions`; sản phẩm hoặc item đã có lịch sử không bị hard-delete ngoài điều kiện an toàn.</div></section></main>;
}
