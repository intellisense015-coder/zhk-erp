type LoginFailureBucket = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
};

const buckets = new Map<string, LoginFailureBucket>();
const MAX_BUCKETS = 10_000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function cleanup(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.windowStartedAt + FAILURE_WINDOW_MS <= now && bucket.lockedUntil <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function keyFor(email: string) {
  return `login-account:${normalizeEmail(email)}`;
}

export function checkLoginLockout(email: string) {
  const now = Date.now();
  const key = keyFor(email);
  const current = buckets.get(key);

  if (!current) return { allowed: true, retryAfter: 0 };
  if (current.lockedUntil > now) {
    return { allowed: false, retryAfter: Math.max(Math.ceil((current.lockedUntil - now) / 1000), 1) };
  }
  if (current.windowStartedAt + FAILURE_WINDOW_MS <= now) buckets.delete(key);
  return { allowed: true, retryAfter: 0 };
}

export function recordLoginFailure(email: string) {
  const now = Date.now();
  const key = keyFor(email);
  const current = buckets.get(key);
  const bucket = !current || current.windowStartedAt + FAILURE_WINDOW_MS <= now
    ? { failures: 0, windowStartedAt: now, lockedUntil: 0 }
    : current;

  bucket.failures += 1;
  if (bucket.failures >= MAX_FAILURES) bucket.lockedUntil = now + LOCKOUT_MS;
  cleanup(now);
  buckets.set(key, bucket);

  return {
    locked: bucket.lockedUntil > now,
    retryAfter: bucket.lockedUntil > now ? Math.max(Math.ceil((bucket.lockedUntil - now) / 1000), 1) : 0,
  };
}

export function clearLoginFailures(email: string) {
  buckets.delete(keyFor(email));
}
