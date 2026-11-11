import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

const PASSWORD_RECOVERY_COOKIE = "solexa-password-recovery-user";

export async function GET() {
  const cookieStore = await cookies();
  const recoveryUserId = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value;
  const supabase = await createSupabaseServerClient();
  if (!supabase || !recoveryUserId) return Response.json({ message: "Password recovery is not active." }, { status: 401 });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== recoveryUserId) {
    return Response.json({ message: "Password recovery is not active." }, { status: 401 });
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
