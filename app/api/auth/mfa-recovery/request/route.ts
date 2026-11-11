import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { createMfaRecoveryProof } from "../../../../../lib/security/mfa-recovery";
import { consumeRateLimit } from "../../../../../lib/security/rate-limit";

const requestSchema = z.object({ email: z.string().trim().email().max(320) });

function json(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clientAddress(request: NextRequest) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function appOrigin(request: NextRequest) {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) {
    const parsed = new URL(configuredUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("APP_URL must use HTTP or HTTPS");
    return parsed.toString().replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL is required in production");
  return request.nextUrl.origin;
}

function isTrustedRequestOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get("origin")?.trim();
  if (!requestOrigin) return false;
  try {
    return requestOrigin === new URL(appOrigin(request)).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) return json({ message: "The recovery request origin is not trusted." }, 403);

  const rate = consumeRateLimit(`mfa-recovery:${clientAddress(request)}`, 5, 60 * 60 * 1000);
  if (!rate.allowed) return json({ message: "Too many recovery requests. Please try again later." }, 429);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "The recovery request is invalid." }, 400);
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return json({ message: "Enter a valid account email." }, 400);

  try {
    const admin = createSupabaseAdminClient();
    const proof = createMfaRecoveryProof(parsed.data.email);
    const redirectTo = `${appOrigin(request)}/mfa-recovery?proof=${encodeURIComponent(proof)}`;
    const { error } = await admin.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

    if (error) {
      console.error("[mfa recovery] Supabase email delivery failed", {
        status: error.status ?? null,
        code: error.code ?? null,
      });
    }

    // Do not disclose whether the email belongs to a user.
    return json({ message: "If an account exists for that email, a secure recovery link has been sent." });
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return json({ message: "Authenticator recovery is not configured on the server." }, 503);
    }
    if (error instanceof Error && error.message.includes("APP_URL")) {
      return json({ message: "The production application URL is not configured." }, 503);
    }
    return json({ message: "We could not process that request. Please try again." }, 502);
  }
}
