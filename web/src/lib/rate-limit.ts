/**
 * Small in-memory sliding-window limiter for the support endpoint. It is
 * per server instance, so it is a first line of defence only; the database
 * function enforces the authoritative per-email and global limits.
 * Keys are hashed, so raw IP addresses are never kept in memory or logs.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterS: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterS: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfterS: 0 };
}

export async function hashKey(value: string): Promise<string> {
  const data = new TextEncoder().encode(`haratna-support:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function resetRateLimitForTests() {
  hits.clear();
}
