export function normalizeSocialUrl(provider: "instagram" | "zalo", input: unknown) {
  if (typeof input !== "string") return "";
  const value = input.trim();
  if (!value) return "";

  if (provider === "zalo" && /^(?:\+?84|0)\d{8,10}$/.test(value.replace(/[.\s()-]/g, ""))) {
    const digits = value.replace(/[.\s()-]/g, "");
    const local = digits.startsWith("+84") ? `0${digits.slice(3)}` : digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
    if (/^0\d{9}$/.test(local)) return `https://zalo.me/${local}`;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const hostname = url.hostname.toLowerCase();
    const allowedHosts = provider === "instagram"
      ? new Set(["instagram.com", "www.instagram.com"])
      : new Set(["zalo.me", "www.zalo.me", "chat.zalo.me"]);
    if (!allowedHosts.has(hostname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}
