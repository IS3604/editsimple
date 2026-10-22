"use client";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Info, XCircle } from "lucide-react";
import type { KeywordMetric, SourceStatus } from "@/lib/types";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn, formatNumber } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  google_ads: "Google Ads Keyword Planner",
  ai_suggestions: "AI keyword suggestions",
  wikipedia_pageviews: "Wikipedia pageviews",
  youtube_data_api: "YouTube Data API",
  ai_opportunity_score: "AI opportunity scoring",
  wikipedia_most_read: "Wikipedia most-read",
  youtube_most_popular: "YouTube most popular",
};

const ORIGIN: Record<KeywordMetric["origin"], { label: string; tone: "real" | "ai" | "muted" }> = {
  google_ads: { label: "Google Ads", tone: "real" },
  wikipedia: { label: "Wikipedia", tone: "real" },
  youtube: { label: "YouTube", tone: "real" },
  ai_suggested: { label: "AI suggestion", tone: "ai" },
  user: { label: "Your input", tone: "muted" },
};

export function TrendIcon({ dir }: { dir: KeywordMetric["trend_direction"] }) {
  if (dir === "rising") return <span className="inline-flex items-center gap-1 text-emerald-700"><ArrowUpRight className="h-4 w-4" />Rising</span>;
  if (dir === "falling") return <span className="inline-flex items-center gap-1 text-rose-700"><ArrowDownRight className="h-4 w-4" />Falling</span>;
  if (dir === "stable") return <span className="inline-flex items-center gap-1 text-muted-foreground"><ArrowRight className="h-4 w-4" />Stable</span>;
  return <span className="text-muted-foreground">—</span>;
}

export function Sources({ sources }: { sources: SourceStatus[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((s) => (
        <span key={s.source} title={s.error ?? s.note ?? ""} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", s.ok ? "bg-card" : "bg-muted text-muted-foreground")}>
          {s.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
          {SOURCE_LABEL[s.source] ?? s.source}
          {!s.ok && s.error && <span className="max-w-[220px] truncate">· {s.error}</span>}
        </span>
      ))}
    </div>
  );
}

export function DataNotice() {
  return (
    <div className="flex gap-3 rounded-lg border bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <b className="text-foreground">Green = measured data</b> (Google Ads search volume & competition, Wikipedia daily pageviews as an interest proxy,
        YouTube engagement of recent videos). <b className="text-foreground">Violet = AI estimate</b> (suggested keywords, opportunity score).
        Instagram doesn&apos;t expose keyword search volume or hashtag reach through its official APIs, so none is shown — trend data above is a proxy.
      </p>
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
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {onToggle && <th className="w-10 p-3" />}
            <th className="p-3">Keyword</th>
            <th className="p-3">Avg monthly searches</th>
            <th className="p-3">Competition</th>
            <th className="p-3">Trend</th>
            <th className="p-3">YouTube (90d)</th>
            <th className="p-3"><span className="text-violet-700">AI opportunity</span></th>
            <th className="p-3">Source</th>
          </tr>
        </thead>
        <tbody className="stagger">
          {kw.map((r) => (
            <tr
              key={r.keyword}
              onClick={() => onFocus?.(r.keyword)}
              className={cn("cursor-pointer border-b last:border-0 hover:bg-secondary/40", focusedKeyword === r.keyword && "bg-secondary/60")}
            >
              {onToggle && (
                <td className="p-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--accent))]" checked={r.selected} onChange={() => onToggle(r.keyword)} aria-label={`Select ${r.keyword}`} />
                </td>
              )}
              <td className="p-3">
                <div className="font-medium">{r.keyword}</div>
                <div className="text-xs text-muted-foreground">{r.kind.replace("_", "-")}{r.related_topic ? ` · ${r.related_topic}` : ""}</div>
              </td>
              <td className="p-3 tabular-nums">{r.avg_monthly_searches != null ? formatNumber(r.avg_monthly_searches) : <span className="text-muted-foreground">n/a</span>}</td>
              <td className="p-3 capitalize">
                {r.competition ?? <span className="text-muted-foreground">n/a</span>}
                {r.competition_index != null && <span className="ml-1 text-xs text-muted-foreground">({r.competition_index}/100)</span>}
              </td>
              <td className="p-3"><TrendIcon dir={r.trend_direction} /></td>
              <td className="p-3 text-xs">
                {r.youtube_stats ? (
                  <>
                    <div>{formatNumber(r.youtube_stats.median_views)} median views</div>
                    <div className="text-muted-foreground">{r.youtube_stats.median_engagement_rate ?? "—"}% engagement · n={r.youtube_stats.sample_size}</div>
                  </>
                ) : (
                  <span className="text-muted-foreground">n/a</span>
                )}
              </td>
              <td className="p-3">
                {r.ai_opportunity_score != null ? (
                  <div title={r.ai_rationale ?? ""}>
                    <Badge tone="ai">{r.ai_opportunity_score}/100 est.</Badge>
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="p-3">
                <Badge tone={ORIGIN[r.origin].tone}>{ORIGIN[r.origin].label}</Badge>
              </td>
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
    if (row.monthly_searches?.length) return { data: row.monthly_searches.map((m) => ({ x: m.month, v: m.searches })), label: "Monthly searches (Google Ads)" };
    if (row.interest_series?.length) {
      const src = row.interest_source?.match(/wikipedia:([^+]+)/)?.[1]?.trim();
      return { data: row.interest_series.map((p) => ({ x: p.date, v: p.value })), label: `Daily Wikipedia pageviews${src ? ` — “${src}”` : ""} (interest proxy)` };
    }
    return null;
  }, [row]);

  if (!row) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{row.keyword}</CardTitle>
        <p className="text-xs text-muted-foreground">Fetched {new Date(row.fetched_at).toLocaleString()} · {row.interest_source ?? "no measured series"}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {series ? (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{series.label}</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <XAxis dataKey="x" tick={{ fontSize: 10 }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip formatter={(v: number) => formatNumber(v)} />
                  <Line type="monotone" dataKey="v" stroke="hsl(11 100% 61%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No historical series available for this keyword from the configured sources.</p>
        )}
        {row.ai_rationale && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
            <b>AI estimate · {row.ai_opportunity_score}/100.</b> {row.ai_rationale}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function HashtagPicker({ rows }: { rows: KeywordMetric[] }) {
  const tags = rows.filter((r) => r.kind === "hashtag");
  const [copied, setCopied] = useState(false);
  if (!tags.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hashtag ideas</CardTitle>
        <p className="text-xs text-violet-700">AI-suggested · no reach data (not exposed by Instagram/LinkedIn APIs)</p>
      </CardHeader>
      <CardContent>
        <div className="stagger flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t.keyword} tone="ai">{t.keyword}</Badge>
          ))}
        </div>
        <button
          className="mt-3 text-xs font-medium underline underline-offset-4"
          onClick={async () => {
            await navigator.clipboard.writeText(tags.map((t) => t.keyword).join(" "));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy all"}
        </button>
      </CardContent>
    </Card>
  );
}
