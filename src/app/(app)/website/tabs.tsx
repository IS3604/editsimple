"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { leadStatus } from "@/lib/eds";
import { cn } from "@/lib/utils";
import { useEds } from "./provider";

const TABS = [
  { href: "/website", label: "Overview" },
  { href: "/website/leads", label: "Leads", count: "leads" as const },
  { href: "/website/posts", label: "Blog posts", count: "posts" as const },
  { href: "/website/settings", label: "Settings" },
  { href: "/website/team", label: "Team" },
];

/** Section tabs: the main way around on phones, and a quick switcher on desktop. */
export function WebsiteTabs() {
  const path = usePathname();
  const { leads, posts } = useEds();
  const counts = {
    leads: leads.data.filter((l) => leadStatus(l) === "new").length,
    posts: posts.data.filter((p) => p.status === "draft").length,
  };
  return (
    <nav aria-label="EditSimple Website" className="-mx-4 mb-7 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <div className="inline-flex min-w-full gap-1 border-b lg:min-w-0">
        {TABS.map((t) => {
          const active = t.href === "/website" ? path === "/website" : path.startsWith(t.href);
          const n = t.count ? counts[t.count] : 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                active ? "border-accent font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {n > 0 && <span className="num rounded-md bg-accent px-1.5 text-[10px] font-semibold leading-[18px] text-accent-foreground">{n > 99 ? "99+" : n}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
