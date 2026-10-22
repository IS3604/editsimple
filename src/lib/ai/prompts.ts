import "server-only";
import { z } from "zod";
import type { KeywordMetric } from "@/lib/types";

// ---------- schemas for model output ----------
export const KeywordIdeasSchema = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z.string().min(2).max(80),
        related_topic: z.string().max(80).default(""),
        kind: z.enum(["related", "long_tail"]).default("related"),
        wikipedia_title: z.string().max(120).optional(),
      })
    )
    .min(3)
    .max(20),
  hashtags: z.array(z.string().max(40)).max(20).default([]),
});

export const ScoresSchema = z.object({
  scores: z.array(z.object({ keyword: z.string(), score: z.number().int().min(0).max(100), rationale: z.string().max(240) })),
});

export const SlideCopySchema = z.object({
  role: z.string().max(40),
  kicker: z.string().max(40).default(""),
  heading: z.string().min(2).max(90),
  body: z.string().max(260).default(""),
  visual_prompt: z.string().max(400),
  layout: z.enum(["top", "center", "bottom", "split"]).default("top"),
});

export const ContentSchema = z.object({
  strategy: z.object({
    angle: z.string().max(300),
    audience_insight: z.string().max(300),
    narrative: z.array(z.string().max(80)).min(3).max(10),
    visual_direction: z.string().max(300),
  }),
  slides: z.array(SlideCopySchema).min(5).max(8),
});

export const CaptionSchema = z.object({ body: z.string().min(20).max(2200), hashtags: z.array(z.string().max(40)).max(15) });

// ---------- prompts ----------
export const SYSTEM_STRATEGIST =
  "You are a senior social media strategist and copywriter for EditSimple. You write concise, factual, " +
  "genuinely useful carousel content. Never invent statistics, studies, or quotes; if a number is needed, " +
  "phrase it qualitatively instead. Use keywords naturally, never stuffed.";

export function keywordIdeasPrompt(p: { topic: string; niche: string; platform: string; audience?: string }) {
  return `Topic: ${p.topic}
Niche: ${p.niche || "general"}
Platform: ${p.platform}
Audience: ${p.audience || "general"}

Suggest up to 12 search keywords people would actually use around this topic (mix of short "related" terms and 3–6 word "long_tail" phrases),
and up to 12 relevant hashtags (without spaces). For each keyword, if an English Wikipedia article clearly matches its core concept,
give its exact title in "wikipedia_title" (else omit). Do NOT include any numbers, volumes or popularity claims.
JSON shape: {"keywords":[{"keyword","related_topic","kind","wikipedia_title"}],"hashtags":[...]}`;
}

export function scoringPrompt(topic: string, audience: string, rows: KeywordMetric[]) {
  const data = rows.map((r) => ({
    keyword: r.keyword,
    origin: r.origin,
    avg_monthly_searches: r.avg_monthly_searches,
    competition: r.competition,
    trend_direction: r.trend_direction,
    youtube_median_views: r.youtube_stats?.median_views ?? null,
    youtube_median_engagement_rate: r.youtube_stats?.median_engagement_rate ?? null,
  }));
  return `Topic: ${topic}\nAudience: ${audience || "general"}\nMeasured data (null = not available):\n${JSON.stringify(data)}

For each keyword, give an opportunity score 0–100 for using it in a carousel for this audience, weighing relevance, trend momentum,
audience fit and (if present) demand vs competition. When data is null, rely on relevance only and say so in the rationale.
Rationale ≤ 200 chars. JSON: {"scores":[{"keyword","score","rationale"}]}`;
}

export function contentPrompt(p: {
  topic: string;
  industry: string;
  audience: string;
  objective: string;
  tone: string;
  language: string;
  platform: string;
  slideCount: number;
  keywords: string[];
  theme: string;
  referenceNote?: string;
}) {
  return `Create a ${p.slideCount}-slide carousel.
Topic: ${p.topic}
Industry/niche: ${p.industry || "general"}
Audience: ${p.audience || "general"}
Objective: ${p.objective}
Platform: ${p.platform}
Tone: ${p.tone}. Language: ${p.language}.
Keywords to weave in naturally: ${p.keywords.join(", ") || "none"}
Visual theme: ${p.theme}
${p.referenceNote ? `Reference context: ${p.referenceNote}` : ""}

Structure guidance (adapt to the topic, don't force it): hook → problem/opportunity → insights → practical example/action → takeaway → CTA.
Rules per slide: heading ≤ 9 words and punchy; body ≤ 35 words (hook and CTA slides may have shorter body); kicker ≤ 3 words (e.g. "Step 2", "The fix").
Slide 1 must stop the scroll. Last slide = clear CTA matching the objective "${p.objective}".
visual_prompt: describe a text-free background or illustration consistent across all slides (same style, palette, lighting) — specific subject, composition and where empty space sits for text.
layout: "top" (text top, image bottom), "bottom", "center" (text over full image), or "split".
Return exactly ${p.slideCount} slides.
JSON: {"strategy":{"angle","audience_insight","narrative":[...],"visual_direction"},"slides":[{"role","kicker","heading","body","visual_prompt","layout"}]}`;
}

export function regenerateSlidePrompt(p: {
  topic: string;
  audience: string;
  tone: string;
  language: string;
  keywords: string[];
  position: number;
  total: number;
  role: string;
  neighbours: string;
  instruction?: string;
}) {
  return `Rewrite slide ${p.position + 1} of ${p.total} (role: ${p.role}) for a carousel on "${p.topic}" for ${p.audience || "a general audience"}.
Tone: ${p.tone}. Language: ${p.language}. Keywords (use naturally if they fit): ${p.keywords.join(", ") || "none"}.
Other slides for context (keep consistent, avoid repeating): ${p.neighbours}
${p.instruction ? `User instruction: ${p.instruction}` : "Make it sharper and more specific than before."}
Heading ≤ 9 words, body ≤ 35 words, kicker ≤ 3 words.
JSON: {"role","kicker","heading","body","visual_prompt","layout"}`;
}

export function captionPrompt(p: {
  platform: "instagram" | "linkedin";
  topic: string;
  audience: string;
  objective: string;
  tone: string;
  language: string;
  slides: { heading: string; body: string }[];
  keywords: string[];
  hashtagIdeas: string[];
}) {
  const spec =
    p.platform === "instagram"
      ? "Instagram: engaging first line (hook), concise (≤ 120 words), line breaks for readability, a relevant CTA (save/share/comment/DM matching the objective). 8–12 hashtags mixing broad and niche."
      : "LinkedIn: professional hook line, informative body (≤ 180 words) with a clear key takeaway, business-appropriate CTA. 3–5 hashtags.";
  return `Write a ${p.platform} caption for this carousel.
${spec}
Topic: ${p.topic}. Audience: ${p.audience || "general"}. Objective: ${p.objective}. Tone: ${p.tone}. Language: ${p.language}.
Slides: ${JSON.stringify(p.slides)}
Keywords: ${p.keywords.join(", ")}. Hashtag ideas from research: ${p.hashtagIdeas.join(" ")}
Do not put hashtags inside "body". Hashtags start with #.
JSON: {"body","hashtags":[...]}`;
}
