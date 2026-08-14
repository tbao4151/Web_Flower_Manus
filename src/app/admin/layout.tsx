import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const current = await getCurrentProfile();
  if (!current) redirect("/dang-nhap?next=%2Fadmin");
  if (!current.profile.is_active || current.profile.role !== "admin") redirect("/");
  return children;
}
