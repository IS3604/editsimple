/**
 * Pure colour utilities for "Import template from an image". No DOM — unit-tested.
 * The browser decodes the image into RGBA pixels; these functions turn pixels into a slide design.
 */
import { z } from "zod";
import { contrast, defaultDesign, TEMPLATES } from "@/lib/themes";
import { DesignSchema, type Colors, type Design } from "@/lib/types";

export const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();

export const fromHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function saturation(hex: string) {
  const [r, g, b] = fromHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/** Hue in degrees (0–360). */
export function hue(hex: string) {
  const [r, g, b] = fromHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function luminance(hex: string) {
  const [r, g, b] = fromHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const mix = (a: string, b: string, t: number) => {
  const x = fromHex(a);
  const y = fromHex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
};

/**
 * Dominant colours from RGBA pixels: 4-bit-per-channel buckets, averaged, most frequent first.
 * Transparent pixels are ignored. `step` samples every Nth pixel for speed.
 */
export function extractPalette(rgba: Uint8ClampedArray | number[], max = 6, step = 1): { hex: string; share: number }[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4 * step) {
    if (rgba[i + 3] < 128) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bk.r += r; bk.g += g; bk.b += b; bk.n++;
    buckets.set(key, bk);
    total++;
  }
  if (!total) return [];
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => ({ hex: toHex(b.r / b.n, b.g / b.n, b.b / b.n), share: b.n / total }));
  // merge near-duplicates (bucket edges)
  const out: { hex: string; share: number }[] = [];
  for (const c of sorted) {
    const near = out.find((o) => colourDistance(o.hex, c.hex) < 28);
    if (near) near.share += c.share;
    else out.push({ ...c });
    if (out.length >= max) break;
  }
  return out;
}

export function colourDistance(a: string, b: string) {
  const x = fromHex(a);
  const y = fromHex(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Turns a palette into slide colours with readable contrast. */
export function paletteToColors(palette: { hex: string; share: number }[]): Colors {
  if (!palette.length) return defaultDesign().colors;
  const background = palette[0].hex;
  const dark = luminance(background) < 0.25;
  // text: the palette colour with the best contrast, falling back to near-black / near-white
  const textCandidate = [...palette.slice(1).map((p) => p.hex)].sort((a, b) => contrast(b, background) - contrast(a, background))[0];
  // prefer soft ink or white; fall back to pure black for awkward mid-greys
  const options = dark ? ["#FFFFFF", "#14161F", "#000000"] : ["#14161F", "#FFFFFF", "#000000"];
  const fallback = options.find((o) => contrast(o, background) >= 4.5) ?? options.sort((x, y) => contrast(y, background) - contrast(x, background))[0];
  const text = textCandidate && contrast(textCandidate, background) >= 7 ? textCandidate : fallback;
  // accent: most saturated colour that's visibly different from the background
  const accentCandidate = palette
    .slice(1)
    .map((p) => p.hex)
    .filter((h) => colourDistance(h, background) > 60 && contrast(h, background) >= 1.8)
    .sort((a, b) => saturation(b) - saturation(a))[0];
  const accent = accentCandidate ?? (dark ? "#7FB7FF" : "#2E5BFF");
  const surface = mix(background, text, dark ? 0.08 : 0.05);
  return { background, text, accent, surface };
}

/** Picks the closest built-in template for the colours, so card styles and fonts fit the look. */
export function templateFor(colors: Colors): Design["template"] {
  const bgL = luminance(colors.background);
  const bgS = saturation(colors.background);
  const h = hue(colors.accent);
  if (bgL < 0.06 && saturation(colors.accent) > 0.3 && h >= 30 && h <= 55) return "counsel"; // navy/black with brass or gold
  if (bgS > 0.55 && bgL > 0.03 && bgL < 0.45) return "bold"; // saturated colour field
  if (bgL < 0.12) return "noir";
  if (bgL > 0.75 && bgS < 0.12) return "studio";
  if (bgL > 0.6) return "clinic";
  return "editorial";
}

export function designFromPalette(palette: { hex: string; share: number }[], base: Design): Design {
  const colors = paletteToColors(palette);
  const template = templateFor(colors);
  const spec = TEMPLATES[template];
  return { ...base, template, colors, fontHeading: spec.fontHeading, fontBody: spec.fontBody };
}

/** Readable text colour for an imported background image, from its average colour. */
export const textOn = (avgHex: string) => (luminance(avgHex) < 0.35 ? "#FFFFFF" : "#14161F");

// ---------------- template files ----------------
export const TemplateFileSchema = z.object({
  editsimple: z.literal("template"),
  version: z.literal(1),
  name: z.string().max(80).default("Imported template"),
  design: DesignSchema.omit({ logoPath: true, bgPath: true }).partial({ logoPosition: true, logoSize: true, imageMode: true, handle: true, name: true, safeInset: true }),
});
export type TemplateFile = z.infer<typeof TemplateFileSchema>;

export function exportTemplate(design: Design, name: string): TemplateFile {
  const { logoPath: _l, bgPath: _b, ...rest } = design;
  return { editsimple: "template", version: 1, name, design: rest };
}

/** Validates an uploaded template file and merges it into the current design (keeps logo & background). */
export function importTemplate(json: unknown, current: Design): { ok: true; design: Design; name: string } | { ok: false; error: string } {
  const parsed = TemplateFileSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: "This isn't an EditSimple template file." };
  return { ok: true, name: parsed.data.name, design: { ...current, ...parsed.data.design, logoPath: current.logoPath ?? null, bgPath: current.bgPath ?? null } };
}
