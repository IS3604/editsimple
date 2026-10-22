"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Empty, Spinner } from "@/components/ui";
import { ProjectCard, type ProjectListItem } from "@/components/project-card";
import { TrendingLists } from "@/components/trending-lists";
import { TrendIcon } from "@/components/keywords";
import { api } from "@/lib/api-client";
import type { KeywordMetric } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type Config = { text: string | null; images: string | null; googleAds: boolean; youtube: boolean; wikipedia: boolean; region: string };

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [recs, setRecs] = useState<{ topic: string; rows: KeywordMetric[] } | null>(null);
  const [researchCount, setResearchCount] = useState(0);

  useEffect(() => {
    api<{ projects: ProjectListItem[] }>("/api/projects").then((r) => setProjects(r.projects)).catch(() => setProjects([]));
    api<Config>("/api/config").then(setCfg).catch(() => undefined);
    api<{ runs: { id: string; topic: string }[] }>("/api/keywords")
      .then(async ({ runs }) => {
        setResearchCount(runs.length);
        if (!runs[0]) return;
        const r = await api<{ rows: KeywordMetric[] }>(`/api/keywords?id=${runs[0].id}`);
        setRecs({
          topic: runs[0].topic,
          rows: r.rows.filter((k) => k.kind !== "hashtag" && k.ai_opportunity_score != null).sort((a, b) => (b.ai_opportunity_score ?? 0) - (a.ai_opportunity_score ?? 0)).slice(0, 6),
        });
      })
      .catch(() => undefined);
  }, []);

  const ready = projects?.filter((p) => p.status === "ready").length ?? 0;
  const inProgress = projects?.filter((p) => p.status !== "ready").length ?? 0;

  const sources: [string, boolean, string][] = cfg
    ? [
        ["Text AI", !!cfg.text, cfg.text ?? "GROQ_API_KEY / OPENAI_API_KEY"],
        ["Image AI", !!cfg.images, cfg.images ?? "IMAGE_PROVIDER + OPENAI_API_KEY"],
        ["Google Ads volumes", cfg.googleAds, cfg.googleAds ? "Keyword Planner" : "optional — adds search volume"],
        ["YouTube Data API", cfg.youtube, cfg.youtube ? `region ${cfg.region}` : "YOUTUBE_API_KEY"],
        ["Wikipedia pageviews", cfg.wikipedia, "no key needed"],
      ]
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="What's moving, what you're making."
        actions={<Link href="/create"><Button variant="accent" size="lg"><Plus className="h-4 w-4" />New carousel</Button></Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Carousels ready", projects ? ready : null],
          ["In progress / drafts", projects ? inProgress : null],
          ["Keyword research runs", researchCount],
          ["Data sources live", cfg ? sources.filter((s) => s[1]).length + "/" + sources.length : null],
        ].map(([label, v]) => (
          <Card key={label as string} className="p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-4xl font-bold tabular-nums">{v ?? "—"}</p>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent projects</h2>
          <Link href="/projects" className="text-sm underline underline-offset-4">All projects</Link>
        </div>
        {projects === null ? (
          <div className="grid h-40 place-items-center"><Spinner /></div>
        ) : projects.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{projects.slice(0, 5).map((p) => <ProjectCard key={p.id} p={p} />)}</div>
        ) : (
          <Empty title="Your first carousel is one topic away" action={<Link href="/create"><Button className="mt-3">Start</Button></Link>} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Trending now</h2>
          <TrendingLists limit={8} compact />
        </section>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recommended keywords</CardTitle>
              {recs && <p className="text-xs text-muted-foreground">From your latest research: “{recs.topic}”</p>}
            </CardHeader>
            <CardContent>
              {recs?.rows.length ? (
                <ul className="space-y-2">
                  {recs.rows.map((r) => (
                    <li key={r.keyword} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate font-medium">{r.keyword}</span>
                      {r.avg_monthly_searches != null && <span className="text-xs tabular-nums text-muted-foreground">{formatNumber(r.avg_monthly_searches)}/mo</span>}
                      <span className="text-xs"><TrendIcon dir={r.trend_direction} /></span>
                      <Badge tone="ai">{r.ai_opportunity_score}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Run <Link href="/keywords" className="underline">keyword research</Link> to get recommendations.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Data & AI sources</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sources.map(([name, ok, note]) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-500" />}
                  <span className="flex-1">{name}</span>
                  <span className="max-w-[150px] truncate text-xs text-muted-foreground" title={note}>{note}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
