import { cookies } from "next/headers";

const PASSWORD_RECOVERY_COOKIE = "solexa-password-recovery-user";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
