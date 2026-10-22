"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, Card, ErrorBanner, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const sb = supabaseBrowser();
    const res =
      mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setBusy(false);
    if (res.error) return setError(res.error.message);
    if (mode === "signup" && !res.data.session) return setInfo("Check your inbox to confirm your email, then sign in.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="grain grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <p className="font-display text-3xl font-extrabold">
            Edit<span className="text-accent">Simple</span>
          </p>
          <p className="text-sm text-muted-foreground">Research-backed carousels for Instagram & LinkedIn</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "At least 6 characters" : undefined}>
              <Input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <ErrorBanner error={error} />
            {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{info}</p>}
            <Button type="submit" className="w-full" loading={busy}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Have an account?"}{" "}
          <button className="font-medium text-foreground underline underline-offset-4" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </main>
  );
}
