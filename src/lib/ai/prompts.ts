import "server-only";
import { z } from "zod";
import { NICHES, rulesFor, type Niche } from "@/lib/niches";
import type { MarketCode } from "@/lib/markets";
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
    narrative: z.array(z.string().max(90)).max(10).default([]),
    visual_direction: z.string().max(400),
  }),
  slides: z.array(SlideCopySchema).min(1).max(8),
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
  slide_count: z.coerce.number().int().min(1).max(7).catch(6),
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
/**
 * EditSimple is a content agency: editors and writers producing posts on behalf of doctor and lawyer clients,
 * most of them outside India. Every prompt is written from that seat.
 */
export function systemFor(niche: Niche, market: MarketCode = "US") {
  const n = NICHES[niche];
  const r = rulesFor(niche, market);
  return `You are the senior content strategist at EditSimple, an agency that writes, designs and manages social content for ${n.who}s.
You are writing on behalf of a client ${n.who}, in the client's professional voice, for their audience in ${r.label}.
Context to use: ${r.context}. Spelling: ${r.spelling}. Currency: ${r.currency}.
Your posts get saved and shared because they are specific, accurate and genuinely useful — never generic filler.
Hard rules:
- Never invent statistics, studies, case names, statutes or quotes. If unsure of a specific, describe the principle instead.
- Compliance: ${r.rules}
- Plain words, short sentences. No clichés ("in today's fast-paced world", "unlock", "game-changer", "let's dive in"). No emojis inside slides.`;
}

// ---------------- keyword research ----------------
export function keywordIdeasPrompt(p: { topic: string; niche: Niche; market: MarketCode; specialty?: string; platform: string; audience?: string }) {
  const r = rulesFor(p.niche, p.market);
  return `Topic: ${p.topic}
Client: ${NICHES[p.niche].who}${p.specialty ? ` (${p.specialty})` : ""}, audience in ${r.label}.
Platform: ${p.platform}. Audience: ${p.audience || "general public"}

List up to 12 search phrases this audience actually types into Instagram and Google around the topic — the questions and worries that make people stop scrolling.
Use ${r.spelling} and local terms for ${r.label}. Mix short "related" terms and 3–7 word "long_tail" questions ("what to do if…", "signs of…", "can my landlord…").
Prefer phrases with built-in curiosity or a practical payoff — those spread on Instagram.
If an English Wikipedia article clearly matches a keyword's core concept, give its exact title in "wikipedia_title".
Also give up to 12 hashtags (no spaces) mixing broad and niche tags used by ${NICHES[p.niche].who}s in ${r.label}.
Never include numbers, volumes or popularity claims.
JSON: {"keywords":[{"keyword","related_topic","kind","wikipedia_title"}],"hashtags":[...]}`;
}

export function viralScoringPrompt(topic: string, niche: Niche, market: MarketCode, audience: string, rows: KeywordMetric[]) {
  const data = rows.map((r) => ({
    keyword: r.keyword,
    news_mentions_7d: r.news_mentions,
    trend: r.trend_direction,
    youtube_views_per_day: r.youtube_stats?.median_views_per_day ?? null,
    youtube_engagement_pct: r.youtube_stats?.median_engagement_rate ?? null,
    monthly_searches: r.avg_monthly_searches,
  }));
  return `Topic: ${topic}. Client type: ${NICHES[niche].who}. Market: ${rulesFor(niche, market).label}. Audience: ${audience || "general public"}.
Measured signals (null = not available): ${JSON.stringify(data)}

Estimate each keyword's VIRAL POTENTIAL on Instagram (0–100) as a post subject. Weigh:
1) emotional/practical pull (fear, surprise, money, family, "I didn't know that"), 2) shareability ("send this to someone who…"),
3) timeliness from the measured signals (news mentions, rising trend, high views/day), 4) how saturated or generic it is.
Be calibrated: most keywords land 35–70; reserve 80+ for strong pull AND timely evidence. Rationale ≤ 200 chars, name the signal you relied on.
JSON: {"scores":[{"keyword","score","rationale"}]}`;
}

