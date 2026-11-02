import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

function safeInvitationId(value: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function redirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.nextUrl.origin));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const invitationId = safeInvitationId(request.nextUrl.searchParams.get("invitation"));
  const isInvitation = type === "invite";

  // PKCE uses `code`. The token-hash branch is a server-side compatibility
  // path for Supabase invite templates; it consumes the one-time hash before
  // redirecting, so neither form leaves a session token in the address bar.
  if (!code && !(tokenHash && isInvitation)) {
    return redirect(request, "/login?error=invalid_invitation");
  }

  // An invite token without the application invitation ID cannot be safely
  // associated with a workspace, so never turn it into an authenticated app
  // session that could continue through a different path.
  if (isInvitation && !invitationId) {
    return redirect(request, "/login?error=invalid_invitation");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return redirect(request, "/login?error=auth_unavailable");

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "invite" });
  if (error) return redirect(request, "/login?error=invitation_expired");

  if (invitationId) {
    const next = `/invite/accept?invitation=${encodeURIComponent(invitationId)}`;
    return redirect(request, `/reset-password?invite=1&next=${encodeURIComponent(next)}`);
  }

  return redirect(request, "/dashboard");
}
