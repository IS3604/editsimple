"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, PenLine, RefreshCw } from "lucide-react";
import { AiTag, Button, ErrorBanner, Skeleton } from "@/components/ui";
import { Sources } from "@/components/keywords";
import { api } from "@/lib/api-client";
import type { Niche } from "@/lib/niches";
import type { SourceStatus } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export type Trending = {
  niche: Niche;
  headlines: { title: string; link: string; source: string; published: string }[];
  ideas: { topic: string; hook: string; format: string; why_now: string; headlines: { title: string; link: string; source: string }[] }[];
  videos: { id: string; title: string; channel: string; views: number; likes: number; comments: number; publishedAt: string }[] | null;
  sources: SourceStatus[];
  region: string;
  fetched_at: string;
};

export function useTrending(niche: Niche) {
  const [data, setData] = useState<Trending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(
    (refresh = false) => {
      setError(null);
      setLoading(true);
      api<Trending>(`/api/trending?niche=${niche}${refresh ? "&refresh=1" : ""}`)
        .then((d) => setData(d))
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [niche]
  );
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  return { data, error, loading, reload: load };
}

export const ago = (iso: string) => {
  const h = Math.round((Date.now() - Date.parse(iso)) / 3600000);
  if (!iso || Number.isNaN(h)) return "";
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export const writeHref = (niche: Niche, topic: string, hook?: string) =>
  `/create?niche=${niche}&topic=${encodeURIComponent(topic)}${hook ? `&hook=${encodeURIComponent(hook)}` : ""}`;

/** AI post ideas built from this week's real headlines. */
export function IdeaCards({ niche, data, limit = 6 }: { niche: Niche; data: Trending | null; limit?: number }) {
  if (!data) return <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>;
  if (!data.ideas.length)
    return <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No post ideas right now — the news source didn&apos;t respond. Try refreshing in a minute.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.ideas.slice(0, limit).map((idea) => (
        <article key={idea.topic} className="group flex flex-col rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[0_14px_34px_-22px_rgb(15_18_30/.45)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{idea.format}</span>
            <AiTag>Idea</AiTag>
          </div>
          <h3 className="mt-3 text-[17px] leading-snug">{idea.topic}</h3>
          <p className="mt-1.5 font-display text-[19px] italic leading-snug text-accent">“{idea.hook}”</p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{idea.why_now}</p>
          {idea.headlines[0] && (
            <a href={idea.headlines[0].link} target="_blank" rel="noreferrer" className="mt-3 line-clamp-1 text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
              Source: {idea.headlines[0].source || "news"} — {idea.headlines[0].title}
            </a>
          )}
          <div className="mt-auto pt-4">
            <Link href={writeHref(niche, idea.topic, idea.hook)}>
              <Button size="sm" variant="soft"><PenLine className="h-3.5 w-3.5" />Write this carousel</Button>
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function HeadlineList({ data, limit = 12 }: { data: Trending | null; limit?: number }) {
  if (!data) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  if (!data.headlines.length) return <p className="text-sm text-muted-foreground">Headlines unavailable right now.</p>;
  return (
    <ul className="divide-y">
      {data.headlines.slice(0, limit).map((h) => (
        <li key={h.link} className="py-3">
          <a href={h.link} target="_blank" rel="noreferrer" className="group block">
            <p className="text-[14px] leading-snug group-hover:underline group-hover:decoration-border group-hover:underline-offset-4">{h.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {h.source}
              {h.published && <span className="ml-2">{ago(h.published)}</span>}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function VideoList({ data, limit = 8 }: { data: Trending | null; limit?: number }) {
  if (!data) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  if (!data.videos) return <p className="text-sm text-muted-foreground">Connect a YouTube Data API key to see this week&apos;s most-watched videos in your niche.</p>;
  return (
    <ul className="divide-y">
      {data.videos.slice(0, limit).map((v) => (
        <li key={v.id} className="flex items-start gap-3 py-3">
          <div className="min-w-0 flex-1">
            <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-[14px] leading-snug hover:underline hover:decoration-border hover:underline-offset-4">
              {v.title} <ExternalLink className="inline h-3 w-3 opacity-60" />
            </a>
            <p className="mt-1 text-xs text-muted-foreground">
              {v.channel}
              {v.views > 0 && <span className="ml-2">{(((v.likes + v.comments) / v.views) * 100).toFixed(1)}% engagement</span>}
            </p>
          </div>
          <span className="pt-0.5 text-sm font-medium tabular-nums">{formatNumber(v.views)}</span>
        </li>
      ))}
    </ul>
  );
}

export function TrendingFooter({ data, onRefresh, loading }: { data: Trending | null; onRefresh: () => void; loading: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {data ? <Sources sources={data.sources} /> : <span />}
      <Button size="sm" variant="ghost" onClick={onRefresh} loading={loading}>
        {!loading && <RefreshCw className="h-3.5 w-3.5" />}Refresh
      </Button>
    </div>
  );
}

export { ErrorBanner };
