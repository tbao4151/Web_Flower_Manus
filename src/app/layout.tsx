import type { Metadata } from "next";
import "./globals.css";
import FloatingSocialContactWidget from "@/components/FloatingSocialContactWidget";

export const metadata: Metadata = {
  title: "CÁ'S HOA — Hoa cho những điều khó nói",
  description: "Hoa tươi, bó hoa và giỏ hoa được làm thủ công để gửi yêu thương theo cách thật đẹp.",
  openGraph: {
    title: "CÁ'S HOA — Hoa cho những điều khó nói",
    description: "Hoa tươi cho những ngày đáng nhớ và cả những ngày bình thường.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}<FloatingSocialContactWidget /></body></html>;
}
