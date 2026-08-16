import Link from "next/link";

const links = [
  ["/admin", "Tổng quan"],
  ["/admin/orders", "Đơn hàng"],
  ["/admin/san-pham", "Sản phẩm & hình ảnh"],
  ["/admin/kho-hoa", "Kho hoa"],
  ["/admin/lich-su-kho", "Lịch sử kho"],
  ["/admin/customers", "Khách hàng"],
  ["/admin/giao-hang", "Giao hàng"],
  ["/admin/danh-muc", "Danh mục"],
  ["/admin/tone-mau", "Tone màu"],
  ["/admin/dip-tang", "Dịp tặng"],
  ["/admin/nhan-vien", "Nhân viên"],
  ["/admin/cai-dat", "Cài đặt"],
] as const;

export default function AdminNav() {
  return <nav aria-label="Điều hướng quản trị" className="flex flex-wrap gap-2 border-b border-border pb-4 text-sm font-semibold">{links.map(([href, label]) => <Link key={href} href={href} className="rounded-full bg-surface px-4 py-2 hover:bg-surface-muted">{label}</Link>)}<Link href="/staff" className="rounded-full bg-surface px-4 py-2 hover:bg-surface-muted">Vận hành đơn</Link></nav>;
}
