import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { mostRead, type WikiTrending } from "@/lib/research/wikipedia";
import { trendingVideos, youtubeConfigured } from "@/lib/research/youtube";
import type { SourceStatus } from "@/lib/types";
import { env } from "@/lib/env";

type Payload = {
  wikipedia: WikiTrending[];
  youtube: Awaited<ReturnType<typeof trendingVideos>> | null;
  sources: SourceStatus[];
  region: string;
};

let cache: { at: number; data: Payload } | null = null;
const TTL = 60 * 60 * 1000;

export const GET = handle(async () => {
  await requireUser();
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.data);

  const sources: SourceStatus[] = [];
  const t = () => new Date().toISOString();
  let wikipedia: WikiTrending[] = [];
  try {
    wikipedia = await mostRead();
    sources.push({ source: "wikipedia_most_read", ok: true, fetched_at: t() });
  } catch (e) {
    sources.push({ source: "wikipedia_most_read", ok: false, error: String(e), fetched_at: t() });
  }
  let youtube: Payload["youtube"] = null;
  if (youtubeConfigured()) {
    try {
      youtube = await trendingVideos();
      sources.push({ source: "youtube_most_popular", ok: true, fetched_at: t() });
    } catch (e) {
      sources.push({ source: "youtube_most_popular", ok: false, error: String(e), fetched_at: t() });
    }
  } else sources.push({ source: "youtube_most_popular", ok: false, error: "YOUTUBE_API_KEY not set", fetched_at: t() });

  const data: Payload = { wikipedia, youtube, sources, region: env.region };
  if (sources.some((s) => s.ok)) cache = { at: Date.now(), data };
  return NextResponse.json(data);
});
