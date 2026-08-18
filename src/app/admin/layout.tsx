import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "./_components/AdminNav";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const current = await requireAdmin();
  if (!current) redirect("/dang-nhap?next=%2Fadmin&reauth=1");

  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl">CÁ&apos;S HOA</p>
            <p className="mt-1 text-sm text-muted-foreground">Trung tâm điều hành shop</p>
          </div>
          <LinkToStore />
        </header>
        <AdminNav />
        {children}
      </div>
    </main>
  );
}

function LinkToStore() {
  return (
    <Link href="/" className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      Về cửa hàng
    </Link>
  );
}
