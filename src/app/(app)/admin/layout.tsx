import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Admin · EditSimple Studio" };

/** Only Studio admins get in; everyone else is sent to the admin sign-in. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("is_app_admin");
  if (error || data !== true) redirect("/admin/login");
  return children;
}
