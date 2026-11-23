"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/app-shell";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Separate sign-in for Studio admins. Non-admins are signed straight back out. */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // already signed in as an admin → straight to the admin area
  useEffect(() => {
    const sb = supabaseBrowser();
    void sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: ok } = await sb.rpc("is_app_admin");
      if (ok === true) router.replace("/admin");
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = supabaseBrowser();
    const { error: signErr } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (signErr) {
      setBusy(false);
      return setError(/invalid login credentials/i.test(signErr.message) ? "Wrong email or password." : signErr.message);
    }
    const { data: ok, error: rpcErr } = await sb.rpc("is_app_admin");
    if (rpcErr || ok !== true) {
      await sb.auth.signOut();
      setBusy(false);
      return setError(rpcErr ? "Admin setup is missing: run supabase/migrations/0005_app_admins.sql in Supabase." : "This account isn't an admin. Use the normal sign-in instead.");
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#121521] px-6 py-8 text-white sm:px-12">
      <Wordmark invert />
      <div className="mx-auto w-full max-w-sm flex-1 py-16">
        <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><ShieldCheck className="h-5 w-5" /></span>
        <h1 className="text-[32px] leading-tight">Admin sign-in</h1>
        <p className="mt-3 text-[15px] text-white/60">Invite people to the studio and manage accounts.</p>
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl bg-white p-5 text-foreground">
          <Field label="Admin email">
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </Field>
          <Field label="Password">
            <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          </Field>
          <ErrorBanner error={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in as admin</Button>
        </form>
        <p className="mt-6 text-sm text-white/60">
          Not an admin? <Link href="/login" className="text-white underline underline-offset-4">Normal sign-in</Link>
        </p>
      </div>
    </main>
  );
}
