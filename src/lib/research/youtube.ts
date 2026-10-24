import "server-only";
import { env } from "@/lib/env";
import { fetchT } from "@/lib/http";
import { median } from "@/lib/utils";

/**
 * YouTube Data API v3 (Google Cloud API key). Real, public statistics.
 * Quota: search.list = 100 units, videos.list = 1 unit (10,000 units/day default).
 * A keyword research run uses ~1 discovery search + up to 7 keyword searches ≈ 810 units.
 * Results are cached in memory for 12 h to save quota.
 */
const BASE = "https://www.googleapis.com/youtube/v3";
const DAY = 86400000;

export const youtubeConfigured = () => !!env.youtubeKey;

export type VideoStat = { id: string; title: string; channel: string; publishedAt: string; views: number; likes: number; comments: number; tags?: string[] };

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>, ttl = 12 * 3600_000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Views per day since upload (min 1 day). */
export const viewsPerDay = (v: Pick<VideoStat, "views" | "publishedAt">, now = Date.now()) =>
  v.views / Math.max(1, (now - Date.parse(v.publishedAt)) / DAY);

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
    tags: (v.snippet?.tags ?? []).slice(0, 15),
  }));
}

async function search(q: string, opts: { days: number; max: number; regionCode: string; order: "viewCount" | "relevance" }) {
  const u = new URL(`${BASE}/search`);
  u.search = new URLSearchParams({
    part: "id",
    q,
    type: "video",
    maxResults: String(opts.max),
    order: opts.order,
    publishedAfter: new Date(Date.now() - opts.days * DAY).toISOString(),
    regionCode: opts.regionCode,
    relevanceLanguage: env.language,
    key: env.youtubeKey,
  }).toString();
  const r = await fetchT(u.toString(), { timeoutMs: 10000 });
  if (!r.ok) throw new Error(`YouTube search.list ${r.status}`);
  const j = await r.json();
  return (j.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean) as string[];
}

/**
 * Summarises how much attention a phrase gets on YouTube.
 * "Top views/day" = median views per day of the 5 fastest videos from the last 30 days — the demand ceiling
 * a strong post on this topic can reach. A plain median of all results understates hot topics.
 */
export function summariseVideos(videos: VideoStat[], now = Date.now()) {
  const withViews = videos.filter((v) => v.views > 0 && v.publishedAt);
  const ranked = withViews.map((v) => ({ v, vpd: viewsPerDay(v, now) })).sort((a, b) => b.vpd - a.vpd);
  const top = ranked.slice(0, 5);
  const er = median(withViews.map((s) => (s.likes + s.comments) / s.views));
  return {
    sample_size: withViews.length,
    median_views: median(withViews.map((s) => s.views)),
    median_views_per_day: top.length ? Math.round(median(top.map((t) => t.vpd))!) : null,
    median_engagement_rate: er == null ? null : Math.round(er * 10000) / 100,
    latest_upload: withViews.map((s) => s.publishedAt).sort().at(-1) ?? null,
    top_video: ranked[0] ? { id: ranked[0].v.id, title: ranked[0].v.title, views_per_day: Math.round(ranked[0].vpd) } : null,
    window_days: 30,
  };
}

/** Attention for a keyword: most-viewed videos from the last 30 days in the client's market. */
export async function keywordVideoStats(keyword: string, regionCode: string = env.region) {
  return cached(`kw:${regionCode}:${keyword.toLowerCase()}`, async () => {
    const ids = await search(keyword, { days: 30, max: 15, regionCode, order: "viewCount" });
    return summariseVideos(await videoStats(ids));
  });
}

/**
 * Finds what's actually pulling views right now for a topic: the fastest-growing videos of the last 30 days,
 * with their titles and tags. Feeds keyword ideas so suggestions start from proven demand.
 */
export async function discoverHotPhrases(topic: string, regionCode: string = env.region) {
  return cached(`disc:${regionCode}:${topic.toLowerCase()}`, async () => {
    const ids = await search(topic, { days: 30, max: 25, regionCode, order: "viewCount" });
    const vids = await videoStats(ids);
    return vids
      .filter((v) => v.views > 0)
      .map((v) => ({ title: v.title, tags: v.tags ?? [], views_per_day: Math.round(viewsPerDay(v)) }))
      .sort((a, b) => b.views_per_day - a.views_per_day)
      .slice(0, 12);
  });
}

/** YouTube "most popular" chart for the configured region. */
export async function trendingVideos(max = 20): Promise<VideoStat[]> {
  const u = new URL(`${BASE}/videos`);
  u.search = new URLSearchParams({ part: "snippet,statistics", chart: "mostPopular", regionCode: env.region, maxResults: String(max), key: env.youtubeKey }).toString();
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
  return cached(`niche:${regionCode}:${query}:${days}`, async () => {
    const ids = await search(query, { days, max, regionCode, order: "viewCount" });
    return (await videoStats(ids)).sort((a, b) => b.views - a.views);
  }, 3600_000);
}
