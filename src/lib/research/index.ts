import "server-only";
import { chatJSON } from "@/lib/ai/llm";
import { KeywordIdeasSchema, ScoresSchema, keywordIdeasPrompt, systemFor, viralScoringPrompt } from "@/lib/ai/prompts";
import type { Niche } from "@/lib/niches";
import { MARKETS, type MarketCode } from "@/lib/markets";
import type { KeywordMetric, SourceStatus } from "@/lib/types";
import { slugHashtag } from "@/lib/utils";
import { adsConfigured, adsTrend, keywordIdeas } from "./googleAds";
import { newsMentions } from "./news";
import { pageviews, resolveArticle, trendDirection } from "./wikipedia";
import { discoverHotPhrases, keywordVideoStats, youtubeConfigured } from "./youtube";

export type ResearchInput = {
  topic: string;
  niche: Niche;
  market: MarketCode;
  specialty?: string;
  platform: string;
  audience?: string;
  userKeywords?: string[];
};
export type ResearchResult = { rows: KeywordMetric[]; sources: SourceStatus[] };

const MAX_KEYWORDS = 14;
const MAX_YOUTUBE = 7; // search.list = 100 quota units each (cached 12 h)
const MAX_NEWS = 12;
const now = () => new Date().toISOString();

const blank = (keyword: string, kind: KeywordMetric["kind"], origin: KeywordMetric["origin"]): KeywordMetric => ({
  keyword,
  related_topic: null,
  kind,
  origin,
  avg_monthly_searches: null,
  competition: null,
  competition_index: null,
  monthly_searches: null,
  interest_series: null,
  interest_source: null,
  trend_direction: null,
  news_mentions: null,
  youtube_stats: null,
  ai_opportunity_score: null,
  ai_rationale: null,
  selected: false,
  fetched_at: now(),
});

async function track<T>(sources: SourceStatus[], source: string, fn: () => Promise<T>, note?: string): Promise<T | null> {
  try {
    const v = await fn();
    sources.push({ source, ok: true, fetched_at: now(), note });
    return v;
  } catch (e) {
    sources.push({ source, ok: false, error: e instanceof Error ? e.message : String(e), fetched_at: now() });
    return null;
  }
}

const vpd = (r: KeywordMetric) => r.youtube_stats?.median_views_per_day ?? -1;

/**
 * Your topic and your own keywords first; then the phrases pulling the most YouTube views per day,
 * then viral potential. Pre-selects the top 3 by views/day (falling back to viral score).
 */
export function rankRows(rows: KeywordMetric[]) {
  const pri = (r: KeywordMetric) => (r.kind === "seed" ? 2 : r.kind === "user" ? 1 : 0);
  rows.sort((a, b) => pri(b) - pri(a) || vpd(b) - vpd(a) || (b.ai_opportunity_score ?? -1) - (a.ai_opportunity_score ?? -1));
  let picked = 0;
  rows.forEach((r) => {
    r.selected = false;
    if (r.kind === "seed" || r.kind === "user") r.selected = true;
    else if (picked < 3) {
      r.selected = true;
      picked++;
    }
  });
  return rows;
}

