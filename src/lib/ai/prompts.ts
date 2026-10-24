import "server-only";
import { z } from "zod";
import { NICHES, type Niche } from "@/lib/niches";
import type { KeywordMetric } from "@/lib/types";
import { SLIDE_KINDS } from "@/lib/types";

// ---------------- schemas ----------------
export const KeywordIdeasSchema = z.object({
  keywords: z
    .array(
      z.object({
        keyword: z.string().min(2).max(80),
        related_topic: z.string().max(80).default(""),
        kind: z.enum(["related", "long_tail"]).catch("related"),
        wikipedia_title: z.string().max(120).optional(),
      })
    )
    .min(3)
    .max(20),
  hashtags: z.array(z.string().max(40)).max(20).default([]),
});

export const ScoresSchema = z.object({
  scores: z.array(z.object({ keyword: z.string(), score: z.coerce.number().int().min(0).max(100), rationale: z.string().max(260) })),
});

const ItemSchema = z.object({ title: z.string().max(60).default(""), text: z.string().max(220).default("") });

export const SlideCopySchema = z.object({
  kind: z.enum(SLIDE_KINDS).catch("statement"),
  role: z.string().max(40).default("insight"),
  kicker: z.string().max(40).default(""),
  heading: z.string().min(2).max(110),
  body: z.string().max(300).default(""),
  items: z.array(ItemSchema).max(6).default([]),
  visual_prompt: z.string().max(500).default(""),
});

export const ContentSchema = z.object({
  strategy: z.object({
    angle: z.string().max(400),
    audience_insight: z.string().max(400),
    hook_options: z.array(z.string().max(120)).max(5).default([]),
    narrative: z.array(z.string().max(90)).min(3).max(10),
    visual_direction: z.string().max(400),
  }),
  slides: z.array(SlideCopySchema).min(5).max(8),
});

export const CaptionSchema = z.object({ body: z.string().min(20).max(2200), hashtags: z.array(z.string().max(40)).max(15) });

export const SuggestIdeasSchema = z.object({
  ideas: z
    .array(z.object({ topic: z.string().max(140), angle: z.string().max(200), format: z.string().max(80), why: z.string().max(200) }))
    .min(3)
    .max(8),
});

export const SuggestBriefSchema = z.object({
  sharper_topic: z.string().max(160),
  audiences: z.array(z.string().max(80)).max(4),
  objective: z.enum(["education", "engagement", "awareness", "leads"]).catch("education"),
  tone: z.string().max(60),
  keywords: z.array(z.string().max(60)).max(8),
  hooks: z.array(z.string().max(120)).max(4),
  tip: z.string().max(240),
});

export const TrendIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        topic: z.string().max(140),
        hook: z.string().max(140),
        format: z.string().max(80),
        why_now: z.string().max(220),
        headline_refs: z.array(z.coerce.number().int()).max(4).default([]),
      })
    )
    .max(10),
});

// ---------------- shared voice ----------------
export function systemFor(niche: Niche) {
  const n = NICHES[niche];
  return `You are the head of content at a studio that grows Instagram and LinkedIn accounts for Indian ${n.who}s.
You write carousels that people save and share because they are specific, accurate and genuinely useful — never generic filler.
Write like a sharp ${n.who} explaining to a smart friend: plain words, concrete examples, Indian context (₹, Indian laws/institutions, Indian lifestyles) where relevant.
Hard rules:
- Never invent statistics, studies, case names, section numbers or quotes. If unsure of a specific, describe the principle instead.
- ${n.compliance}
- No clichés ("in today's fast-paced world", "unlock", "game-changer", "let's dive in"). No emojis inside slides.`;
}

// ---------------- keyword research ----------------
export function keywordIdeasPrompt(p: { topic: string; niche: Niche; specialty?: string; platform: string; audience?: string }) {
  return `Topic: ${p.topic}
Professional: ${NICHES[p.niche].who}${p.specialty ? ` (${p.specialty})` : ""}
Platform: ${p.platform}. Audience: ${p.audience || "general public in India"}

List up to 12 search phrases this audience actually types into Instagram/Google search around the topic — the questions and worries that make people stop scrolling.
Mix short "related" terms and 3–7 word "long_tail" questions/phrases ("what to do if…", "signs of…", "is it legal to…").
Prefer phrases with built-in curiosity, fear-of-missing-out or a practical payoff — those spread on Instagram.
If an English Wikipedia article clearly matches a keyword's core concept, give its exact title in "wikipedia_title".
Also give up to 12 hashtags (no spaces) mixing broad (#health, #legalawareness) and niche ones used by Indian ${NICHES[p.niche].who}s.
Never include numbers, volumes or popularity claims.
JSON: {"keywords":[{"keyword","related_topic","kind","wikipedia_title"}],"hashtags":[...]}`;
}

