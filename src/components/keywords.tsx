"use client";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Copy, Info, X } from "lucide-react";
import type { KeywordMetric, SourceStatus } from "@/lib/types";
import { AiTag, Card } from "@/components/ui";
import { cn, formatNumber } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  google_ads: "Google Ads volumes",
  google_news: "Google News",
  ai_suggestions: "AI keyword ideas",
  wikipedia_pageviews: "Wikipedia interest",
  youtube_data_api: "YouTube",
  ai_viral_score: "AI viral estimate",
  ai_opportunity_score: "AI viral estimate",
  ai_post_ideas: "AI post ideas",
  wikipedia_most_read: "Wikipedia",
  youtube_most_popular: "YouTube",
};

export function TrendIcon({ dir }: { dir: KeywordMetric["trend_direction"] }) {
  if (dir === "rising") return <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowUpRight className="h-4 w-4" />Rising</span>;
  if (dir === "falling") return <span className="inline-flex items-center gap-1 text-rose-700"><ArrowDownRight className="h-4 w-4" />Falling</span>;
  if (dir === "stable") return <span className="inline-flex items-center gap-1 text-muted-foreground"><ArrowRight className="h-4 w-4" />Steady</span>;
  return <span className="text-muted-foreground/60">—</span>;
}

export function Sources({ sources }: { sources: SourceStatus[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((s) => (
        <span
          key={s.source}
          title={s.error ?? s.note ?? ""}
          className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]", s.ok ? "bg-card text-foreground/80" : "bg-transparent text-muted-foreground")}
        >
          {s.ok ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3 text-muted-foreground" />}
          {SOURCE_LABEL[s.source] ?? s.source}
        </span>
      ))}
    </div>
  );
}

export function DataNotice() {
  return (
    <div className="flex gap-3 rounded-xl bg-card p-3.5 text-xs leading-relaxed text-muted-foreground ring-1 ring-border">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="real-tag mr-1">Measured</span> news mentions, YouTube views per day and engagement, Wikipedia interest trend, and search volume when Google Ads is
        connected. <span className="ai-tag mx-1">Estimate</span> viral potential is AI-judged from those signals plus how much the phrase makes people save and share.
        Instagram doesn&apos;t expose search or hashtag reach, so nothing here claims it.
      </p>
    </div>
  );
}

function ViralMeter({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground/60">—</span>;
  const tone = score >= 75 ? "bg-accent" : score >= 50 ? "bg-accent/70" : "bg-foreground/25";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-7 text-[13px] font-semibold tabular-nums">{score}</span>
    </div>
  );
}

