import type { Colors, Design } from "@/lib/types";

export const FONT_VARS: Record<string, string> = {
  display: "var(--font-display)",
  sans: "var(--font-sans)",
  serif: "var(--font-serif)",
};

type ThemePreset = { colors: Colors; fontHeading: Design["fontHeading"]; fontBody: Design["fontBody"]; overlay: number; label: string };

export const THEME_PRESETS: Record<Design["theme"], ThemePreset> = {
  minimalist: { label: "Minimalist", colors: { primary: "#111111", accent: "#FF5A36", background: "#F6F3EE", text: "#111111" }, fontHeading: "display", fontBody: "sans", overlay: 0 },
  editorial: { label: "Editorial", colors: { primary: "#1B1B1B", accent: "#B4472F", background: "#EFE9DF", text: "#1B1B1B" }, fontHeading: "serif", fontBody: "sans", overlay: 0 },
  bold: { label: "Bold", colors: { primary: "#0B0B0B", accent: "#E8FF3A", background: "#2F2BFF", text: "#FFFFFF" }, fontHeading: "display", fontBody: "sans", overlay: 0.15 },
  luxury: { label: "Luxury", colors: { primary: "#C9A86A", accent: "#C9A86A", background: "#121110", text: "#F4EFE6" }, fontHeading: "serif", fontBody: "sans", overlay: 0.45 },
  corporate: { label: "Corporate", colors: { primary: "#0A2A5E", accent: "#1F7AE0", background: "#F4F7FB", text: "#0B1B33" }, fontHeading: "sans", fontBody: "sans", overlay: 0 },
  dark: { label: "Dark", colors: { primary: "#FFFFFF", accent: "#7CFFB2", background: "#0E0F12", text: "#F2F2F2" }, fontHeading: "display", fontBody: "sans", overlay: 0.5 },
  colorful: { label: "Colorful", colors: { primary: "#1A1033", accent: "#FF3D7F", background: "#FFD23F", text: "#1A1033" }, fontHeading: "display", fontBody: "sans", overlay: 0.1 },
};

export const defaultDesign = (theme: Design["theme"] = "minimalist"): Design => ({
  theme,
  colors: THEME_PRESETS[theme].colors,
  fontHeading: THEME_PRESETS[theme].fontHeading,
  fontBody: THEME_PRESETS[theme].fontBody,
  logoPath: null,
  logoPosition: "bottom-right",
  logoSize: 110,
  handle: "",
  imageMode: "per-slide",
});

/** WCAG relative luminance contrast ratio — used to warn about unreadable colour pairs. */
export function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
