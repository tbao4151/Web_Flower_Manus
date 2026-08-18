import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
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

export const MANAGEMENT_SESSION_COOKIE = "cas_management_session";
export const MANAGEMENT_INACTIVITY_MS = 30 * 60 * 1000;
export const MANAGEMENT_MAX_AGE_MS = 8 * 60 * 60 * 1000;

interface ManagementSessionPayload {
  userId: string;
  role: "staff" | "admin";
  issuedAt: number;
  lastActiveAt: number;
  expiresAt: number;
}

function getManagementSecret() {
  const secret = process.env.AUTH_INTERNAL_EMAIL_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_INTERNAL_EMAIL_SECRET is missing or too short.");
  return secret;
}

function encodePayload(payload: ManagementSessionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getManagementSecret()).update(encodedPayload, "utf8").digest("base64url");
}

function parsePayload(encodedPayload: string) {
  try {
    const value = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<ManagementSessionPayload>;
    if (typeof value.userId !== "string" || !["staff", "admin"].includes(value.role || "") || !["issuedAt", "lastActiveAt", "expiresAt"].every((key) => typeof value[key as keyof ManagementSessionPayload] === "number")) return null;
    return value as ManagementSessionPayload;
  } catch {
    return null;
  }
}

export function createManagementSessionToken(userId: string, role: "staff" | "admin", now = Date.now()) {
  const payload: ManagementSessionPayload = { userId, role, issuedAt: now, lastActiveAt: now, expiresAt: now + MANAGEMENT_MAX_AGE_MS };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyManagementSessionToken(token: string | null | undefined, expectedUserId?: string, expectedRole?: "staff" | "admin", now = Date.now()) {
  if (!token) return null;
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length || !/^[A-Za-z0-9_-]+$/.test(encodedPayload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  try {
    const expectedSignature = signPayload(encodedPayload);
    const validSignature = timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    if (!validSignature) return null;
  } catch {
    return null;
  }
  const payload = parsePayload(encodedPayload);
  if (!payload || payload.expiresAt <= now || now - payload.lastActiveAt > MANAGEMENT_INACTIVITY_MS) return null;
  if (expectedUserId && payload.userId !== expectedUserId) return null;
  if (expectedRole && payload.role !== expectedRole) return null;
  return payload;
}

export function setManagementSessionCookie(response: NextResponse, userId: string, role: "staff" | "admin", now = Date.now()) {
  response.cookies.set({ name: MANAGEMENT_SESSION_COOKIE, value: createManagementSessionToken(userId, role, now), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.floor(MANAGEMENT_MAX_AGE_MS / 1000) });
}

export function clearManagementSessionCookie(response: NextResponse) {
  response.cookies.set({ name: MANAGEMENT_SESSION_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getManagementSession() {
  const store = await cookies();
  return verifyManagementSessionToken(store.get(MANAGEMENT_SESSION_COOKIE)?.value);
}

export async function getManagementSessionForUser(userId: string, role: "staff" | "admin") {
  const session = await getManagementSession();
  return session && session.userId === userId && session.role === role ? session : null;
}

export function touchManagementSessionCookie(response: NextResponse, session: ManagementSessionPayload, now = Date.now()) {
  const nextPayload: ManagementSessionPayload = { ...session, lastActiveAt: now };
  const encodedPayload = encodePayload(nextPayload);
  response.cookies.set({ name: MANAGEMENT_SESSION_COOKIE, value: `${encodedPayload}.${signPayload(encodedPayload)}`, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.floor(Math.max(0, session.expiresAt - now) / 1000) });
}

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
  const management = await getManagementSessionForUser(current.user.id, current.profile.role as "staff" | "admin");
  if (!management) return null;
  return current;
}

export async function requireAdmin() {
  const current = await getCurrentProfile();
  if (!current || !current.profile.is_active || current.profile.role !== "admin") return null;
  const management = await getManagementSessionForUser(current.user.id, "admin");
  if (!management) return null;
  return current;
}

export async function getPrivilegedAuthState() {
  const current = await getCurrentProfile();
  if (!current) return { current: null, managementActive: false };
  if (!["staff", "admin"].includes(current.profile.role)) return { current, managementActive: false };
  return { current, managementActive: Boolean(await getManagementSessionForUser(current.user.id, current.profile.role as "staff" | "admin")) };
}
