import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const current = await getCurrentProfile();
  if (!current) redirect("/dang-nhap?next=%2Fstaff");
  if (!current.profile.is_active || !["staff", "admin"].includes(current.profile.role)) redirect("/");
  return children;
}
