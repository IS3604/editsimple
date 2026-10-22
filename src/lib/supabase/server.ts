import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { HttpError } from "@/lib/http";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component — middleware refreshes the session */
        }
      },
    },
  });
}

/** Returns an RLS-scoped client plus the signed-in user, or throws 401. */
export async function requireUser() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Not signed in");
  return { sb, user: data.user };
}

export const BUCKET = "editsimple";
