import type { Colors, Design } from "@/lib/types";
import type { Niche } from "@/lib/niches";

type FontKey = Design["fontHeading"];
export type FontMeta = {
  label: string;
  family: string;
  kind: "Sans" | "Display" | "Serif";
  /** fonts that only ship one weight — never fake-bold them */
  fixedWeight?: number;
  /** only suitable for headings (all-caps or display cuts) */
  headingOnly?: boolean;
  /** optical size correction vs. a typical sans */
  scale?: number;
  lineHeight?: number;
  tracking?: string;
  hidden?: boolean;
};

const sans = (f: string) => `'${f}', ui-sans-serif, system-ui, sans-serif`;
const serif = (f: string) => `'${f}', ui-serif, Georgia, serif`;

/** Carousel fonts — all self-hosted so exports embed them reliably. */
export const FONTS: Record<FontKey, FontMeta> = {
  geist: { label: "Geist", family: sans("Geist Variable"), kind: "Sans" },
  jakarta: { label: "Plus Jakarta Sans", family: sans("Plus Jakarta Sans Variable"), kind: "Sans" },
  montserrat: { label: "Montserrat", family: sans("Montserrat Variable"), kind: "Sans", scale: 0.94 },
  poppins: { label: "Poppins", family: sans("Poppins"), kind: "Sans", scale: 0.94 },
  dmsans: { label: "DM Sans", family: sans("DM Sans Variable"), kind: "Sans" },
  outfit: { label: "Outfit", family: sans("Outfit Variable"), kind: "Sans", scale: 1.02 },
  sora: { label: "Sora", family: sans("Sora Variable"), kind: "Sans", scale: 0.94 },
  spacegrotesk: { label: "Space Grotesk", family: sans("Space Grotesk Variable"), kind: "Display" },
  bricolage: { label: "Bricolage", family: sans("Bricolage Grotesque Variable"), kind: "Display" },
  archivo: { label: "Archivo", family: sans("Archivo Variable"), kind: "Display" },
  bebas: { label: "Bebas Neue", family: sans("Bebas Neue"), kind: "Display", fixedWeight: 400, headingOnly: true, scale: 1.3, lineHeight: 0.92, tracking: "0.01em" },
  fraunces: { label: "Fraunces", family: serif("Fraunces Variable"), kind: "Serif", lineHeight: 1.04 },
  playfair: { label: "Playfair Display", family: serif("Playfair Display Variable"), kind: "Serif", lineHeight: 1.06, tracking: "-0.01em" },
  dmserif: { label: "DM Serif Display", family: serif("DM Serif Display"), kind: "Serif", fixedWeight: 400, headingOnly: true, scale: 1.04, lineHeight: 1.04, tracking: "-0.01em" },
  lora: { label: "Lora", family: serif("Lora Variable"), kind: "Serif", lineHeight: 1.08, tracking: "-0.01em" },
  instrument: { label: "Fraunces", family: serif("Fraunces Variable"), kind: "Serif", lineHeight: 1.04, hidden: true }, // retired face
};

export const FONT_VARS = Object.fromEntries(Object.entries(FONTS).map(([k, v]) => [k, v.family])) as Record<FontKey, string>;
export const FONT_LABEL = Object.fromEntries(Object.entries(FONTS).map(([k, v]) => [k, v.label])) as Record<FontKey, string>;

export type TemplateSpec = {
  label: string;
  description: string;
  colors: Colors;
  fontHeading: Design["fontHeading"];
  fontBody: Design["fontBody"];
  /** visual treatment flags read by SlideCanvas */
  look: {
    bg: "flat" | "mesh" | "glow";
    cards: "outline" | "filled" | "glass" | "rule";
    headingWeight: number;
    tracking: string;
    radius: number;
    upper?: boolean;
  };
  bestFor?: Niche;
};

