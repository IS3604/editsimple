import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Handles the email-confirmation / magic-link redirect. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await supabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
