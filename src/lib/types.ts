import { z } from "zod";

export const PLATFORMS = ["instagram", "linkedin", "both"] as const;
export const OBJECTIVES = ["education", "engagement", "awareness", "leads"] as const;
export const TEMPLATES = ["studio", "clinic", "counsel", "editorial", "mesh", "bold", "noir"] as const;
export const LAYOUTS = ["top", "center", "bottom", "split"] as const;
export const FONT_KEYS = ["geist", "bricolage", "fraunces", "instrument"] as const;
export const SLIDE_KINDS = ["hook", "statement", "list", "steps", "checklist", "myth_fact", "comparison", "highlight", "cta"] as const;
export type SlideKind = (typeof SLIDE_KINDS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB");

export const ColorsSchema = z.object({ background: hex, text: hex, accent: hex, surface: hex });
export type Colors = z.infer<typeof ColorsSchema>;

export const DesignSchema = z.object({
  template: z.enum(TEMPLATES),
  colors: ColorsSchema,
  fontHeading: z.enum(FONT_KEYS),
  fontBody: z.enum(FONT_KEYS),
  logoPath: z.string().nullable().optional(),
  logoPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "none"]).default("top-left"),
  logoSize: z.number().min(40).max(260).default(90),
  handle: z.string().max(60).optional(),
  name: z.string().max(60).optional(), // e.g. "Dr. Ananya Rao" / "Adv. Karan Mehta"
  imageMode: z.enum(["per-slide", "cover-only", "none"]).default("cover-only"),
  /** Imported branded background (storage path) drawn under every slide */
  bgPath: z.string().max(400).nullable().optional(),
  /** Text-safe padding (px at 1080 wide) to keep copy inside an imported frame */
  safeInset: z.number().min(0).max(200).optional(),
});
export type Design = z.infer<typeof DesignSchema>;

export const BriefInputSchema = z.object({
  niche: z.enum(["medical", "legal"]),
  market: z.enum(["US", "UK", "CA", "AU", "AE", "SG", "IN", "GLOBAL"]).default("US"),
  clientId: z.string().uuid().nullable().optional(),
  specialty: z.string().trim().max(80).default(""),
  topic: z.string().trim().min(3).max(200),
  hook: z.string().trim().max(140).optional().default(""),
  industry: z.string().trim().max(120).optional().default(""),
  audience: z.string().trim().max(200).optional().default(""),
  platform: z.enum(PLATFORMS),
  slideCount: z.coerce.number().int().min(1).max(7),
  objective: z.enum(OBJECTIVES),
  tone: z.string().trim().max(80).default("warm, clear and expert"),
  language: z.string().trim().max(40).default("English"),
  referenceUrl: z.string().url().optional().or(z.literal("")).default(""),
  keywords: z.array(z.string().trim().min(1).max(80)).max(15).default([]),
  size: z.enum(["1080x1350", "1080x1080"]).default("1080x1350"),
  design: DesignSchema,
});
export type BriefInput = z.infer<typeof BriefInputSchema>;

export type SlideItem = { title: string; text: string };

export type SlideStyle = {
  background?: string;
  text?: string;
  accent?: string;
  headingScale?: number; // 0.6 – 1.4
  overlay?: number; // 0 – 0.9 scrim over a full-bleed image
  focusY?: number; // 0 – 100 image vertical focus
};

export type Slide = {
  id: string;
  project_id: string;
  position: number;
  kind: SlideKind;
  role: string;
  kicker: string | null;
  heading: string;
  body: string;
  items: SlideItem[];
  visual_prompt: string | null;
  layout: (typeof LAYOUTS)[number];
  background_path: string | null;
  style: SlideStyle;
  render_path: string | null;
};

export type KeywordMetric = {
  id?: string;
  keyword: string;
  related_topic: string | null;
  kind: "seed" | "related" | "long_tail" | "hashtag" | "user";
  origin: "google_ads" | "wikipedia" | "youtube" | "ai_suggested" | "user" | "news";
  avg_monthly_searches: number | null;
  competition: string | null;
  competition_index: number | null;
  monthly_searches: { month: string; searches: number }[] | null;
  interest_series: { date: string; value: number }[] | null;
  interest_source: string | null;
  trend_direction: "rising" | "falling" | "stable" | null;
  news_mentions: number | null;
  youtube_stats: {
    sample_size: number;
    median_views: number | null;
    median_views_per_day: number | null;
    median_engagement_rate: number | null;
    latest_upload: string | null;
  } | null;
  /** AI-estimated viral potential (0–100). Always shown as an estimate. */
  ai_opportunity_score: number | null;
  ai_rationale: string | null;
  selected: boolean;
  fetched_at: string;
};

export type SourceStatus = { source: string; ok: boolean; error?: string; fetched_at: string; note?: string };

export const STAGES = [
  "Researching keywords",
  "Planning the angle",
  "Writing slides",
  "Creating visuals",
  "Rendering slides",
  "Writing the caption",
  "Ready to export",
] as const;
