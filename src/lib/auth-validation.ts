import { z } from "zod";

export const GMAIL_REGEX = /^[^@\s]+@gmail\.com$/i;
export const VIETNAM_PHONE_REGEX = /^0\d{9}$/;

export function normalizeGmail(input: string) {
  return input.trim().toLowerCase();
}

export function isGmailAddress(input: string) {
  return GMAIL_REGEX.test(normalizeGmail(input));
}

export function normalizeVietnamPhone(input: string) {
  return input.trim().replace(/[\s().-]/g, "");
}

export function isVietnamLocalPhone(input: string) {
  return VIETNAM_PHONE_REGEX.test(input);
}

export const gmailSchema = z.string().trim().toLowerCase().refine((value) => GMAIL_REGEX.test(value), {
  message: "Vui lòng sử dụng địa chỉ Gmail @gmail.com.",
});

export const phoneSchema = z.string().trim().refine((value) => VIETNAM_PHONE_REGEX.test(value), {
  message: "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 0.",
});

export const passwordSchema = z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự.").max(128, "Mật khẩu không được vượt quá 128 ký tự.");

export const otpSchema = z.string().trim().regex(/^\d{6}$/, "Mã xác nhận phải gồm 6 chữ số.");

export function maskGmail(email: string) {
  const normalized = normalizeGmail(email);
  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) return "Gmail của bạn";
  if (localPart.length <= 2) return `${localPart[0] ?? "*"}***@${domain}`;
  return `${localPart[0]}${"*".repeat(Math.min(5, Math.max(3, localPart.length - 2)))}${localPart.at(-1)}@${domain}`;
}

export function isSafeInternalPath(value: string | null | undefined): value is string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return false;
  try {
    return new URL(value, "https://cas-hoa.internal").origin === "https://cas-hoa.internal";
  } catch {
    return false;
  }
}
