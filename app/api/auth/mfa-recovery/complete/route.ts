import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { verifyMfaRecoveryProof } from "../../../../../lib/security/mfa-recovery";

const completeSchema = z.object({ proof: z.string().min(32).max(2048) });

function json(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function appOrigin(request: NextRequest) {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) return new URL(configuredUrl).origin;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL is required in production");
  return request.nextUrl.origin;
}

function isTrustedRequestOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get("origin")?.trim();
  if (!requestOrigin) return false;
  try {
    return requestOrigin === appOrigin(request);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) return json({ message: "The recovery request origin is not trusted." }, 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "The recovery request is invalid." }, 400);
  }

  const parsed = completeSchema.safeParse(payload);
  if (!parsed.success) return json({ message: "The recovery link is invalid or expired." }, 400);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json({ message: "Authentication is not configured for this environment." }, 503);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user || !user.email || !verifyMfaRecoveryProof(parsed.data.proof, user.email)) {
    return json({ message: "The recovery link is invalid or expired." }, 403);
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    if (listError || !factors) return json({ message: "We could not inspect your authenticator setup." }, 502);

    for (const factor of factors.factors.filter((candidate) => candidate.factor_type === "totp" && candidate.status === "verified")) {
      const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
      if (deleteError) {
        console.error("[mfa recovery] factor deletion failed", { userId: user.id, factorId: factor.id, code: deleteError.code ?? null });
        return json({ message: "The recovery link could not reset your authenticator. Please request a new link." }, 502);
      }
    }

    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return json({ message: "Authenticator recovery is not configured on the server." }, 503);
    }
    return json({ message: "The recovery link could not reset your authenticator. Please request a new link." }, 502);
  }
}