export function viralScoringPrompt(topic: string, niche: Niche, audience: string, rows: KeywordMetric[]) {
  const data = rows.map((r) => ({
    keyword: r.keyword,
    news_mentions_7d: r.news_mentions,
    trend: r.trend_direction,
    youtube_views_per_day: r.youtube_stats?.median_views_per_day ?? null,
    youtube_engagement_pct: r.youtube_stats?.median_engagement_rate ?? null,
    monthly_searches: r.avg_monthly_searches,
  }));
  return `Topic: ${topic}. Niche: Indian ${NICHES[niche].who}s. Audience: ${audience || "general public"}.
Measured signals (null = not available): ${JSON.stringify(data)}

Estimate each keyword's VIRAL POTENTIAL on Instagram (0–100) as a carousel subject. Weigh:
1) emotional/practical pull (fear, surprise, money, family, "I didn't know that"), 2) shareability ("send this to someone who…"),
3) timeliness from the measured signals (news mentions, rising trend, high views/day), 4) how saturated/generic it is.
Be calibrated: most keywords land 35–70; reserve 80+ for strong pull AND timely evidence. Rationale ≤ 200 chars, name the signal you relied on.
JSON: {"scores":[{"keyword","score","rationale"}]}`;
}

// ---------------- AI suggestions while filling the brief ----------------
export function ideasPrompt(p: { niche: Niche; specialty: string; audience: string; headlines: string[] }) {
  const n = NICHES[p.niche];
  return `Suggest 6 carousel topics for an Indian ${n.who}${p.specialty ? ` specialising in ${p.specialty}` : ""}${p.audience ? `, audience: ${p.audience}` : ""}.
Make each topic specific and scroll-stopping (not "Tips for good health"). Use these proven formats where they fit: ${n.formats.join("; ")}.
${p.headlines.length ? `This week's real headlines in the niche (use 2–3 for timely ideas, don't invent news): ${p.headlines.slice(0, 15).map((h, i) => `[${i}] ${h}`).join(" | ")}` : ""}
For each: topic (≤ 12 words), angle (what makes it different), format, why (why people will save/share it).
JSON: {"ideas":[{"topic","angle","format","why"}]}`;
}

export function briefPrompt(p: { niche: Niche; specialty: string; topic: string; audience: string; objective: string }) {
  const n = NICHES[p.niche];
  return `An Indian ${n.who}${p.specialty ? ` (${p.specialty})` : ""} wants a carousel on: "${p.topic}". Current audience: ${p.audience || "not set"}. Objective: ${p.objective}.
Help them fill the brief:
- sharper_topic: rewrite the topic as a specific, curiosity-driven working title (≤ 14 words).
- audiences: 3 precise audience descriptions (who exactly needs this).
- objective: best fit of education/engagement/awareness/leads (for lawyers prefer awareness/education; no solicitation).
- tone: 3–5 words.
- keywords: 6 search phrases people use for this.
- hooks: 3 cover-slide hooks (≤ 12 words each) using different formulas (mistake, myth, question, consequence).
- tip: one concrete suggestion to make this carousel more saveable.
JSON: {"sharper_topic","audiences":[],"objective","tone","keywords":[],"hooks":[],"tip"}`;
}

export function trendIdeasPrompt(niche: Niche, headlines: { title: string; source: string }[]) {
  const n = NICHES[niche];
  return `These are real news headlines from the last 7 days in India (index: title — source):
${headlines.map((h, i) => `[${i}] ${h.title} — ${h.source}`).join("\n")}

Turn the most relevant ones into up to 8 Instagram carousel ideas for Indian ${n.who}s that educate the public about what the news means for them.
Skip celebrity gossip, politics without a practical angle, and anything you'd need to speculate about.
For each: topic (≤ 12 words), hook (cover line ≤ 12 words), format (one of: ${n.formats.join("; ")}), why_now (cite what happened, briefly), headline_refs (indexes used).
JSON: {"ideas":[{"topic","hook","format","why_now","headline_refs":[]}]}`;
}

// ---------------- carousel copy ----------------
const KIND_GUIDE = `Slide kinds (choose per slide; use at least 3 different kinds; content must fit the kind):
- hook: cover. heading = scroll-stopping hook ≤ 9 words; body = one-line promise ≤ 14 words; no items.
- statement: one idea. heading ≤ 10 words; body ≤ 40 words with a concrete example.
- list: heading + 3–5 items {title ≤ 5 words, text ≤ 18 words}.
- steps: ordered actions. heading + 3–5 items {title = the action, text ≤ 18 words}.
- checklist: signs/symptoms/documents. heading + 4–6 items {title ≤ 6 words, text optional ≤ 12 words}.
- myth_fact: heading + exactly 2 items: {title:"Myth", text ≤ 20 words}, {title:"Fact", text ≤ 30 words}.
- comparison: heading + exactly 2 items {title = column label e.g. "Do"/"Don't", text = 3 short lines separated by \\n}.
- highlight: one memorable line as heading (≤ 16 words); body optional ≤ 12 words.
- cta: last slide. heading ≤ 8 words; body ≤ 20 words; CTA is to save/share/follow/comment a keyword — never solicit clients.`;

