import { z } from "zod";

export const PLATFORMS = ["instagram", "linkedin", "both"] as const;
export const OBJECTIVES = ["education", "engagement", "awareness", "leads"] as const;
export const THEMES = ["minimalist", "editorial", "bold", "luxury", "corporate", "dark", "colorful"] as const;
export const LAYOUTS = ["top", "center", "bottom", "split"] as const;
export const FONT_KEYS = ["display", "sans", "serif"] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB");

export const ColorsSchema = z.object({ primary: hex, accent: hex, background: hex, text: hex });
export type Colors = z.infer<typeof ColorsSchema>;

export const DesignSchema = z.object({
  theme: z.enum(THEMES),
  colors: ColorsSchema,
  fontHeading: z.enum(FONT_KEYS),
  fontBody: z.enum(FONT_KEYS),
  logoPath: z.string().nullable().optional(),
  logoPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "none"]).default("bottom-right"),
  logoSize: z.number().min(40).max(260).default(110),
  handle: z.string().max(60).optional(),
  imageMode: z.enum(["per-slide", "cover-only", "none"]).default("per-slide"),
});
export type Design = z.infer<typeof DesignSchema>;

export const BriefInputSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  industry: z.string().trim().max(120).optional().default(""),
  audience: z.string().trim().max(200).optional().default(""),
  platform: z.enum(PLATFORMS),
  slideCount: z.union([z.literal(6), z.literal(7)]),
  objective: z.enum(OBJECTIVES),
  tone: z.string().trim().max(80).default("clear and confident"),
  language: z.string().trim().max(40).default("English"),
  referenceUrl: z.string().url().optional().or(z.literal("")).default(""),
  keywords: z.array(z.string().trim().min(1).max(80)).max(15).default([]),
  size: z.enum(["1080x1350", "1080x1080"]).default("1080x1350"),
  design: DesignSchema,
});
export type BriefInput = z.infer<typeof BriefInputSchema>;

export type SlideStyle = {
  background?: string;
  text?: string;
  accent?: string;
  headingScale?: number; // 0.6 – 1.4 multiplier
  overlay?: number; // 0 – 0.9 darkening over bg image
};

export type Slide = {
  id: string;
  project_id: string;
  position: number;
  role: string;
  kicker: string | null;
  heading: string;
  body: string;
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
  origin: "google_ads" | "wikipedia" | "youtube" | "ai_suggested" | "user";
  avg_monthly_searches: number | null;
  competition: string | null;
  competition_index: number | null;
  monthly_searches: { month: string; searches: number }[] | null;
  interest_series: { date: string; value: number }[] | null;
  interest_source: string | null;
  trend_direction: "rising" | "falling" | "stable" | null;
  youtube_stats: {
    sample_size: number;
    median_views: number | null;
    median_engagement_rate: number | null;
    latest_upload: string | null;
  } | null;
  ai_opportunity_score: number | null;
  ai_rationale: string | null;
  selected: boolean;
  fetched_at: string;
};

export type SourceStatus = { source: string; ok: boolean; error?: string; fetched_at: string; note?: string };

export const STAGES = [
  "Researching keywords",
  "Developing content",
  "Generating slide copy",
  "Creating visuals",
  "Rendering slides",
  "Writing the caption",
  "Preparing exports",
] as const;
