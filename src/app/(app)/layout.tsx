import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  return <AppShell email={data.user.email ?? ""}>{children}</AppShell>;
}
