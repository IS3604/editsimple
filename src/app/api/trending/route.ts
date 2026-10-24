import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { NICHES, nicheOf, type Niche } from "@/lib/niches";
import { nicheHeadlines, type NewsItem } from "@/lib/research/news";
import { nichePopularVideos, youtubeConfigured, type VideoStat } from "@/lib/research/youtube";
import { chatJSON } from "@/lib/ai/llm";
import { TrendIdeasSchema, systemFor, trendIdeasPrompt } from "@/lib/ai/prompts";
import type { SourceStatus } from "@/lib/types";
import { MARKETS, marketOf, type MarketCode } from "@/lib/markets";

export const maxDuration = 60;

type Idea = { topic: string; hook: string; format: string; why_now: string; headlines: { title: string; link: string; source: string }[] };
export type TrendingPayload = {
  niche: Niche;
  market: MarketCode;
  headlines: NewsItem[];
  ideas: Idea[];
  videos: VideoStat[] | null;
  sources: SourceStatus[];
  region: string;
  fetched_at: string;
};

const cache = new Map<string, { at: number; data: TrendingPayload }>();
const TTL = 60 * 60 * 1000;

/** Trending for doctors or lawyers: real headlines + real YouTube stats + AI post ideas built from them. */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const url = new URL(req.url);
  const niche = nicheOf(url.searchParams.get("niche"));
  const market = marketOf(url.searchParams.get("market"));
  const key = `${niche}:${market}`;
  const fresh = url.searchParams.get("refresh") === "1";
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  const n = NICHES[niche];
  const sources: SourceStatus[] = [];
  const t = () => new Date().toISOString();

  const [newsRes, ytRes] = await Promise.allSettled([
    nicheHeadlines(n.newsQueries, 30, market),
    youtubeConfigured() ? nichePopularVideos(n.youtubeQuery, 7, 12, MARKETS[market].yt) : Promise.resolve(null),
  ]);

  const headlines = newsRes.status === "fulfilled" ? newsRes.value : [];
  sources.push(newsRes.status === "fulfilled" ? { source: "google_news", ok: true, fetched_at: t() } : { source: "google_news", ok: false, error: String(newsRes.reason), fetched_at: t() });

  let videos: VideoStat[] | null = null;
  if (!youtubeConfigured()) sources.push({ source: "youtube_data_api", ok: false, error: "YOUTUBE_API_KEY not set", fetched_at: t() });
  else if (ytRes.status === "fulfilled") {
    videos = ytRes.value;
    sources.push({ source: "youtube_data_api", ok: true, fetched_at: t() });
  } else sources.push({ source: "youtube_data_api", ok: false, error: String(ytRes.reason), fetched_at: t() });

  let ideas: Idea[] = [];
  if (headlines.length) {
    try {
      const out = await chatJSON({
        system: systemFor(niche, market),
        user: trendIdeasPrompt(niche, market, headlines.slice(0, 25)),
        schema: TrendIdeasSchema,
        temperature: 0.6,
      });
      ideas = out.ideas.map((i) => ({
        topic: i.topic,
        hook: i.hook,
        format: i.format,
        why_now: i.why_now,
        headlines: i.headline_refs.filter((k) => headlines[k]).map((k) => ({ title: headlines[k].title, link: headlines[k].link, source: headlines[k].source })),
      }));
      sources.push({ source: "ai_post_ideas", ok: true, fetched_at: t() });
    } catch (e) {
      sources.push({ source: "ai_post_ideas", ok: false, error: (e as Error).message, fetched_at: t() });
    }
  }

  const data: TrendingPayload = { niche, market, headlines, ideas, videos, sources, region: MARKETS[market].label, fetched_at: t() };
  if (headlines.length || videos?.length) cache.set(key, { at: Date.now(), data });
  return NextResponse.json(data);
});
