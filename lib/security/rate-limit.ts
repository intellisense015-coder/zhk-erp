type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
      if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
    }
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: Math.max(limit - 1, 0), retryAfter: 0 };
  }

  current.count += 1;
  if (current.count > limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.max(Math.ceil((current.resetAt - now) / 1000), 1) };
  }
  return { allowed: true, remaining: Math.max(limit - current.count, 0), retryAfter: 0 };
}
