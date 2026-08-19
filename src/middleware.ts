import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = ["/tai-khoan", "/staff", "/admin", "/hoan-tat-ho-so"];
const privilegedPaths = ["/staff", "/admin"];
const MANAGEMENT_SESSION_COOKIE = "cas_management_session";
const MANAGEMENT_INACTIVITY_MS = 30 * 60 * 1000;

function isPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isSafeInternalPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return false;
  try {
    return new URL(value, "https://cas-hoa.internal").origin === "https://cas-hoa.internal";
  } catch {
    return false;
  }
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifyManagementToken(token: string | undefined, expectedUserId: string, expectedRole: "staff" | "admin") {
  if (!token) return false;
  const [encodedPayload, encodedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra.length) return false;
  try {
    const secret = process.env.MANAGEMENT_SESSION_SECRET;
    if (!secret || secret.length < 32) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(encodedSignature), new TextEncoder().encode(encodedPayload));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as { userId?: string; role?: string; lastActiveAt?: number; expiresAt?: number };
    const now = Date.now();
    return payload.userId === expectedUserId && payload.role === expectedRole && typeof payload.lastActiveAt === "number" && typeof payload.expiresAt === "number" && payload.expiresAt > now && now - payload.lastActiveAt <= MANAGEMENT_INACTIVITY_MS;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const needsAuth = protectedPaths.some((path) => isPath(pathname, path));

  if (needsAuth && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/dang-nhap";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!user) return response;

  if (needsAuth) {
    const { data: profile } = await supabase.from("profiles").select("role, phone, is_active").eq("id", user.id).maybeSingle();
    if (!profile || profile.is_active === false) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/dang-nhap";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!profile.phone && !isPath(pathname, "/hoan-tat-ho-so")) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/hoan-tat-ho-so";
      if (isSafeInternalPath(pathname)) onboardingUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(onboardingUrl);
    }

    if (isPath(pathname, "/hoan-tat-ho-so")) return response;

    if (privilegedPaths.some((path) => isPath(pathname, path))) {
      const role = profile.role;
      const validRole = role === "staff" || role === "admin";
      const managementActive = validRole && profile.phone && profile.is_active === true && await verifyManagementToken(request.cookies.get(MANAGEMENT_SESSION_COOKIE)?.value, user.id, role);
      if (!managementActive) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/dang-nhap";
        loginUrl.searchParams.set("next", pathname);
        loginUrl.searchParams.set("reauth", "1");
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|ig-assets).*)"],
};
