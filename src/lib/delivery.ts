const TIME_TOKEN_PATTERN = /^(\d{1,2})(?::|[hg.,])?(\d{2})?$/i;

function toMinutes(hour: number, minute: number) {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function normalizeTimeToken(input: string) {
  const compact = input.trim().toLowerCase().replace(/\s+/g, "");
  const match = compact.match(TIME_TOKEN_PATTERN);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const minutes = toMinutes(hour, minute);
  if (minutes === null) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Converts common Vietnamese time input into a canonical HH:mm or HH:mm - HH:mm value.
 * Examples: 14g -> 14:00, 14h -> 14:00, 13g-14h30 -> 13:00 - 14:30.
 */
export function normalizeDeliveryTime(input: string) {
  const normalizedInput = input
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\b(?:đến|toi|to)\b/g, "-")
    .replace(/\s+/g, " ");
  if (!normalizedInput) return null;

  const parts = normalizedInput.split(/\s*(?:-|~)\s*/).filter(Boolean);
  if (parts.length === 1) return normalizeTimeToken(parts[0]);
  if (parts.length !== 2) return null;

  const start = normalizeTimeToken(parts[0]);
  const end = normalizeTimeToken(parts[1]);
  if (!start || !end) return null;

  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  if (endMinutes < startMinutes) return null;
  return `${start} - ${end}`;
}