export const TEMPLATES: Record<Design["template"], TemplateSpec> = {
  studio: {
    label: "Studio",
    description: "Crisp white, oversized sans, quiet detail",
    colors: { background: "#FFFFFF", text: "#141821", accent: "#2E5BFF", surface: "#F1F3F7" },
    fontHeading: "geist", fontBody: "geist",
    look: { bg: "flat", cards: "filled", headingWeight: 700, tracking: "-0.045em", radius: 28 },
  },
  clinic: {
    label: "Clinic",
    description: "Calm mint and teal, soft rounded panels",
    colors: { background: "#F2FAF8", text: "#0D2B28", accent: "#0F7C72", surface: "#FFFFFF" },
    fontHeading: "bricolage", fontBody: "geist",
    look: { bg: "flat", cards: "filled", headingWeight: 700, tracking: "-0.035em", radius: 36 },
    bestFor: "medical",
  },
  counsel: {
    label: "Counsel",
    description: "Navy and brass, serif authority",
    colors: { background: "#0F1B33", text: "#F3EEE4", accent: "#C9A45C", surface: "#17264A" },
    fontHeading: "fraunces", fontBody: "geist",
    look: { bg: "flat", cards: "rule", headingWeight: 600, tracking: "-0.015em", radius: 6 },
    bestFor: "legal",
  },
  editorial: {
    label: "Editorial",
    description: "Magazine serif on stone, fine rules",
    colors: { background: "#E9E7E2", text: "#1D1B18", accent: "#8C2F3C", surface: "#F6F5F2" },
    fontHeading: "fraunces", fontBody: "geist",
    look: { bg: "flat", cards: "rule", headingWeight: 500, tracking: "-0.025em", radius: 0 },
  },
  mesh: {
    label: "Aura",
    description: "Soft colour field with frosted panels",
    colors: { background: "#EEF0FF", text: "#141631", accent: "#5B4BFF", surface: "#FFFFFF" },
    fontHeading: "geist", fontBody: "geist",
    look: { bg: "mesh", cards: "glass", headingWeight: 650, tracking: "-0.04em", radius: 32 },
  },
  bold: {
    label: "Poster",
    description: "Saturated colour, huge condensed type",
    colors: { background: "#1438FF", text: "#FFFFFF", accent: "#FFD84A", surface: "#0F2BD1" },
    fontHeading: "bricolage", fontBody: "geist",
    look: { bg: "flat", cards: "outline", headingWeight: 800, tracking: "-0.05em", radius: 24, upper: false },
  },
  noir: {
    label: "Night",
    description: "Deep charcoal with a lit accent",
    colors: { background: "#0E1016", text: "#EEF0F5", accent: "#7FB7FF", surface: "#171A23" },
    fontHeading: "geist", fontBody: "geist",
    look: { bg: "glow", cards: "outline", headingWeight: 650, tracking: "-0.04em", radius: 24 },
  },
};

export const defaultDesign = (template: Design["template"] = "studio"): Design => ({
  template,
  colors: TEMPLATES[template].colors,
  fontHeading: TEMPLATES[template].fontHeading,
  fontBody: TEMPLATES[template].fontBody,
  logoPath: null,
  logoPosition: "top-left",
  logoSize: 90,
  handle: "",
  name: "",
  imageMode: "cover-only",
  bgPath: null,
});

export const nicheDefaultTemplate = (n: Niche): Design["template"] => (n === "legal" ? "counsel" : "clinic");

/** WCAG contrast ratio. */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export const isDark = (hex: string) => contrast(hex, "#000000") < 7;

/** Converts a pre-v2 design (theme-based) into the v2 shape. */
export function migrateDesign(raw: unknown): Design | null {
  const d = raw as Record<string, any> | null;
  if (!d || typeof d !== "object") return null;
  if (d.template) return null;
  const map: Record<string, Design["template"]> = { minimalist: "studio", editorial: "editorial", bold: "bold", luxury: "counsel", corporate: "studio", dark: "noir", colorful: "mesh" };
  const t = map[d.theme] ?? "studio";
  return { ...defaultDesign(t), logoPath: d.logoPath ?? null, handle: d.handle ?? "" };
}
