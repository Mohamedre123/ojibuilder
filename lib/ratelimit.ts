// Best-effort in-memory rate limiter (per warm serverless instance).
// Protects against burst abuse of the AI endpoints that would burn API credits.
// For hard guarantees across all instances, swap for Upstash Redis later.

interface Hit {
  count: number;
  reset: number;
}

const store = new Map<string, Hit>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hit = store.get(key);

  if (!hit || now > hit.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (hit.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((hit.reset - now) / 1000) };
  }
  hit.count++;
  return { ok: true, remaining: limit - hit.count };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Input guards — cap sizes so a malicious request can't trigger a huge token bill.
export const LIMITS = {
  MAX_PROMPT_CHARS: 5000,
  MAX_HTML_CHARS: 300_000,
  MAX_INSTRUCTION_CHARS: 2000,
};
