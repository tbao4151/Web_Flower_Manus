import { createHmac } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase-server";

export const vietnamPhoneSchema = z.string().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số.");

export function toVietnamLocalPhone(input: string) {
  const compact = input.replace(/[\s().-]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
}

/** @deprecated Use toVietnamLocalPhone for explicit local-format conversion. */
export function normalizeVietnamPhone(input: string) {
  return toVietnamLocalPhone(input);
}

export const normalizedPhoneSchema = z.string().trim().transform(toVietnamLocalPhone).pipe(vietnamPhoneSchema);

export type AppRole = "customer" | "staff" | "admin";

export function getRoleLandingPath(role: string) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/tai-khoan";
}

function isInternalRelativePath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\\u0000-\\u001f]/.test(value)) return false;
  try {
    const parsed = new URL(value, "https://cas-hoa.internal");
    return parsed.origin === "https://cas-hoa.internal";
  } catch {
    return false;
  }
}

export function getSafeRoleRedirect(role: string, next?: string | null) {
  const fallback = getRoleLandingPath(role);
  if (!next || !isInternalRelativePath(next)) return fallback;

  if (role === "admin" && (next === "/admin" || next.startsWith("/admin/") || next === "/staff" || next.startsWith("/staff/"))) return next;
  if (role === "staff" && (next === "/staff" || next.startsWith("/staff/"))) return next;
  if (role === "customer" && (next === "/tai-khoan" || next.startsWith("/tai-khoan/"))) return next;
  return fallback;
}

/**
 * Maps a canonical local phone to an opaque, deterministic Auth email.
 * This helper is server-only because it reads AUTH_INTERNAL_EMAIL_SECRET.
 */
export function toInternalAuthEmail(phone: string) {
  const secret = process.env.AUTH_INTERNAL_EMAIL_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_INTERNAL_EMAIL_SECRET is missing or too short.");
  }

  const domain = (process.env.AUTH_INTERNAL_EMAIL_DOMAIN || "auth.cas-hoa.local").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new Error("AUTH_INTERNAL_EMAIL_DOMAIN is invalid.");
  }

  const normalized = toVietnamLocalPhone(phone);
  const digest = createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
  return `u-${digest}@${domain}`;
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
