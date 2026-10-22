"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen, Gauge, LogOut, Menu, Palette, PlusSquare, Search, TrendingUp, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/create", label: "Create Carousel", icon: PlusSquare },
  { href: "/keywords", label: "Keyword Research", icon: Search },
  { href: "/trending", label: "Trending Topics", icon: TrendingUp },
  { href: "/projects", label: "My Projects", icon: FolderOpen },
  { href: "/brand", label: "Brand Settings", icon: Palette },
];

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || (href !== "/dashboard" && path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
              active ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:translate-x-0.5 hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4 transition-transform duration-200", !active && "group-hover:scale-110")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-6 border-r bg-card p-4 transition-transform lg:static lg:w-auto lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between px-2 pt-1">
          <Link href="/dashboard" className="group flex items-center gap-2 font-display text-xl font-extrabold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-xs text-primary-foreground transition-transform duration-300 group-hover:rotate-6">ES</span>
            <span>Edit<span className="text-accent">Simple</span></span>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        {nav}
        <div className="space-y-2 border-t pt-4">
          <p className="truncate px-2 text-xs text-muted-foreground">{email}</p>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display font-extrabold">
            Edit<span className="text-accent">Simple</span>
          </span>
        </header>
        <main key={path} className="mx-auto max-w-7xl animate-fade-up px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-gradient text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
