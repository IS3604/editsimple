import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/http";
import { requireAdmin, supabaseService } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ action: z.enum(["make_admin", "remove_admin"]) });

async function target(id: string) {
  const svc = supabaseService();
  const { data, error } = await svc.auth.admin.getUserById(id);
  if (error || !data.user) throw new HttpError(404, "Account not found");
  const email = (data.user.email ?? "").toLowerCase();
  const { data: role } = await svc.from("app_admins").select("role").eq("email", email).maybeSingle();
  return { svc, email, role: (role?.role as "owner" | "admin" | undefined) ?? null };
}

/** Make someone an admin, or take admin away. The owner can't be changed here. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { email: me } = await requireAdmin();
  const { action } = Body.parse(await req.json());
  const { svc, email, role } = await target((await params).id);
  if (role === "owner") throw new HttpError(400, "The owner can't be changed.");
  if (action === "make_admin") {
    const { error } = await svc.from("app_admins").upsert({ email, role: "admin", added_by: me }, { onConflict: "email" });
    if (error) throw error;
    return NextResponse.json({ ok: true, message: `${email} is now an admin` });
  }
  if (email === me) throw new HttpError(400, "You can't remove your own admin access.");
  const { error } = await svc.from("app_admins").delete().eq("email", email);
  if (error) throw error;
  return NextResponse.json({ ok: true, message: `${email} is no longer an admin` });
});

/** Remove an account (and its posts, clients and files rows, via cascade). */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { email: me } = await requireAdmin();
  const { svc, email, role } = await target((await params).id);
  if (email === me) throw new HttpError(400, "You can't remove your own account here.");
  if (role === "owner") throw new HttpError(400, "The owner's account can't be removed.");
  await svc.from("app_admins").delete().eq("email", email);
  const { error } = await svc.auth.admin.deleteUser((await params).id);
  if (error) throw error;
  return NextResponse.json({ ok: true, message: `${email} was removed` });
});
