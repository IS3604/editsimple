"use client";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Wordmark } from "@/components/app-shell";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Invite and password-reset links land here. Handles every link style Supabase sends
 * (#access_token, ?code=, ?token_hash=&type=), signs the person in, then asks for a new password.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const hash = new URLSearchParams(location.hash.slice(1));
      const q = new URLSearchParams(location.search);
      const linkErr = hash.get("error_description") || q.get("error_description");
      try {
        if (linkErr) throw new Error(linkErr);
        if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await sb.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
          if (error) throw error;
          setInvited(hash.get("type") === "invite");
        } else if (q.get("token_hash") && q.get("type")) {
          const { error } = await sb.auth.verifyOtp({ token_hash: q.get("token_hash")!, type: q.get("type") as EmailOtpType });
          if (error) throw error;
          setInvited(q.get("type") === "invite");
        } else if (q.get("code")) {
          // the browser client exchanges ?code= itself on start-up; wait for it
          const { data } = await sb.auth.getSession();
          if (!data.session) throw new Error("Open the link in the same browser you requested it from, or request a new one.");
        }
        history.replaceState(null, "", location.pathname); // drop tokens from the address bar
        const { data } = await sb.auth.getUser();
        if (!data.user) throw new Error("This link has expired or was already used.");
        setEmail(data.user.email ?? "");
        if (data.user.user_metadata?.invited_by) setInvited(true);
        setState("ready");
      } catch (e) {
        setError((e as Error).message);
        setState("invalid");
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
      <Wordmark />
      <div className="mx-auto w-full max-w-sm flex-1 py-16">
        {state === "checking" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking your link…</p>
        )}
        {state === "invalid" && (
          <>
            <h1 className="text-[30px] leading-tight">Link not valid</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error ?? "This link has expired or was already used."}</p>
            <p className="mt-2 text-sm text-muted-foreground">Ask your admin for a new invite, or use “Forgot password” on the sign-in page.</p>
            <Button className="mt-6" variant="outline" onClick={() => router.replace("/login")}>Go to sign in</Button>
          </>
        )}
        {state === "ready" && (
          <>
            <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary"><KeyRound className="h-5 w-5" /></span>
            <h1 className="text-[30px] leading-tight">{invited ? "Welcome to EditSimple Studio" : "Set a new password"}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {invited ? "Choose a password to finish setting up your account" : "Choose a new password for"} <b className="text-foreground">{email}</b>.
            </p>
            <form onSubmit={save} className="mt-8 space-y-4">
              <Field label="New password" hint="At least 8 characters.">
                <Input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-11" />
              </Field>
              <Field label="Repeat password">
                <Input type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="h-11" />
              </Field>
              <ErrorBanner error={error} />
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                {invited ? "Create my account" : "Save password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
