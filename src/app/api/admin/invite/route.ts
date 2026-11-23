import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/http";
import { requireAdmin, supabaseService } from "@/lib/supabase/admin";
import { SET_PASSWORD_PATH } from "@/lib/auth-paths";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200), admin: z.boolean().default(false) });

/**
 * Sends a Supabase invite email. The link signs the person in and opens the set-password page.
 * Re-inviting someone who never accepted sends a fresh link.
 */
export const POST = handle(async (req: Request) => {
  const { email: me } = await requireAdmin();
  const { email, admin } = Body.parse(await req.json());
  const svc = supabaseService();
  const redirectTo = `${new URL(req.url).origin}${SET_PASSWORD_PATH}`;

  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 500 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (existing && existing.last_sign_in_at) throw new HttpError(409, `${email} already has an account. They can sign in, or use “Forgot password”.`);
  // never signed in → remove the stale invite/unconfirmed account so a fresh invite can be sent
  if (existing) {
    const { error } = await svc.auth.admin.deleteUser(existing.id);
    if (error) throw error;
  }

  const { error } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo, data: { invited_by: me } });
  if (error) {
    if (/rate limit/i.test(error.message)) throw new HttpError(429, "Supabase's email limit was hit. Set up custom SMTP (e.g. Resend) in Supabase → Authentication → Emails, or wait an hour.");
    throw new HttpError(400, error.message);
  }
  if (admin) await svc.from("app_admins").upsert({ email, role: "admin", added_by: me }, { onConflict: "email", ignoreDuplicates: true });
  return NextResponse.json({ ok: true, message: existing ? `New invite sent to ${email}` : `Invite sent to ${email}` });
});
