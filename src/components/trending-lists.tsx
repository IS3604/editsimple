"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, ErrorBanner, Spinner } from "@/components/ui";
import { Sources } from "@/components/keywords";
import { api } from "@/lib/api-client";
import type { SourceStatus } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type Trending = {
  wikipedia: { title: string; views: number; rank: number; extract?: string; date: string }[];
  youtube: { id: string; title: string; channel: string; views: number; likes: number; comments: number; publishedAt: string }[] | null;
  sources: SourceStatus[];
  region: string;
};

export function useTrending() {
  const [data, setData] = useState<Trending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => { setError(null); api<Trending>("/api/trending").then(setData).catch((e) => setError(e.message)); };
  useEffect(load, []);
  return { data, error, reload: load };
}

export function TrendingLists({ limit = 25, compact = false }: { limit?: number; compact?: boolean }) {
  const { data, error, reload } = useTrending();
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!data) return <div className="grid h-40 place-items-center"><Spinner /></div>;

  const topicHref = (t: string) => `/keywords?topic=${encodeURIComponent(t)}`;

  return (
    <div className="space-y-4">
      {!compact && <Sources sources={data.sources} />}
      <div className={compact ? "grid gap-4 md:grid-cols-2" : "grid gap-6 lg:grid-cols-2"}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most-read on Wikipedia</CardTitle>
            <p className="text-xs text-muted-foreground">Wikimedia API · {data.wikipedia[0]?.date ?? "yesterday"} · real daily views</p>
          </CardHeader>
          <CardContent>
            {data.wikipedia.length ? (
              <ol className="divide-y">
                {data.wikipedia.slice(0, limit).map((a) => (
                  <li key={a.title} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-6 text-right tabular-nums text-muted-foreground">{a.rank}</span>
                    <Link href={topicHref(a.title)} className="flex-1 font-medium hover:underline">{a.title}</Link>
                    <span className="tabular-nums text-muted-foreground">{formatNumber(a.views)}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted-foreground">Unavailable right now.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trending on YouTube · {data.region}</CardTitle>
            <p className="text-xs text-muted-foreground">YouTube Data API “mostPopular” chart · real view counts</p>
          </CardHeader>
          <CardContent>
            {data.youtube ? (
              <ol className="divide-y">
                {data.youtube.slice(0, limit).map((v, i) => (
                  <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-6 text-right tabular-nums text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" className="line-clamp-1 font-medium hover:underline">
                        {v.title} <ExternalLink className="inline h-3 w-3" />
                      </a>
                      <p className="text-xs text-muted-foreground">{v.channel} · {v.views ? `${(((v.likes + v.comments) / v.views) * 100).toFixed(1)}% engagement` : ""}</p>
                    </div>
                    <span className="tabular-nums text-muted-foreground">{formatNumber(v.views)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">Add a YOUTUBE_API_KEY to show YouTube&apos;s trending chart for your region.</p>
            )}
          </CardContent>
        </Card>
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Google Trends&apos; official API is an application-only alpha and the Custom Search JSON API is closed to new customers, so these two
          public, documented sources stand in for “what&apos;s trending”. Click a topic to research it.
        </p>
      )}
    </div>
  );
}
