"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { Wordmark } from "@/components/app-shell";
import { ScaledSlide, SlideCanvas, type CanvasSlide } from "@/components/slide-canvas";
import { defaultDesign } from "@/lib/themes";
import type { Design } from "@/lib/types";

const SHOWCASE: { t: Design["template"]; slide: CanvasSlide; name: string; rot: number; x: number; y: number; delay: number }[] = [
  {
    t: "clinic",
    name: "Dr. Ananya Rao",
    rot: -7,
    x: -150,
    y: 30,
    delay: 0,
    slide: { id: "s1", kind: "hook", role: "hook", kicker: "Heart health", heading: "Chest pain after 40 is not always gas", body: "", layout: "center", style: {}, background_path: null },
  },
  {
    t: "counsel",
    name: "Adv. Karan Mehta",
    rot: 5,
    x: 150,
    y: 50,
    delay: 120,
    slide: {
      id: "s2",
      kind: "steps",
      role: "x",
      kicker: "Your rights",
      heading: "If your landlord keeps the deposit",
      body: "",
      items: [
        { title: "Send a written demand", text: "Email and registered post." },
        { title: "Keep proof of handover", text: "Photos and meter reading." },
        { title: "Approach the consumer forum", text: "" },
      ],
      layout: "top",
      style: {},
      background_path: null,
    },
  },
  {
    t: "studio",
    name: "Dr. Meera Iyer",
    rot: -1,
    x: 0,
    y: 0,
    delay: 240,
    slide: {
      id: "s3",
      kind: "myth_fact",
      role: "x",
      kicker: "Common belief",
      heading: "Sunscreen is only for sunny days",
      body: "",
      items: [
        { title: "Myth", text: "Cloudy days don't need sunscreen." },
        { title: "Fact", text: "Most UV rays pass through clouds — apply it daily if you're outdoors." },
      ],
      layout: "top",
      style: {},
      background_path: null,
    },
  },
];

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
    if (mode === "signup" && !res.data.session) return setInfo("Check your inbox and confirm your email, then sign in here.");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <Wordmark />
        <div className="mx-auto w-full max-w-sm py-12">
          <h1 className="text-[36px] leading-[1.08]">{mode === "signin" ? "Sign in to the studio" : "Create your account"}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            The content studio for EditSimple’s doctor and law-firm clients — research, write, design and deliver posts in one place.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email">
              <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "At least 6 characters." : undefined}>
              <Input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </Field>
            <ErrorBanner error={error} />
            {info && <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200">{info}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            {mode === "signin" ? "New to EditSimple?" : "Already have an account?"}{" "}
            <button className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Posts follow medical and legal advertising norms for each client’s market.</p>
      </section>

      <section className="relative hidden overflow-hidden bg-[#121521] lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(15,124,114,.35),transparent_70%),radial-gradient(50%_45%_at_20%_90%,rgba(140,47,60,.35),transparent_70%)]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative h-[520px] w-[360px]">
            {SHOWCASE.map((s) => (
              <div
                key={s.t}
                className="absolute left-0 top-0 animate-[deal_.9s_cubic-bezier(.2,.8,.2,1)_both] overflow-hidden rounded-2xl shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)]"
                style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)`, animationDelay: `${s.delay}ms` }}
              >
                <ScaledSlide width={330} size="1080x1350">
                  <SlideCanvas slide={s.slide} design={{ ...defaultDesign(s.t), name: s.name }} size="1080x1350" index={s.slide.kind === "hook" ? 0 : 2} total={7} bgUrl={null} logoUrl={null} />
                </ScaledSlide>
              </div>
            ))}
          </div>
        </div>
        <p className="absolute bottom-10 left-12 right-12 max-w-md text-[24px] font-semibold leading-snug tracking-[-0.03em] text-white/90">
          From this week’s headline to a client-ready post.
        </p>
      </section>
      <style>{`@keyframes deal{from{opacity:0;transform:translate(0,80px) rotate(0deg) scale(.92)}}`}</style>
    </main>
  );
}
