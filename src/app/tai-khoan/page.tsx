"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Leaf, LoaderCircle, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Profile = { full_name: string | null; phone: string | null; role: string; is_active: boolean };
type Order = { order_code: string; recipient_name: string; total_vnd: number; status: string; created_at: string };
const formatVnd = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const labels: Record<string, string> = { pending_confirmation: "Chờ xác nhận", confirmed: "Đã xác nhận", preparing: "Đang chuẩn bị", delivering: "Đang giao", completed: "Hoàn tất", cancelled: "Đã huỷ" };

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/auth/me"), fetch("/api/account/orders")]).then(async ([meResponse, ordersResponse]) => {
      if (!meResponse.ok) { router.replace("/dang-nhap?next=/tai-khoan"); return; }
      const me = await meResponse.json();
      if (!me.user || !me.profile) { router.replace("/dang-nhap?next=/tai-khoan"); return; }
      setProfile(me.profile);
      setFullName(me.profile.full_name || "");
      setPhone(me.profile.phone || "");
      if (ordersResponse.ok) setOrders((await ordersResponse.json()).orders || []);
    }).finally(() => setLoading(false));
  }, [router]);

  async function saveProfile() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName }) });
    const result = await response.json().catch(() => ({})); setSaving(false);
    setMessage(response.ok ? "Đã lưu thông tin hồ sơ." : result.error || "Không thể lưu hồ sơ.");
    if (response.ok) setProfile(result.profile);
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/"); router.refresh(); }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><LoaderCircle className="animate-spin text-primary" /></div>;
  return <main className="min-h-screen bg-background px-5 py-6 sm:px-8"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between border-b border-border pb-5"><Link href="/" className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white"><Leaf size={17} /></span><span className="font-display text-xl">CÁ&apos;S HOA</span></Link><button onClick={logout} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-danger"><LogOut size={16} /> Đăng xuất</button></header><div className="grid gap-6 py-8 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[26px] border border-border bg-surface p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e4ecdf] text-primary"><UserRound size={20} /></span><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Tài khoản</p><h1 className="font-display text-3xl">Xin chào, {fullName || "bạn"}.</h1></div></div><div className="mt-7 space-y-4"><label className="block text-sm font-semibold">Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" /></label><label className="block text-sm font-semibold">Số điện thoại<input value={phone} readOnly className="mt-2 h-11 w-full cursor-not-allowed rounded-xl border border-border bg-muted px-3 text-muted-foreground" inputMode="tel" /><span className="mt-1 block text-xs font-normal text-muted-foreground">Số điện thoại dùng để đăng nhập và không thể tự thay đổi.</span></label><p className="text-xs text-muted-foreground">Quyền hiện tại: <strong className="uppercase">{profile?.role}</strong>. Quyền chỉ được thay đổi bởi Admin.</p><button onClick={saveProfile} disabled={saving} className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu hồ sơ"}</button>{message && <p className="text-sm text-primary">{message}</p>}</div></section><section className="rounded-[26px] border border-border bg-surface p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Lịch sử mua hàng</p><h2 className="mt-1 font-display text-3xl">Đơn hàng của tôi</h2></div><ClipboardList className="text-primary" /></div>{orders.length === 0 ? <div className="mt-8 rounded-2xl bg-background p-6 text-sm text-muted-foreground">Bạn chưa có đơn hàng gắn với tài khoản này. <Link href="/" className="font-bold text-primary">Chọn hoa ngay</Link>.</div> : <div className="mt-6 space-y-3">{orders.slice(0, 5).map((order) => <div key={order.order_code} className="flex items-center justify-between rounded-2xl border border-border p-4"><div><p className="font-bold">{order.order_code}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("vi-VN")} · {order.recipient_name}</p></div><div className="text-right"><p className="font-bold text-primary">{formatVnd(order.total_vnd)}đ</p><p className="text-xs text-muted-foreground">{labels[order.status] || order.status}</p></div></div>)}</div>}<div className="mt-6 flex flex-wrap gap-3"><Link href="/tai-khoan/don-hang" className="rounded-full border border-border px-4 py-2 text-sm font-bold hover:border-primary">Xem tất cả đơn</Link><Link href="/tra-cuu-don-hang" className="rounded-full border border-border px-4 py-2 text-sm font-bold hover:border-primary">Tra cứu đơn khách</Link></div></section></div><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={15} /> Về cửa hàng</Link></div></main>;
}