export async function runResearch(input: ResearchInput): Promise<ResearchResult> {
  const sources: SourceStatus[] = [];
  const byKey = new Map<string, KeywordMetric>();
  const wikiHint = new Map<string, string>();
  const add = (row: KeywordMetric) => {
    const k = row.keyword.toLowerCase().trim();
    if (!k) return;
    const prev = byKey.get(k);
    if (!prev) byKey.set(k, row);
    else if (row.origin === "google_ads" && prev.origin !== "google_ads") byKey.set(k, { ...row, kind: prev.kind, related_topic: prev.related_topic });
  };

  add(blank(input.topic, "seed", "user"));
  (input.userKeywords ?? []).forEach((k) => add(blank(k, "user", "user")));

  // Google Ads Keyword Planner — real volumes (optional)
  if (adsConfigured()) {
    const ideas = await track(sources, "google_ads", () => keywordIdeas([input.topic, ...(input.userKeywords ?? [])]));
    ideas
      ?.filter((i) => i.avg_monthly_searches != null)
      .slice(0, 8)
      .forEach((i) =>
        add({
          ...blank(i.keyword, "related", "google_ads"),
          avg_monthly_searches: i.avg_monthly_searches,
          competition: i.competition,
          competition_index: i.competition_index,
          monthly_searches: i.monthly_searches,
          trend_direction: adsTrend(i.monthly_searches),
          interest_source: "google_ads:keyword_planner",
        })
      );
  } else {
    sources.push({ source: "google_ads", ok: false, error: "Not connected — search volume unavailable", fetched_at: now() });
  }

  // What's pulling views on YouTube right now for this topic (real) — keyword ideas start from proven demand
  const hot = youtubeConfigured()
    ? await discoverHotPhrases(`${input.topic}`, MARKETS[input.market].yt).catch(() => [] as Awaited<ReturnType<typeof discoverHotPhrases>>)
    : [];

  // AI search-phrase ideas (labelled)
  const ideas = await track(sources, "ai_suggestions", () =>
    chatJSON({
      system: systemFor(input.niche, input.market),
      user: keywordIdeasPrompt({ topic: input.topic, niche: input.niche, market: input.market, specialty: input.specialty, platform: input.platform, audience: input.audience, hotVideos: hot }),
      schema: KeywordIdeasSchema,
      temperature: 0.5,
    })
  );
  ideas?.keywords.forEach((k) => {
    if (k.wikipedia_title) wikiHint.set(k.keyword.toLowerCase(), k.wikipedia_title);
    add({ ...blank(k.keyword, k.kind, "ai_suggested"), related_topic: k.related_topic || null });
  });

  const rows = [...byKey.values()].slice(0, MAX_KEYWORDS);

  // Real signals, fetched in parallel
  await Promise.all([
    track(
      sources,
      "google_news",
      async () => {
        const targets = rows.slice(0, MAX_NEWS);
        const res = await Promise.allSettled(targets.map((r) => newsMentions(r.keyword, input.market)));
        res.forEach((x, i) => {
          if (x.status === "fulfilled") targets[i].news_mentions = x.value;
        });
        if (res.every((x) => x.status === "rejected")) throw (res[0] as PromiseRejectedResult).reason;
      },
      `Articles mentioning the phrase in the last 7 days (Google News, ${MARKETS[input.market].label})`
    ),
    track(
      sources,
      "wikipedia_pageviews",
      async () => {
        await Promise.all(
          rows.map(async (r) => {
            let title = wikiHint.get(r.keyword.toLowerCase()) ?? null;
            if (!title && (r.kind === "seed" || r.kind === "user")) title = await resolveArticle(r.keyword);
            if (!title) return;
            const series = await pageviews(title);
            if (!series) return;
            r.interest_series = series;
            r.interest_source = r.interest_source ? `${r.interest_source} + wikipedia:${title}` : `wikipedia:${title}`;
            if (!r.trend_direction) r.trend_direction = trendDirection(series);
          })
        );
      },
      "Daily article pageviews — a proxy for public interest"
    ),
    youtubeConfigured()
      ? track(
          sources,
          "youtube_data_api",
          async () => {
            const targets = rows.slice(0, MAX_YOUTUBE);
            const res = await Promise.allSettled(targets.map((r) => keywordVideoStats(r.keyword, MARKETS[input.market].yt)));
            res.forEach((x, i) => {
              if (x.status === "fulfilled" && x.value.sample_size > 0) targets[i].youtube_stats = x.value;
            });
            if (res.every((x) => x.status === "rejected")) throw (res[0] as PromiseRejectedResult).reason;
          },
          "Views per day of the 5 fastest-growing videos for the phrase in the last 30 days, plus engagement"
        )
      : Promise.resolve(sources.push({ source: "youtube_data_api", ok: false, error: "YOUTUBE_API_KEY not set", fetched_at: now() })),
  ]);

  // Hashtags — AI suggested, no reach data exists via official APIs
  const tags = new Set<string>();
  ideas?.hashtags.forEach((h) => tags.add(h.startsWith("#") ? h : `#${h}`));
  rows.slice(0, 5).forEach((r) => tags.add(slugHashtag(r.keyword)));
  const hashtagRows = [...tags].filter((t) => t.length > 2).slice(0, 15).map((t) => blank(t, "hashtag", "ai_suggested"));

  // Viral potential — AI estimate grounded on the measured signals above
  const scores = await track(sources, "ai_viral_score", () =>
    chatJSON({
      system: systemFor(input.niche, input.market),
      user: viralScoringPrompt(input.topic, input.niche, input.market, input.audience ?? "", rows),
      schema: ScoresSchema,
      temperature: 0.2,
    })
  );
  scores?.scores.forEach((s) => {
    const r = rows.find((x) => x.keyword.toLowerCase() === s.keyword.toLowerCase());
    if (r) {
      r.ai_opportunity_score = s.score;
      r.ai_rationale = s.rationale;
    }
  });

  rankRows(rows);

  return { rows: [...rows, ...hashtagRows], sources };
}
