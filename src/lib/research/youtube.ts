import "server-only";
import { env } from "@/lib/env";
import { fetchT } from "@/lib/http";
import { median } from "@/lib/utils";

/**
 * YouTube Data API v3 (Google Cloud API key). Real, public statistics.
 * Quota: search.list = 100 units, videos.list = 1 unit (10,000 units/day default),
 * so keyword stats are limited to a handful of keywords per research run.
 */
const BASE = "https://www.googleapis.com/youtube/v3";

export const youtubeConfigured = () => !!env.youtubeKey;

export type VideoStat = { id: string; title: string; channel: string; publishedAt: string; views: number; likes: number; comments: number };

async function videoStats(ids: string[]): Promise<VideoStat[]> {
  if (!ids.length) return [];
  const u = new URL(`${BASE}/videos`);
  u.search = new URLSearchParams({ part: "snippet,statistics", id: ids.join(","), key: env.youtubeKey }).toString();
  const r = await fetchT(u.toString(), { timeoutMs: 10000 });
  if (!r.ok) throw new Error(`YouTube videos.list ${r.status}`);
  const j = await r.json();
  return (j.items ?? []).map((v: any) => ({
    id: v.id,
    title: v.snippet?.title ?? "",
    channel: v.snippet?.channelTitle ?? "",
    publishedAt: v.snippet?.publishedAt ?? "",
    views: Number(v.statistics?.viewCount ?? 0),
    likes: Number(v.statistics?.likeCount ?? 0),
    comments: Number(v.statistics?.commentCount ?? 0),
  }));
}

/** Engagement of recent (≤90 days) relevant videos for a keyword. */
export async function keywordVideoStats(keyword: string, regionCode: string = env.region) {
  const u = new URL(`${BASE}/search`);
  u.search = new URLSearchParams({
    part: "id",
    q: keyword,
    type: "video",
    maxResults: "15",
    order: "relevance",
    publishedAfter: new Date(Date.now() - 90 * 86400000).toISOString(),
    regionCode,
    relevanceLanguage: env.language,
    key: env.youtubeKey,
  }).toString();
  const r = await fetchT(u.toString(), { timeoutMs: 10000 });
  if (!r.ok) throw new Error(`YouTube search.list ${r.status}`);
  const j = await r.json();
  const ids: string[] = (j.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean);
  const stats = await videoStats(ids);
  const withViews = stats.filter((s) => s.views > 0);
  return {
    sample_size: withViews.length,
    median_views: median(withViews.map((s) => s.views)),
    // views per day since upload — a real velocity signal (how fast this topic gathers attention)
    median_views_per_day: (() => {
      const m = median(withViews.map((s) => s.views / Math.max(1, (Date.now() - Date.parse(s.publishedAt)) / 86400000)));
      return m == null ? null : Math.round(m);
    })(),
    median_engagement_rate: (() => {
      const m = median(withViews.map((s) => (s.likes + s.comments) / s.views));
      return m == null ? null : Math.round(m * 10000) / 100; // percent, 2dp
    })(),
    latest_upload: stats.map((s) => s.publishedAt).sort().at(-1) ?? null,
  };
}

/** YouTube "most popular" chart for the configured region. */
export async function trendingVideos(max = 20): Promise<VideoStat[]> {
  const u = new URL(`${BASE}/videos`);
  u.search = new URLSearchParams({
    part: "snippet,statistics",
    chart: "mostPopular",
    regionCode: env.region,
    maxResults: String(max),
    key: env.youtubeKey,
  }).toString();
  const r = await fetchT(u.toString(), { timeoutMs: 10000 });
  if (!r.ok) throw new Error(`YouTube mostPopular ${r.status}`);
  const j = await r.json();
  return (j.items ?? []).map((v: any) => ({
    id: v.id,
    title: v.snippet?.title ?? "",
    channel: v.snippet?.channelTitle ?? "",
    publishedAt: v.snippet?.publishedAt ?? "",
    views: Number(v.statistics?.viewCount ?? 0),
    likes: Number(v.statistics?.likeCount ?? 0),
    comments: Number(v.statistics?.commentCount ?? 0),
  }));
}

/** Most-viewed videos in a niche from the last N days (real stats). Costs 101 quota units. */
export async function nichePopularVideos(query: string, days = 7, max = 12, regionCode: string = env.region): Promise<VideoStat[]> {
  const u = new URL(`${BASE}/search`);
  u.search = new URLSearchParams({
    part: "id",
    q: query,
    type: "video",
    maxResults: String(max),
    order: "viewCount",
    publishedAfter: new Date(Date.now() - days * 86400000).toISOString(),
    regionCode,
    relevanceLanguage: env.language,
    key: env.youtubeKey,
  }).toString();
  const r = await fetchT(u.toString(), { timeoutMs: 10000 });
  if (!r.ok) throw new Error(`YouTube search.list ${r.status}`);
  const j = await r.json();
  const ids: string[] = (j.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean);
  return (await videoStats(ids)).sort((a, b) => b.views - a.views);
}
