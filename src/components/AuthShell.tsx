import type { ReactNode } from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";

export function AuthShell({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1fr)] lg:items-center">
          <aside className="hidden rounded-[32px] bg-surface-muted p-8 lg:block xl:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[.22em] text-primary">CÁ&apos;S HOA · FLOWERS &amp; FEELINGS</p>
            <h2 className="mt-5 max-w-sm font-display text-5xl leading-[1.05] text-foreground">Những điều khó nói, gửi cùng một nhành hoa.</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">Tài khoản giúp bạn lưu thông tin, theo dõi đơn và giữ lại những lựa chọn hoa dành cho người thương.</p>
            <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-primary"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"><Leaf size={18} aria-hidden="true" /></span><span>Tiệm hoa tươi online</span></div>
          </aside>
          <div className="mx-auto w-full max-w-md">
            <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-primary" aria-label="Về trang chủ CÁ'S HOA">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white"><Leaf size={19} aria-hidden="true" /></span>
              <span className="font-display text-2xl text-foreground">CÁ&apos;S HOA</span>
            </Link>
            <section className="mt-8 rounded-[28px] border border-border bg-surface p-6 shadow-sm sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow}</p>
              <h1 className="mt-2 font-display text-4xl leading-tight text-foreground">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
              {children}
              {footer}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export function GoogleAuthButton({ next }: { next?: string }) {
  const query = new URLSearchParams();
  if (next) query.set("next", next);
  return (
    <a href={`/api/auth/google${query.toString() ? `?${query.toString()}` : ""}`} className="press flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-4 text-sm font-bold text-foreground transition-colors hover:border-primary hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-[11px] font-bold text-[#4285F4]" aria-hidden="true">G</span>
      Tiếp tục với Google
    </a>
  );
}
