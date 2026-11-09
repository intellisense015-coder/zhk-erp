import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { consumeRateLimit } from "../../../../lib/security/rate-limit";

const uuid = z.string().uuid();
const permissionSchema = z.record(
  z.string().min(1).max(64),
  z.object({
    can_view: z.boolean().optional(),
    can_edit: z.boolean().optional(),
  }),
);

const invitationSchema = z.object({
  workspaceId: uuid,
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  contact: z.string().trim().regex(/^[+()0-9 -]{7,32}$/),
  role: z.enum(["manager", "staff"]),
  permissions: permissionSchema,
});

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

function publicAppUrl(request: NextRequest) {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) {
    const parsed = new URL(configuredUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("APP_URL must use HTTP or HTTPS");
    return parsed.toString().replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL is required in production");
  }

  return request.nextUrl.origin;
}

function isTrustedRequestOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get("origin")?.trim();
  if (!requestOrigin) return false;

  try {
    return requestOrigin === new URL(publicAppUrl(request)).origin;
  } catch {
    return false;
  }
}

function safeInvitationDeliveryMessage(error: { message?: string | null; code?: string | null; status?: number | null } | null) {
  const details = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (details.includes("redirect") || details.includes("allowlist") || details.includes("redirect_to")) {
    return "Supabase rejected the callback URL. Add /auth/confirm to the Supabase Auth redirect allowlist.";
  }
  if (details.includes("rate") || error?.status === 429) {
    return "Supabase email delivery is temporarily rate-limited. Wait before sending another invitation and check Auth logs.";
  }
  if (details.includes("smtp") || details.includes("email provider") || details.includes("send email") || details.includes("mail")) {
    return "Supabase could not deliver the invitation email. Check the Auth email provider or SMTP configuration and Auth logs.";
  }
  return "Supabase Auth rejected the invitation email. Check Supabase Auth logs; no workspace access was granted.";
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return json({ message: "The invitation request origin is not trusted." }, 403);
  }

  const rate = consumeRateLimit(`workspace-invite:${clientAddress(request)}`, 10, 60 * 60 * 1000);
  if (!rate.allowed) {
    return json({ message: "Too many invitation attempts. Please try again later." }, 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "The invitation request is invalid." }, 400);
  }

  const parsed = invitationSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ message: "Enter a name, valid email, contact number, role, and permission selection." }, 400);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json({ message: "Supabase is not configured." }, 503);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ message: "Your session has expired. Please sign in again." }, 401);

  let invitationId: string | null = null;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("create_workspace_invitation_with_profile", {
      target_workspace_id: parsed.data.workspaceId,
      invitation_email: parsed.data.email,
      invitation_member_name: parsed.data.name,
      invitation_contact_number: parsed.data.contact,
      target_role: parsed.data.role,
      target_permissions: parsed.data.permissions,
    });

    if (error || typeof data !== "string") {
      return json({ message: error?.message || "The invitation could not be created." }, 400);
    }
    invitationId = data;

    const redirectTo = `${publicAppUrl(request)}/auth/confirm?invitation=${encodeURIComponent(invitationId)}`;
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo,
      data: {
        workspace_invitation_id: invitationId,
        member_name: parsed.data.name,
        contact_number: parsed.data.contact,
      },
    });

    if (inviteError || !inviteData.user) {
      await supabase.rpc("revoke_workspace_invitation", { target_invitation_id: invitationId });
      console.error("[workspace invitation] Supabase email delivery failed", {
        status: inviteError?.status ?? null,
        code: inviteError?.code ?? null,
      });
      if (inviteError?.message.toLowerCase().includes("already registered")
        || inviteError?.message.toLowerCase().includes("already been registered")) {
        return json({ message: "This email already has a Supabase account. Use a new email address for an invitation." }, 409);
      }
      return json({ message: safeInvitationDeliveryMessage(inviteError) }, 502);
    }

    const { error: attachError } = await supabase.rpc("attach_workspace_invitation_auth_user", {
      target_invitation_id: invitationId,
      invited_auth_user_id: inviteData.user.id,
    });

    if (attachError) {
      await supabase.rpc("revoke_workspace_invitation", { target_invitation_id: invitationId });
      return json({ message: "The invitation could not be linked securely." }, 502);
    }

    return json({ invitationId, message: "Invitation email sent securely." }, 201);
  } catch (error) {
    if (invitationId) {
      await supabase.rpc("revoke_workspace_invitation", { target_invitation_id: invitationId });
    }
    if (error instanceof Error && error.message.includes("APP_URL")) {
      return json({ message: "The production application URL is not configured." }, 503);
    }
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return json({ message: "Invitation service is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment and restart the app." }, 503);
    }
    return json({ message: "The invitation could not be completed securely." }, 502);
  }
}
