type Attempt = { count: number; resetAt: number };

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function isAuthRateLimited(request: Request, identifier: string) {
  const now = Date.now();
  const keys = [`ip:${getClientIp(request)}`, `identifier:${identifier}`];
  let limited = false;

  for (const key of keys) {
    const previous = attempts.get(key);
    if (!previous || previous.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
      continue;
    }
    previous.count += 1;
    if (previous.count > MAX_ATTEMPTS) limited = true;
  }

  if (attempts.size > 5000) {
    for (const [key, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(key);
    }
  }

  return limited;
}
