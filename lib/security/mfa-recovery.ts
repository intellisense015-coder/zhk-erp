import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PROOF_TTL_MS = 15 * 60 * 1000;

function recoverySecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", recoverySecret()).update(payload).digest("base64url");
}

export function createMfaRecoveryProof(email: string) {
  const payload = Buffer.from(JSON.stringify({
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + PROOF_TTL_MS,
    nonce: randomBytes(16).toString("hex"),
  })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyMfaRecoveryProof(proof: string, email: string) {
  const [payload, signature] = proof.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      expiresAt?: unknown;
    };
    return parsed.email === email.trim().toLowerCase()
      && typeof parsed.expiresAt === "number"
      && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}
