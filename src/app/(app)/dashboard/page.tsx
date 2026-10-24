"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { ProjectCard, type ProjectListItem } from "@/components/project-card";
import { HeadlineList, IdeaCards, TrendingFooter, useTrending } from "@/components/trending-lists";
import { api } from "@/lib/api-client";
import { useNiche } from "@/lib/use-niche";

type Config = { text: string | null; images: string | null; googleAds: boolean; youtube: boolean };

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  const [niche] = useNiche();
  const { data, loading, reload } = useTrending(niche);
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    api<{ projects: ProjectListItem[] }>("/api/projects").then((r) => setProjects(r.projects)).catch(() => setProjects([]));
    api<Config>("/api/config").then(setCfg).catch(() => undefined);
  }, []);

  const missing = cfg ? [!cfg.text && "a text AI key (GROQ_API_KEY)", !cfg.images && "an image key (OPENAI_API_KEY)", !cfg.youtube && "a YouTube key"].filter(Boolean) : [];

  return (
    <div>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[15px] text-muted-foreground">{greeting()}</p>
          <h1 className="mt-1 max-w-2xl text-[44px] leading-[1.04] sm:text-[54px]">{niche === "legal" ? "What should people know about the law this week?" : "What should your patients learn this week?"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/create">
            <Button size="lg" variant="accent"><PenLine className="h-4 w-4" />New carousel</Button>
          </Link>
        </div>
      </header>

      {missing.length > 0 && (
        <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
          Add {missing.join(", ")} in your Vercel environment variables to switch on every feature.
        </p>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-lg">Ideas from this week&apos;s news</h2>
            <Link href="/trending" className="text-[13px] text-muted-foreground hover:text-foreground">See all trending</Link>
          </div>
          <IdeaCards niche={niche} data={data} limit={4} />
          <div className="mt-4">
            <TrendingFooter data={data} loading={loading} onRefresh={() => reload(true)} />
          </div>
        </section>

        <aside className="space-y-8">
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px]">Continue</h2>
              <Link href="/projects" className="text-[13px] text-muted-foreground hover:text-foreground">All projects</Link>
            </div>
            {projects === null ? (
              <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
            ) : projects.length ? (
              <div className="grid grid-cols-2 gap-3">{projects.slice(0, 4).map((p) => <ProjectCard key={p.id} p={p} compact />)}</div>
            ) : (
              <div className="rounded-2xl border border-dashed p-5 text-[13px] text-muted-foreground">
                Your carousels will appear here. Pick an idea on the left or start from your own topic.
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-1 text-[15px]">Headlines in your field</h2>
            <p className="text-xs text-muted-foreground">Google News, last 7 days</p>
            <HeadlineList data={data} limit={6} />
          </section>
        </aside>
      </div>
    </div>
  );
}
