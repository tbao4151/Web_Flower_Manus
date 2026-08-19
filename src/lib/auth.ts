import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient, createSupabaseServerClient } from "./supabase-server";
import { isSafeInternalPath } from "./auth-validation";

export const vietnamPhoneSchema = z.string().regex(/^0\d{9}$/, "Số điện thoại phải gồm đúng 10 chữ số.");

export function toVietnamLocalPhone(input: string) {
  const compact = input.replace(/[\s().-]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
}

/** @deprecated Use the strict public phone schema for Auth forms. */
export function normalizeVietnamPhone(input: string) {
  return toVietnamLocalPhone(input);
}

/** Used by existing order-recipient lookup, which supports canonicalization. */
export const normalizedPhoneSchema = z.string().trim().transform(toVietnamLocalPhone).pipe(vietnamPhoneSchema);

export type AppRole = "customer" | "staff" | "admin";

export const MANAGEMENT_SESSION_COOKIE = "cas_management_session";
export const MANAGEMENT_INACTIVITY_MS = 30 * 60 * 1000;
export const MANAGEMENT_MAX_AGE_MS = 8 * 60 * 60 * 1000;
export const RECOVERY_SESSION_COOKIE = "cas_recovery_session";
export const RECOVERY_MAX_AGE_MS = 15 * 60 * 1000;

interface ManagementSessionPayload {
  userId: string;
  role: "staff" | "admin";
  issuedAt: number;
  lastActiveAt: number;
  expiresAt: number;
}

interface RecoverySessionPayload {
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

function getManagementSecret() {
  const secret = process.env.MANAGEMENT_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("MANAGEMENT_SESSION_SECRET is missing or too short.");
  return secret;
}

function getRecoverySecret() {
  const secret = process.env.RECOVERY_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("RECOVERY_SESSION_SECRET is missing or too short.");
  return secret;
}

function encodePayload(payload: object) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload, "utf8").digest("base64url");
}

function verifySignature(encodedPayload: string, signature: string, secret: string) {
  const expectedSignature = signPayload(encodedPayload, secret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function parseManagementPayload(encodedPayload: string) {
  try {
    const value = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<ManagementSessionPayload>;
    if (typeof value.userId !== "string" || !["staff", "admin"].includes(value.role || "") || !["issuedAt", "lastActiveAt", "expiresAt"].every((key) => typeof value[key as keyof ManagementSessionPayload] === "number")) return null;
    return value as ManagementSessionPayload;
  } catch {
    return null;
  }
}

function parseRecoveryPayload(encodedPayload: string) {
  try {
    const value = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<RecoverySessionPayload>;
    if (typeof value.userId !== "string" || !["issuedAt", "expiresAt"].every((key) => typeof value[key as keyof RecoverySessionPayload] === "number")) return null;
    return value as RecoverySessionPayload;
  } catch {
    return null;
  }
}

export function createManagementSessionToken(userId: string, role: "staff" | "admin", now = Date.now()) {
  const payload: ManagementSessionPayload = { userId, role, issuedAt: now, lastActiveAt: now, expiresAt: now + MANAGEMENT_MAX_AGE_MS };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${signPayload(encodedPayload, getManagementSecret())}`;
}

export function verifyManagementSessionToken(token: string | null | undefined, expectedUserId?: string, expectedRole?: "staff" | "admin", now = Date.now()) {
  if (!token) return null;
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length || !/^[A-Za-z0-9_-]+$/.test(encodedPayload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  try {
    if (!verifySignature(encodedPayload, signature, getManagementSecret())) return null;
  } catch {
    return null;
  }
  const payload = parseManagementPayload(encodedPayload);
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
  response.cookies.set({ name: MANAGEMENT_SESSION_COOKIE, value: `${encodedPayload}.${signPayload(encodedPayload, getManagementSecret())}`, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.floor(Math.max(0, session.expiresAt - now) / 1000) });
}

export function createRecoverySessionToken(userId: string, now = Date.now()) {
  const payload: RecoverySessionPayload = { userId, issuedAt: now, expiresAt: now + RECOVERY_MAX_AGE_MS };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${signPayload(encodedPayload, getRecoverySecret())}`;
}

export function verifyRecoverySessionToken(token: string | null | undefined, expectedUserId?: string, now = Date.now()) {
  if (!token) return null;
  const [encodedPayload, signature, ...extra] = token.split(".");
  if (!encodedPayload || !signature || extra.length || !/^[A-Za-z0-9_-]+$/.test(encodedPayload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  try {
    if (!verifySignature(encodedPayload, signature, getRecoverySecret())) return null;
  } catch {
    return null;
  }
  const payload = parseRecoveryPayload(encodedPayload);
  if (!payload || payload.expiresAt <= now || (expectedUserId && payload.userId !== expectedUserId)) return null;
  return payload;
}

export function setRecoverySessionCookie(response: NextResponse, userId: string, now = Date.now()) {
  response.cookies.set({ name: RECOVERY_SESSION_COOKIE, value: createRecoverySessionToken(userId, now), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: Math.floor(RECOVERY_MAX_AGE_MS / 1000) });
}

export async function getRecoverySessionForUser(userId: string) {
  const store = await cookies();
  return verifyRecoverySessionToken(store.get(RECOVERY_SESSION_COOKIE)?.value, userId);
}

export function clearRecoverySessionCookie(response: NextResponse) {
  response.cookies.set({ name: RECOVERY_SESSION_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export function getRoleLandingPath(role: string) {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/tai-khoan";
}

export function getSafeRoleRedirect(role: string, next?: string | null) {
  const fallback = getRoleLandingPath(role);
  if (!next || !isSafeInternalPath(next)) return fallback;
  if (role === "admin" && (next === "/admin" || next.startsWith("/admin/") || next === "/staff" || next.startsWith("/staff/"))) return next;
  if (role === "staff" && (next === "/staff" || next.startsWith("/staff/"))) return next;
  if (role === "customer" && (next === "/tai-khoan" || next.startsWith("/tai-khoan/"))) return next;
  return fallback;
}

export function isProfileComplete(profile: { phone: string | null; is_active: boolean }) {
  return profile.is_active && Boolean(profile.phone);
}

export async function getAuthUserByPhone(phone: string) {
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles").select("id, phone, full_name, role, is_active").eq("phone", phone).maybeSingle();
  if (profileError || !profile) return null;
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
  if (userError || !userData.user || !userData.user.email) return null;
  return { user: userData.user, profile };
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
  if (!current || !current.profile.is_active || !current.profile.phone || !["staff", "admin"].includes(current.profile.role)) return null;
  const management = await getManagementSessionForUser(current.user.id, current.profile.role as "staff" | "admin");
  if (!management) return null;
  return current;
}

export async function requireAdmin() {
  const current = await getCurrentProfile();
  if (!current || !current.profile.is_active || !current.profile.phone || current.profile.role !== "admin") return null;
  const management = await getManagementSessionForUser(current.user.id, "admin");
  if (!management) return null;
  return current;
}

export async function getPrivilegedAuthState() {
  const current = await getCurrentProfile();
  if (!current) return { current: null, managementActive: false };
  if (!current.profile.phone || !["staff", "admin"].includes(current.profile.role)) return { current, managementActive: false };
  return { current, managementActive: Boolean(await getManagementSessionForUser(current.user.id, current.profile.role as "staff" | "admin")) };
}
