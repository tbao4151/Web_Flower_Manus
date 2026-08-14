import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const current = await getCurrentProfile();
  if (!current) redirect("/dang-nhap?next=%2Ftai-khoan");
  if (!current.profile.is_active || current.profile.role !== "customer") redirect("/");
  return children;
}