export function KeywordTable({
  rows,
  onToggle,
  onFocus,
  focusedKeyword,
}: {
  rows: KeywordMetric[];
  onToggle?: (keyword: string) => void;
  onFocus?: (keyword: string) => void;
  focusedKeyword?: string | null;
}) {
  const kw = rows.filter((r) => r.kind !== "hashtag");
  const hasAds = kw.some((r) => r.avg_monthly_searches != null);
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            {onToggle && <th className="w-10 py-3 pl-4" />}
            <th className="py-3 pl-3 font-medium">Keyword</th>
            <th className="py-3 font-medium">
              <span className="inline-flex items-center gap-1.5">Viral potential <AiTag>estimate</AiTag></span>
            </th>
            <th className="py-3 font-medium">News, 7 days</th>
            <th className="py-3 font-medium">YouTube views/day</th>
            <th className="py-3 font-medium">Interest</th>
            {hasAds && <th className="py-3 pr-4 font-medium">Searches/mo</th>}
          </tr>
        </thead>
        <tbody>
          {kw.map((r) => (
            <tr
              key={r.keyword}
              onClick={() => onFocus?.(r.keyword)}
              className={cn("cursor-pointer border-b transition-colors last:border-0 hover:bg-secondary/50", focusedKeyword === r.keyword && "bg-[hsl(var(--accent-soft))]")}
            >
              {onToggle && (
                <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="h-4 w-4 rounded accent-[hsl(var(--accent))]" checked={r.selected} onChange={() => onToggle(r.keyword)} aria-label={`Use “${r.keyword}”`} />
                </td>
              )}
              <td className="py-3 pl-3 pr-4">
                <div className="font-medium">{r.keyword}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {r.kind === "seed" ? "Your topic" : r.kind === "user" ? "Your keyword" : r.origin === "google_ads" ? "From Google Ads" : r.kind === "long_tail" ? "Question people ask" : "Related phrase"}
                </div>
              </td>
              <td className="py-3 pr-4"><ViralMeter score={r.ai_opportunity_score} /></td>
              <td className="py-3 pr-4 tabular-nums">{r.news_mentions != null ? (r.news_mentions >= 100 ? "100+" : r.news_mentions) : <span className="text-muted-foreground/60">—</span>}</td>
              <td className="py-3 pr-4 tabular-nums">
                {r.youtube_stats?.median_views_per_day != null ? (
                  <span title={`${r.youtube_stats.median_engagement_rate ?? "—"}% engagement, ${r.youtube_stats.sample_size} videos`}>{formatNumber(r.youtube_stats.median_views_per_day)}</span>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </td>
              <td className="py-3 pr-4"><TrendIcon dir={r.trend_direction} /></td>
              {hasAds && <td className="py-3 pr-4 tabular-nums">{r.avg_monthly_searches != null ? formatNumber(r.avg_monthly_searches) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeywordDetail({ row }: { row: KeywordMetric | null }) {
  const series = useMemo(() => {
    if (!row) return null;
    if (row.monthly_searches?.length) return { data: row.monthly_searches.map((m) => ({ x: m.month, v: m.searches })), label: "Monthly searches, Google Ads" };
    if (row.interest_series?.length) {
      const src = row.interest_source?.match(/wikipedia:([^+]+)/)?.[1]?.trim();
      return { data: row.interest_series.map((p) => ({ x: p.date, v: p.value })), label: `Daily Wikipedia views${src ? ` of “${src}”` : ""}, as an interest proxy` };
    }
    return null;
  }, [row]);

  if (!row) return null;
  return (
    <Card className="p-5">
      <h3 className="text-[15px]">{row.keyword}</h3>
      {row.ai_rationale && (
        <div className="mt-3 rounded-xl bg-violet-50/70 p-3 text-[13px] leading-relaxed text-violet-950 ring-1 ring-violet-100">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-semibold">Viral potential {row.ai_opportunity_score}/100</span>
            <AiTag>estimate</AiTag>
          </div>
          {row.ai_rationale}
        </div>
      )}
      {series ? (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">{series.label}</p>
          <div className="h-40 text-accent">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.data} margin={{ left: 0, right: 6, top: 4, bottom: 0 }}>
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: "#7a8090" }} minTickGap={40} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#7a8090" }} width={40} tickFormatter={(v) => formatNumber(v)} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatNumber(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e3e5eb", fontSize: 12 }} />
                <Line type="monotone" dataKey="v" stroke="currentColor" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[13px] text-muted-foreground">No interest history available for this phrase.</p>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Fetched {new Date(row.fetched_at).toLocaleString()}</p>
    </Card>
  );
}

export function HashtagPicker({ rows }: { rows: KeywordMetric[] }) {
  const tags = rows.filter((r) => r.kind === "hashtag");
  const [copied, setCopied] = useState(false);
  if (!tags.length) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px]">Hashtags</h3>
        <AiTag />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t.keyword} className="rounded-full bg-secondary px-2.5 py-1 text-xs">{t.keyword}</span>
        ))}
      </div>
      <button
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent"
        onClick={async () => {
          await navigator.clipboard.writeText(tags.map((t) => t.keyword).join(" "));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy className="h-3 w-3" />
        {copied ? "Copied" : "Copy all"}
      </button>
    </Card>
  );
}