// ---------------- AI suggestions while filling the brief ----------------
export function ideasPrompt(p: { niche: Niche; market: MarketCode; specialty: string; audience: string; clientNotes?: string; headlines: string[] }) {
  const n = NICHES[p.niche];
  const r = rulesFor(p.niche, p.market);
  return `Suggest 6 post topics for our client, a ${n.who}${p.specialty ? ` specialising in ${p.specialty}` : ""} whose audience is in ${r.label}${p.audience ? ` (${p.audience})` : ""}.
${p.clientNotes ? `Client notes from the account manager: ${p.clientNotes}` : ""}
Make each topic specific and scroll-stopping (not "Tips for good health"). Mix evergreen topics with timely ones. Proven formats: ${n.formats.join("; ")}.
${p.headlines.length ? `This week's real headlines in ${r.label} (use 2–3 for timely ideas; never invent news): ${p.headlines.slice(0, 15).map((h, i) => `[${i}] ${h}`).join(" | ")}` : ""}
For each: topic (≤ 12 words), angle (what makes it different), format, why (why this audience will save or share it).
JSON: {"ideas":[{"topic","angle","format","why"}]}`;
}

export function briefPrompt(p: { niche: Niche; market: MarketCode; specialty: string; topic: string; audience: string; objective: string; clientNotes?: string }) {
  const n = NICHES[p.niche];
  const r = rulesFor(p.niche, p.market);
  return `We're creating a post for our client, a ${n.who}${p.specialty ? ` (${p.specialty})` : ""} with an audience in ${r.label}. Topic: "${p.topic}". Current audience: ${p.audience || "not set"}. Objective: ${p.objective}.
${p.clientNotes ? `Client notes: ${p.clientNotes}` : ""}
Help the editor fill the brief:
- sharper_topic: a specific, curiosity-driven working title (≤ 14 words), in ${r.spelling}.
- audiences: 3 precise audience descriptions (who exactly needs this).
- objective: best fit of education/engagement/awareness/leads (stay within: ${r.rules.slice(0, 160)}…).
- tone: 3–5 words.
- keywords: 6 search phrases people in ${r.label} use for this.
- hooks: 3 cover hooks (≤ 12 words each) using different formulas (mistake, myth, question, consequence).
- slide_count: best number of slides from 1 to 7 for this topic (1 = single image post; most explainers are 5–7).
- tip: one concrete suggestion to make the post more saveable.
JSON: {"sharper_topic","audiences":[],"objective","tone","keywords":[],"hooks":[],"slide_count","tip"}`;
}

export function trendIdeasPrompt(niche: Niche, market: MarketCode, headlines: { title: string; source: string }[]) {
  const n = NICHES[niche];
  const r = rulesFor(niche, market);
  return `These are real news headlines from the last 7 days in ${r.label} (index: title — source):
${headlines.map((h, i) => `[${i}] ${h.title} — ${h.source}`).join("\n")}

We create content for ${n.who}s. Turn the most relevant headlines into up to 8 Instagram post ideas that explain what the news means for ordinary people.
Skip celebrity gossip, politics without a practical angle, and anything that needs speculation.
For each: topic (≤ 12 words), hook (cover line ≤ 12 words), format (one of: ${n.formats.join("; ")}), why_now (what happened, briefly), headline_refs (indexes used).
JSON: {"ideas":[{"topic","hook","format","why_now","headline_refs":[]}]}`;
}

// ---------------- post copy ----------------
const KIND_GUIDE = `Slide kinds (content must fit the kind):
- hook: cover. heading = scroll-stopping hook ≤ 9 words; body = one-line promise ≤ 14 words; no items.
- statement: one idea. heading ≤ 10 words; body ≤ 40 words with a concrete example.
- list: heading + 3–5 items {title ≤ 5 words, text ≤ 18 words}.
- steps: ordered actions. heading + 3–5 items {title = the action, text ≤ 18 words}.
- checklist: signs/symptoms/documents. heading + 4–6 items {title ≤ 6 words, text optional ≤ 12 words}.
- myth_fact: heading + exactly 2 items: {title:"Myth", text ≤ 20 words}, {title:"Fact", text ≤ 30 words}.
- comparison: heading + exactly 2 items {title = column label e.g. "Do"/"Don't", text = 3 short lines separated by \\n}.
- highlight: one memorable line as heading (≤ 16 words); body optional ≤ 12 words.
- cta: last slide. heading ≤ 8 words; body ≤ 20 words; ask to save/share/follow/comment — never solicit clients.`;

/** Structure rules depend on how many slides the post has. */
export function structureFor(n: number) {
  if (n <= 1)
    return `This is a SINGLE-IMAGE post (1 slide). Put the whole value on one slide: a strong heading plus a list, checklist, myth_fact or comparison (or a statement). Do not use kind "hook" or "cta" — fold a short save/share line into the body if it fits.`;
  if (n === 2) return `This is a 2-slide post: slide 1 kind "hook", slide 2 delivers the full payoff (list/checklist/steps/myth_fact/comparison) with a one-line save/share prompt in its body. No separate cta slide.`;
  if (n === 3) return `This is a 3-slide post: hook → one value slide (list/steps/checklist/myth_fact/comparison) → cta.`;
  return `Story: hook → why it matters → the useful part (${Math.max(1, n - 3)} slides) → takeaway → cta. First kind "hook", last kind "cta". Use at least 3 different kinds.`;
}

export function contentPrompt(p: {
  niche: Niche;
  market: MarketCode;
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
  clientName?: string;
  clientNotes?: string;
  referenceNote?: string;
}) {
  const n = NICHES[p.niche];
  const r = rulesFor(p.niche, p.market);
  return `Write a ${p.slideCount}-slide Instagram/LinkedIn post for our client.
Client: ${p.clientName || `a ${n.who}`}${p.specialty ? ` — ${p.specialty}` : ""}. Audience location: ${r.label}.
${p.clientNotes ? `Account notes (follow them): ${p.clientNotes}` : ""}
Topic: ${p.topic}
${p.hook ? `Cover hook chosen by the editor (use it on slide 1, tighten wording if needed): "${p.hook}"` : ""}
Audience: ${p.audience || "general public"}
Objective: ${p.objective}. Platform: ${p.platform}. Tone: ${p.tone}. Language: ${p.language} (${r.spelling} spelling if English).
Keywords to weave in naturally (not stuffed): ${p.keywords.join(", ") || "none"}
Proven formats for this niche: ${n.formats.join("; ")}
${p.referenceNote ? `Reference context: ${p.referenceNote}` : ""}

First decide the single sharpest angle (who exactly, which situation, what they get wrong). Then write.
Quality bar — every slide must pass:
- Specific: names a real situation, symptom, document, right, deadline or habit relevant to ${r.label}. No vague advice ("stay healthy", "know your rights").
- One idea per slide. Readers should learn things they can act on today.
- The cover must make the target person feel "this is about me".

${structureFor(p.slideCount)}

${KIND_GUIDE}

kicker: ≤ 3 words that orient the reader (e.g. "Red flag", "Your right", "Step 2"); may be empty.
visual_prompt: ONLY for the first slide (and optionally one statement slide); otherwise "". Describe a text-free photo or illustration that suits ${r.label}: subject, setting, lighting; subject centred with breathing room on all sides. Avoid clichés (stethoscope on desk, gavel and scales) unless reinvented. No text in the image.
Return exactly ${p.slideCount} slide(s).
JSON: {"strategy":{"angle","audience_insight","hook_options":[3 alternatives],"narrative":[...],"visual_direction"},"slides":[{"kind","role","kicker","heading","body","items":[{"title","text"}],"visual_prompt"}]}`;
}

/** Second pass: an editor sharpens the draft. */
export function editorPrompt(draftJson: string, niche: Niche, market: MarketCode) {
  return `You are EditSimple's senior editor reviewing a writer's draft before it goes to the client (JSON):
${draftJson}

Improve it. Checklist:
1. Hook: would the target person stop scrolling? If not, rewrite it sharper and more specific.
2. Replace any vague line with a concrete, accurate specific. Cut filler words. Shorter is better.
3. Remove anything that could be an invented statistic, fake case or statute, or a promise of outcome.
4. Compliance: ${rulesFor(niche, market).rules}
5. Respect each kind's length limits so text fits on a 1080px slide.
6. Make the ending earn a save or share.
Keep the same JSON shape and the same number of slides. Return the improved JSON only.`;
}

export function regenerateSlidePrompt(p: {
  niche: Niche;
  market: MarketCode;
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
  return `Rewrite slide ${p.position + 1} of ${p.total} for a post on "${p.topic}" for ${p.audience || "the general public"} in ${rulesFor(p.niche, p.market).label} (client: ${NICHES[p.niche].who}).
Current slide: ${p.current}
Other slides (stay consistent, don't repeat): ${p.neighbours || "none"}
Tone: ${p.tone}. Language: ${p.language}. Keywords if natural: ${p.keywords.join(", ") || "none"}.
${p.instruction ? `Editor's instruction: ${p.instruction}` : "Make it sharper, more specific and more useful than the current version."}
Keep kind "${p.kind}" unless the instruction asks otherwise.
${KIND_GUIDE}
JSON: {"kind","role","kicker","heading","body","items":[{"title","text"}],"visual_prompt"}`;
}

export function captionPrompt(p: {
  niche: Niche;
  market: MarketCode;
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
  const r = rulesFor(p.niche, p.market);
  const spec =
    p.platform === "instagram"
      ? "Instagram: first line is a hook that works before 'more' (≤ 110 chars). Then 3–6 short lines adding value not already on the slides. End with a save/share/comment prompt. ≤ 130 words. 8–12 hashtags mixing broad, niche and location-relevant."
      : "LinkedIn: professional first-line hook, then a short insight-led post (≤ 170 words) with one clear takeaway and a discussion question. 3–5 hashtags.";
  return `Write a ${p.platform} caption for this post, in the voice of our client (a ${n.who}), for an audience in ${r.label}. ${r.spelling} spelling.
${spec}
End the body with this line on its own: "${n.disclaimer}"
Topic: ${p.topic}. Audience: ${p.audience || "general"}. Objective: ${p.objective}. Tone: ${p.tone}. Language: ${p.language}.
Slides: ${JSON.stringify(p.slides)}
Keywords: ${p.keywords.join(", ")}. Hashtag ideas: ${p.hashtagIdeas.join(" ")}
Compliance: ${r.rules}
No hashtags inside "body". Hashtags start with #.
JSON: {"body","hashtags":[...]}`;
}
