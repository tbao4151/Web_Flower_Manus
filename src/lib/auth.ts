import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase-server";

export const vietnamPhoneSchema = z.string().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số.");

export function toVietnamLocalPhone(input: string) {
  const compact = input.replace(/[\s().-]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  return compact;
}

/** @deprecated Use toVietnamLocalPhone for explicit local-format conversion. */
export function normalizeVietnamPhone(input: string) {
  return toVietnamLocalPhone(input);
}

export const normalizedPhoneSchema = z.string().trim().transform(toVietnamLocalPhone).pipe(vietnamPhoneSchema);

export function toSupabaseAuthPhone(phone: string) {
  const normalized = toVietnamLocalPhone(phone);
  return `+84${normalized.slice(1)}`;
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("id, full_name, phone, role, is_active").eq("id", user.id).maybeSingle();
  return data ? { user, profile: data } : null;
}

export async function requireStaff() {
  const current = await getCurrentProfile();
  if (!current || !current.profile.is_active || !["staff", "admin"].includes(current.profile.role)) return null;
  return current;
}

export async function requireAdmin() {
  const current = await getCurrentProfile();
  if (!current || !current.profile.is_active || current.profile.role !== "admin") return null;
  return current;
}
