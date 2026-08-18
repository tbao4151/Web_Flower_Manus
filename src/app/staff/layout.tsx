import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";

export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const current = await requireStaff();
  if (!current) redirect("/dang-nhap?next=%2Fstaff&reauth=1");
  return children;
}
