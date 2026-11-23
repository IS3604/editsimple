import "server-only";
import { createClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";

/**
 * Service-role client for admin actions (invites, listing and removing accounts).
 * Server-only: the key bypasses RLS, so it is only used after requireAdmin() passes.
 */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new HttpError(500, "SUPABASE_SERVICE_ROLE_KEY is not set in Vercel. Add it (server-only, never NEXT_PUBLIC_) and redeploy.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Signed-in user who is a Studio admin, or 401/403. */
export async function requireAdmin() {
  const { sb, user } = await requireUser();
  const { data, error } = await sb.rpc("is_app_admin");
  if (error) throw new HttpError(500, /is_app_admin|does not exist|schema cache/i.test(error.message) ? "Admin setup missing: run supabase/migrations/0005_app_admins.sql." : error.message);
  if (data !== true) throw new HttpError(403, "Admins only");
  return { sb, user, email: (user.email ?? "").toLowerCase() };
}
