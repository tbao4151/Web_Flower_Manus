import type { SupabaseClient } from "@supabase/supabase-js";

const instagramProfileSegments = new Set(["accounts", "about", "developer", "direct", "explore", "legal", "privacy", "reel", "reels", "stories", "web"]);

function normalizeInstagramUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const hostname = url.hostname.toLowerCase();

    if (hostname === "ig.me") {
      const match = /^\/m\/([^/]+)\/?$/.exec(url.pathname);
      return match ? `https://ig.me/m/${match[1]}` : "";
    }

    if (hostname !== "instagram.com" && hostname !== "www.instagram.com") return "";
    const [username = ""] = url.pathname.split("/").filter(Boolean);
    if (!username || instagramProfileSegments.has(username.toLowerCase())) return url.toString();
    return `https://ig.me/m/${username}`;
  } catch {
    return "";
  }
}

export function normalizeSocialUrl(provider: "instagram" | "zalo", input: unknown) {
  if (typeof input !== "string") return "";
  const value = input.trim();
  if (!value) return "";

  if (provider === "instagram") return normalizeInstagramUrl(value);

  if (/^(?:\+?84|0)\d{8,10}$/.test(value.replace(/[.\s()-]/g, ""))) {
    const digits = value.replace(/[.\s()-]/g, "");
    const local = digits.startsWith("+84") ? `0${digits.slice(3)}` : digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
    if (/^0\d{9}$/.test(local)) return `https://zalo.me/${local}`;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const hostname = url.hostname.toLowerCase();
    if (!["zalo.me", "www.zalo.me", "chat.zalo.me"].includes(hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export type PublicShopSocialSettings = {
  enabled: boolean;
  instagramUrl: string;
  zaloUrl: string;
};

export async function getPublicShopSocialSettings(supabase: SupabaseClient): Promise<PublicShopSocialSettings> {
  const { data, error } = await supabase
    .from("shop_settings")
    .select("key, value_json")
    .eq("is_public", true)
    .in("key", ["social_widget", "contact"]);

  if (error) throw error;

  const socialWidget = data?.find((item) => item.key === "social_widget")?.value_json as Record<string, unknown> | undefined;
  const contact = data?.find((item) => item.key === "contact")?.value_json as Record<string, unknown> | undefined;
  const instagramUrl = normalizeSocialUrl("instagram", socialWidget?.instagram_url ?? contact?.instagram);
  const zaloUrl = normalizeSocialUrl("zalo", socialWidget?.zalo_url ?? contact?.zalo);

  return {
    enabled: socialWidget?.enabled !== false && Boolean(instagramUrl || zaloUrl),
    instagramUrl,
    zaloUrl,
  };
}
