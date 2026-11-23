import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { requireAdmin, supabaseService } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  invited_at: string | null;
  confirmed: boolean;
  last_sign_in: string | null;
  role: "owner" | "admin" | null;
  status: "active" | "invited" | "unconfirmed";
};

/** Every account in this Studio, with invite / admin status. */
export const GET = handle(async () => {
  const { email: me } = await requireAdmin();
  const svc = supabaseService();
  const [{ data: list, error }, { data: admins }] = await Promise.all([
    svc.auth.admin.listUsers({ page: 1, perPage: 500 }),
    svc.from("app_admins").select("email,role"),
  ]);
  if (error) throw error;
  const roles = new Map((admins ?? []).map((a) => [a.email as string, a.role as "owner" | "admin"]));
  const users: AdminUser[] = list.users
    .map((u) => {
      const email = (u.email ?? "").toLowerCase();
      const confirmed = !!(u.email_confirmed_at || u.confirmed_at);
      return {
        id: u.id,
        email,
        created_at: u.created_at,
        invited_at: u.invited_at ?? null,
        confirmed,
        last_sign_in: u.last_sign_in_at ?? null,
        role: roles.get(email) ?? null,
        status: (u.last_sign_in_at && confirmed ? "active" : u.invited_at ? "invited" : "unconfirmed") as AdminUser["status"],
      };
    })
    .sort((a, b) => (b.role ? 1 : 0) - (a.role ? 1 : 0) || b.created_at.localeCompare(a.created_at));
  // admins listed by email but without an account yet
  const known = new Set(users.map((u) => u.email));
  const pendingAdmins = [...roles.entries()].filter(([e]) => !known.has(e)).map(([e, role]) => ({ email: e, role }));
  return NextResponse.json({ me, users, pendingAdmins });
});
