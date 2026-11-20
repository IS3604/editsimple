import { Globe, UserX } from "lucide-react";
import { Card } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { EdsProvider } from "./provider";
import { WebsiteTabs } from "./tabs";

/** EditSimple Website section: only for people on the EditSimple team (RLS enforces it; this is just the screen). */
export const metadata = { title: "Website · EditSimple Studio" };

export default async function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const [{ data: auth }, { data, error }] = await Promise.all([sb.auth.getUser(), sb.rpc("eds_is_admin")]);
  const email = (auth.user?.email ?? "").toLowerCase();
  if (error || data !== true) {
    const missing = error && /eds_is_admin|does not exist|schema cache/i.test(error.message);
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <UserX className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-semibold tracking-[-0.02em]">You&apos;re not on the EditSimple team</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;re signed in as <b className="text-foreground">{email}</b>, but this email hasn&apos;t been added to the EditSimple Website team. Ask a team member
            to add it under <b className="text-foreground">Website → Team</b>, then refresh.
          </p>
          {error && (
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              {missing ? "The website module (supabase/migrations/0004_website_module.sql) is not installed in this Supabase project yet." : error.message}
            </p>
          )}
        </Card>
      </div>
    );
  }
  return (
    <EdsProvider me={email} supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}>
      <div className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        EditSimple Website · editsimple.in
      </div>
      <WebsiteTabs />
      {children}
    </EdsProvider>
  );
}
