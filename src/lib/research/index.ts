import "server-only";
import { chatJSON } from "@/lib/ai/llm";
import { KeywordIdeasSchema, ScoresSchema, SYSTEM_STRATEGIST, keywordIdeasPrompt, scoringPrompt } from "@/lib/ai/prompts";
import type { KeywordMetric, SourceStatus } from "@/lib/types";
import { slugHashtag } from "@/lib/utils";
import { adsConfigured, adsTrend, keywordIdeas } from "./googleAds";
import { pageviews, resolveArticle, trendDirection } from "./wikipedia";
import { keywordVideoStats, youtubeConfigured } from "./youtube";

export type ResearchInput = { topic: string; niche?: string; platform: string; audience?: string; userKeywords?: string[] };
export type ResearchResult = { rows: KeywordMetric[]; sources: SourceStatus[] };

const MAX_KEYWORDS = 14;
const MAX_YOUTUBE = 6; // search.list costs 100 quota units each
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

  // 1) Seeds (real user input)
  add({ ...blank(input.topic, "seed", "user") });
  (input.userKeywords ?? []).forEach((k) => add(blank(k, "user", "user")));

  // 2) Google Ads Keyword Planner (real volumes) — only when configured
  if (adsConfigured()) {
    const ideas = await track(sources, "google_ads", () =>
      keywordIdeas([input.topic, ...(input.userKeywords ?? [])])
    );
    ideas
      ?.filter((i) => i.avg_monthly_searches != null)
      .slice(0, 10)
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
    // seed metrics, if Ads returned the seed itself
    ideas?.forEach((i) => {
      const k = i.keyword.toLowerCase();
      const existing = byKey.get(k);
      if (existing && existing.origin !== "google_ads") {
        Object.assign(existing, {
          avg_monthly_searches: i.avg_monthly_searches,
          competition: i.competition,
          competition_index: i.competition_index,
          monthly_searches: i.monthly_searches,
          trend_direction: adsTrend(i.monthly_searches),
          interest_source: "google_ads:keyword_planner",
        });
      }
    });
  } else {
    sources.push({ source: "google_ads", ok: false, error: "Not configured — no search-volume data", fetched_at: now() });
  }

  // 3) AI suggestions — clearly labelled, never carry numbers
  const ideas = await track(sources, "ai_suggestions", () =>
    chatJSON({
      system: SYSTEM_STRATEGIST,
      user: keywordIdeasPrompt({ topic: input.topic, niche: input.niche ?? "", platform: input.platform, audience: input.audience }),
      schema: KeywordIdeasSchema,
      temperature: 0.5,
    })
  );
  ideas?.keywords.forEach((k) => {
    if (k.wikipedia_title) wikiHint.set(k.keyword.toLowerCase(), k.wikipedia_title);
    add({ ...blank(k.keyword, k.kind, "ai_suggested"), related_topic: k.related_topic || null });
  });

  let rows = [...byKey.values()].slice(0, MAX_KEYWORDS);

  // 4) Wikipedia pageviews as interest-over-time proxy (real)
  await track(
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
          if (!r.interest_source) r.interest_source = `wikipedia:${title}`;
          else r.interest_source += ` + wikipedia:${title}`;
          if (!r.trend_direction) r.trend_direction = trendDirection(series);
        })
      );
    },
    "Daily article pageviews — a proxy for public interest, not search volume"
  );

  // 5) YouTube engagement for the top keywords (real)
  if (youtubeConfigured()) {
    await track(sources, "youtube_data_api", async () => {
      const targets = rows.filter((r) => r.kind !== "hashtag").slice(0, MAX_YOUTUBE);
      const results = await Promise.allSettled(targets.map((r) => keywordVideoStats(r.keyword)));
      results.forEach((res, i) => {
        if (res.status === "fulfilled" && res.value.sample_size > 0) targets[i].youtube_stats = res.value;
      });
      if (results.every((r) => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;
    }, "Median views/engagement of relevant videos from the last 90 days");
  } else {
    sources.push({ source: "youtube_data_api", ok: false, error: "YOUTUBE_API_KEY not set", fetched_at: now() });
  }

  // 6) Hashtags (AI-suggested + derived from keywords) — no metrics
  const tags = new Set<string>();
  ideas?.hashtags.forEach((h) => tags.add(h.startsWith("#") ? h : `#${h}`));
  rows.slice(0, 6).forEach((r) => tags.add(slugHashtag(r.keyword)));
  const hashtagRows = [...tags].filter((t) => t.length > 2).slice(0, 15).map((t) => blank(t, "hashtag", "ai_suggested"));

  // 7) AI opportunity score (estimate, labelled)
  const scores = await track(sources, "ai_opportunity_score", () =>
    chatJSON({ system: SYSTEM_STRATEGIST, user: scoringPrompt(input.topic, input.audience ?? "", rows), schema: ScoresSchema, temperature: 0.2 })
  );
  scores?.scores.forEach((s) => {
    const r = rows.find((x) => x.keyword.toLowerCase() === s.keyword.toLowerCase());
    if (r) {
      r.ai_opportunity_score = s.score;
      r.ai_rationale = s.rationale;
    }
  });

  rows = rows.sort((a, b) => {
    const pri = (r: KeywordMetric) => (r.kind === "seed" ? 2 : r.kind === "user" ? 1 : 0);
    return pri(b) - pri(a) || (b.ai_opportunity_score ?? -1) - (a.ai_opportunity_score ?? -1);
  });
  // pre-select seed, user keywords and the top 3 suggestions
  let picked = 0;
  rows.forEach((r) => {
    if (r.kind === "seed" || r.kind === "user") r.selected = true;
    else if (picked < 3) {
      r.selected = true;
      picked++;
    }
  });

  return { rows: [...rows, ...hashtagRows], sources };
}
