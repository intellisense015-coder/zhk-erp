import { NextRequest } from "next/server";
import { loginSchema } from "../../../../lib/validations";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { consumeRateLimit } from "../../../../lib/security/rate-limit";
import { checkLoginLockout, clearLoginFailures, recordLoginFailure } from "../../../../lib/security/login-protection";

const LOGIN_MESSAGE = "Unable to sign in with those details.";

function clientAddress(request: NextRequest) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function json(payload: Record<string, unknown>, status = 200, retryAfter?: number) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return Response.json(payload, { status, headers });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ message: LOGIN_MESSAGE }, 400);
  }

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) return json({ message: LOGIN_MESSAGE }, 400);

  const email = parsed.data.email.trim().toLowerCase();
  const addressRate = consumeRateLimit(`login-ip:${clientAddress(request)}`, 20, 15 * 60 * 1000);
  if (!addressRate.allowed) {
    return json({ message: "Too many sign-in attempts. Please try again later." }, 429, addressRate.retryAfter);
  }

  const lockout = checkLoginLockout(email);
  if (!lockout.allowed) {
    return json({ message: "Too many sign-in attempts. Please try again later." }, 429, lockout.retryAfter);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json({ message: "Authentication is not configured for this environment." }, 503);

  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) {
    const failure = recordLoginFailure(email);
    return json({ message: failure.locked ? "Too many sign-in attempts. Please try again later." : LOGIN_MESSAGE }, failure.locked ? 429 : 401, failure.retryAfter);
  }

  clearLoginFailures(email);
  return json({ ok: true });
}