export function contentPrompt(p: {
  niche: Niche;
  specialty: string;
  topic: string;
  hook?: string;
  audience: string;
  objective: string;
  tone: string;
  language: string;
  platform: string;
  slideCount: number;
  keywords: string[];
  templateLabel: string;
  referenceNote?: string;
}) {
  const n = NICHES[p.niche];
  return `Create a ${p.slideCount}-slide carousel.
Professional: Indian ${n.who}${p.specialty ? ` — ${p.specialty}` : ""}
Topic: ${p.topic}
${p.hook ? `Cover hook chosen by the author (use it on slide 1, you may tighten wording): "${p.hook}"` : ""}
Audience: ${p.audience || "general public in India"}
Objective: ${p.objective}. Platform: ${p.platform}. Tone: ${p.tone}. Language: ${p.language}.
Keywords to weave in naturally (not stuffed): ${p.keywords.join(", ") || "none"}
Proven formats for this niche: ${n.formats.join("; ")}
${p.referenceNote ? `Reference context: ${p.referenceNote}` : ""}

First decide the single sharpest angle (who exactly, which situation, what they get wrong). Then write.
Quality bar — every slide must pass:
- Specific: names a real situation, symptom, document, right, deadline or habit. No vague advice ("stay healthy", "know your rights").
- One idea per slide, building a story: hook → why it matters → the useful part (2–4 slides) → takeaway → CTA.
- Slide 1 must make the target person feel "this is about me". Slide 2 must pay off the hook immediately.
- Readers should learn at least 3 things they can act on.

${KIND_GUIDE}

kicker: ≤ 3 words that orient the reader (e.g. "Red flag", "Your right", "Step 2"); empty for hook/cta is fine.
visual_prompt: ONLY for the hook slide (and optionally one statement slide); otherwise "". Describe a text-free photo/illustration: subject, setting in India, lighting, and keep the subject centred with breathing room on all sides. No doctors' faces close-up, no gavels-and-scales clichés unless reinvented, no text in image.
Return exactly ${p.slideCount} slides, first kind "hook", last kind "cta".
JSON: {"strategy":{"angle","audience_insight","hook_options":[3 alternatives],"narrative":[...],"visual_direction"},"slides":[{"kind","role","kicker","heading","body","items":[{"title","text"}],"visual_prompt"}]}`;
}

/** Second pass: an editor sharpens the draft. */
export function editorPrompt(draftJson: string, niche: Niche) {
  return `You are the senior editor. Here is a carousel draft (JSON):
${draftJson}

Improve it. Checklist:
1. Hook: would the target person stop scrolling? If not, rewrite it sharper and more specific.
2. Replace any vague line with a concrete, accurate specific. Cut filler words. Shorter is better.
3. Remove anything that could be an invented statistic, fake case/section number, or a promise of outcome.
4. Check compliance: ${NICHES[niche].compliance}
5. Respect each kind's length limits so text fits on a 1080px slide.
6. Make the CTA earn a save or share (e.g. "Save this for when you need it", "Send to someone renting a flat").
Keep the same JSON shape and number of slides. Return the improved JSON only.`;
}

export function regenerateSlidePrompt(p: {
  niche: Niche;
  topic: string;
  audience: string;
  tone: string;
  language: string;
  keywords: string[];
  position: number;
  total: number;
  kind: string;
  current: string;
  neighbours: string;
  instruction?: string;
}) {
  return `Rewrite slide ${p.position + 1} of ${p.total} for a carousel on "${p.topic}" for ${p.audience || "the general public"} (Indian ${NICHES[p.niche].who}).
Current slide: ${p.current}
Other slides (stay consistent, don't repeat): ${p.neighbours}
Tone: ${p.tone}. Language: ${p.language}. Keywords if natural: ${p.keywords.join(", ") || "none"}.
${p.instruction ? `Instruction: ${p.instruction}` : "Make it sharper, more specific and more useful than the current version."}
Keep kind "${p.kind}" unless the instruction asks otherwise.
${KIND_GUIDE}
JSON: {"kind","role","kicker","heading","body","items":[{"title","text"}],"visual_prompt"}`;
}

export function captionPrompt(p: {
  niche: Niche;
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
  const n = NICHES[p.niche];
  const spec =
    p.platform === "instagram"
      ? "Instagram: first line is a hook that works before 'more' (≤ 110 chars). Then 3–6 short lines adding value not already on the slides. End with a save/share/comment prompt. ≤ 130 words. 8–12 hashtags mixing broad + niche + Indian."
      : "LinkedIn: professional first line hook, then a short insight-led post (≤ 170 words) with one clear takeaway and a discussion question. 3–5 hashtags.";
  return `Write a ${p.platform} caption for this carousel by an Indian ${n.who}.
${spec}
End the body with this line on its own: "${n.disclaimer}"
Topic: ${p.topic}. Audience: ${p.audience || "general"}. Objective: ${p.objective}. Tone: ${p.tone}. Language: ${p.language}.
Slides: ${JSON.stringify(p.slides)}
Keywords: ${p.keywords.join(", ")}. Hashtag ideas: ${p.hashtagIdeas.join(" ")}
No hashtags inside "body". Hashtags start with #.
JSON: {"body","hashtags":[...]}`;
}
