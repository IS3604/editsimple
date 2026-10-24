import { describe, expect, it } from "vitest";
import { summariseVideos, viewsPerDay, type VideoStat } from "@/lib/research/youtube";
import { rankRows } from "@/lib/research";
import { keywordIdeasPrompt, viralScoringPrompt } from "@/lib/ai/prompts";
import { FONTS } from "@/lib/themes";
import { FONT_KEYS, type KeywordMetric } from "@/lib/types";

const NOW = Date.parse("2026-10-24T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();
const vid = (views: number, age: number, extra: Partial<VideoStat> = {}): VideoStat => ({ id: `v${views}`, title: `Video ${views}`, channel: "c", publishedAt: daysAgo(age), views, likes: views / 50, comments: views / 500, ...extra });

describe("YouTube views per day", () => {
  it("divides views by age in days (minimum one day)", () => {
    expect(viewsPerDay(vid(10000, 10), NOW)).toBe(1000);
    expect(viewsPerDay(vid(500, 0.2), NOW)).toBe(500);
  });

  it("reports the median of the 5 fastest videos, not of every result", () => {
    const vids = [vid(300000, 3), vid(200000, 4), vid(150000, 5), vid(90000, 6), vid(60000, 6), vid(500, 20), vid(300, 25), vid(100, 28)];
    const s = summariseVideos(vids, NOW);
    // fastest five: 100k, 50k, 30k, 15k, 10k per day → median 30k
    expect(s.median_views_per_day).toBe(30000);
    expect(s.top_video?.views_per_day).toBe(100000);
    expect(s.sample_size).toBe(8);
    expect(s.window_days).toBe(30);
  });

  it("handles no data", () => {
    expect(summariseVideos([], NOW).median_views_per_day).toBeNull();
  });
});

const row = (keyword: string, kind: KeywordMetric["kind"], vpdValue: number | null, score: number | null = null) =>
  ({
    keyword, kind, origin: "ai_suggested", related_topic: null, avg_monthly_searches: null, competition: null, competition_index: null, monthly_searches: null,
    interest_series: null, interest_source: null, trend_direction: null, news_mentions: null, ai_opportunity_score: score, ai_rationale: null, selected: false, fetched_at: "",
    youtube_stats: vpdValue == null ? null : { sample_size: 5, median_views: null, median_views_per_day: vpdValue, median_engagement_rate: null, latest_upload: null },
  }) as KeywordMetric;

describe("keyword ranking", () => {
  it("puts your topic first, then the highest YouTube views/day, and pre-selects the top 3", () => {
    const rows = rankRows([row("slow", "related", 50, 90), row("topic", "seed", 10), row("hot", "long_tail", 40000, 40), row("warm", "related", 3000), row("none", "related", null, 99), row("mid", "related", 900)]);
    expect(rows.map((r) => r.keyword)).toEqual(["topic", "hot", "warm", "mid", "slow", "none"]);
    expect(rows.filter((r) => r.selected).map((r) => r.keyword)).toEqual(["topic", "hot", "warm", "mid"]);
  });
});

describe("keyword prompts use proven YouTube demand", () => {
  it("includes the fastest videos' titles and tags", () => {
    const p = keywordIdeasPrompt({ topic: "knee pain", niche: "medical", market: "US", platform: "instagram", hotVideos: [{ title: "Why your knees hurt on stairs", tags: ["knee pain stairs"], views_per_day: 42000 }] });
    expect(p).toMatch(/Why your knees hurt on stairs — 42000\/day/);
    expect(p).toMatch(/proven demand/);
  });
  it("tells the scorer views/day is the strongest signal", () => {
    expect(viralScoringPrompt("t", "legal", "UK", "", [])).toMatch(/views per day is the strongest signal/);
  });
});

describe("carousel fonts", () => {
  it("every font key has metadata and a family", () => {
    for (const k of FONT_KEYS) expect(FONTS[k]?.family, k).toBeTruthy();
  });
  it("offers at least 14 visible fonts across sans, display and serif", () => {
    const visible = Object.values(FONTS).filter((f) => !f.hidden);
    expect(visible.length).toBeGreaterThanOrEqual(14);
    expect(new Set(visible.map((f) => f.kind))).toEqual(new Set(["Sans", "Display", "Serif"]));
  });
  it("single-weight display fonts are never faux-bolded", () => {
    expect(FONTS.bebas.fixedWeight).toBe(400);
    expect(FONTS.bebas.headingOnly).toBe(true);
    expect(FONTS.dmserif.fixedWeight).toBe(400);
  });
});
