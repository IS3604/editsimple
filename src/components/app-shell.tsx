"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen, Globe2, Home, LogOut, Menu, Newspaper, Plus, Search, Stethoscope, Scale, Users, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useMarket, useNiche } from "@/lib/use-niche";
import { MARKETS, MARKET_CODES, type MarketCode } from "@/lib/markets";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/trending", label: "Trending", icon: Newspaper },
  { href: "/keywords", label: "Keyword research", icon: Search },
  { href: "/projects", label: "Posts", icon: FolderOpen },
  { href: "/clients", label: "Clients", icon: Users },
];

/** EditSimple wordmark: a bracket-cut mark + tight Geist type. */
export function Wordmark({ invert = false }: { invert?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect width="22" height="22" rx="6" fill={invert ? "#fff" : "hsl(var(--foreground))"} />
        <path d="M7 6.5h8M7 11h6M7 15.5h8" stroke={invert ? "#151823" : "#fff"} strokeWidth="2" strokeLinecap="round" />
        <circle cx="16.5" cy="11" r="1.6" fill="hsl(var(--accent))" />
      </svg>
      <span className={cn("text-[17px] font-semibold tracking-[-0.03em]", invert ? "text-white" : "text-foreground")}>EditSimple</span>
    </span>
  );
}

export function MarketSelect({ className }: { className?: string }) {
  const [market, setMarket] = useMarket();
  return (
    <label className={cn("flex items-center gap-2 rounded-xl bg-secondary px-2.5 py-1.5 text-[13px] text-muted-foreground", className)}>
      <Globe2 className="h-3.5 w-3.5 shrink-0" />
      <span className="sr-only">Audience market</span>
      <select value={market} onChange={(e) => setMarket(e.target.value as MarketCode)} className="min-w-0 flex-1 cursor-pointer bg-transparent font-medium text-foreground outline-none">
        {MARKET_CODES.map((c) => (
          <option key={c} value={c}>{MARKETS[c].label}</option>
        ))}
      </select>
    </label>
  );
}

export function NicheSwitch({ className }: { className?: string }) {
  const [niche, setNiche] = useNiche();
  return (
    <div className={cn("grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1", className)} role="radiogroup" aria-label="Workspace">
      {(
        [
          ["medical", "Doctors", Stethoscope],
          ["legal", "Lawyers", Scale],
        ] as const
      ).map(([v, label, Icon]) => (
        <button
          key={v}
          role="radio"
          aria-checked={niche === v}
          onClick={() => setNiche(v)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[13px] font-medium transition-all",
            niche === v ? "bg-card text-accent shadow-[0_1px_3px_rgb(15_18_30/.12)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [niche] = useNiche();
  const editor = path.startsWith("/projects/");

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div data-niche={niche} className="min-h-screen lg:grid lg:grid-cols-[236px_1fr]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r bg-card px-3 pb-4 pt-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-2.5">
          <Link href="/dashboard" className="flex items-baseline gap-1.5" onClick={() => setOpen(false)}>
            <Wordmark />
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2 px-1">
          <NicheSwitch />
          <MarketSelect />
        </div>

        <Link
          href="/create"
          onClick={() => setOpen(false)}
          className="mx-1 mt-4 flex h-10 items-center justify-center gap-2 rounded-[10px] bg-accent text-sm font-medium text-accent-foreground shadow-[0_1px_0_rgb(255_255_255/.18)_inset,0_8px_18px_-10px_hsl(var(--accent))] transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New post
        </Link>

        <nav className="mt-5 flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== "/dashboard" && path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
                  active ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-[17px] w-[17px]", active && "text-accent")} strokeWidth={1.8} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t px-1 pt-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-xs font-semibold uppercase text-foreground/80">{email.slice(0, 1)}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{email}</span>
            <button onClick={signOut} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Wordmark />
        </header>
        <main key={path} className={cn("mx-auto animate-fade-in px-4 py-6 lg:px-10 lg:py-9", editor ? "max-w-[1480px]" : "max-w-[1200px]")}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] leading-[1.1] sm:text-[38px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
