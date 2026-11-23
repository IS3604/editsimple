import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth-paths";

/**
 * Email links land here: sign-up confirmation (PKCE ?code= or ?token_hash=&type=).
 * On success → ?next (default /dashboard). On failure → /login with a clear message.
 * Invite and password-reset links go to /auth/set-password instead (they need a password form).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const toLogin = (q: string) => NextResponse.redirect(new URL(`/login?${q}`, url.origin));

  const linkError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (linkError) return toLogin(`error=${encodeURIComponent(linkError)}`);

  const sb = await supabaseServer();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    // Supabase has already confirmed the email before redirecting here; if the link was opened in a
    // different browser the session can't be created, so just ask them to sign in.
    if (error) return toLogin("confirmed=1");
  } else if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return toLogin(`error=${encodeURIComponent("This link has expired or was already used. Request a new one.")}`);
    if (type === "invite" || type === "recovery") return NextResponse.redirect(new URL("/auth/set-password", url.origin));
  } else {
    return toLogin("");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
