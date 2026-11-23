import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  // Website section is only listed for the EditSimple Website team (the database enforces access with RLS).
  const [admin, studioAdmin] = await Promise.all([
    sb.rpc("eds_is_admin").then((r) => r.data === true, () => false),
    sb.rpc("is_app_admin").then((r) => r.data === true, () => false),
  ]);
  return (
    <AppShell email={data.user.email ?? ""} websiteAdmin={admin} studioAdmin={studioAdmin}>
      {children}
    </AppShell>
  );
}
