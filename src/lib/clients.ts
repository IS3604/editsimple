import type { Niche } from "@/lib/niches";
import type { MarketCode } from "@/lib/markets";
import { defaultDesign, nicheDefaultTemplate } from "@/lib/themes";
import { DesignSchema, type Design } from "@/lib/types";

/** A client of the agency (stored in brand_settings). */
export type Client = {
  id?: string;
  name: string;
  niche: Niche | null;
  specialty: string | null;
  market: MarketCode;
  audience: string | null;
  notes: string | null;
  theme: string;
  colors: Design["colors"];
  font_heading: Design["fontHeading"];
  font_body: Design["fontBody"];
  logo_path: string | null;
  bg_path: string | null;
  display_name: string | null;
  handle: string | null;
  tone: string | null;
  language: string | null;
  is_default: boolean;
};

export const clientDesign = (c: Client): Design => {
  const t = DesignSchema.shape.template.safeParse(c.theme);
  const base = defaultDesign(t.success ? t.data : "studio");
  return {
    ...base,
    colors: DesignSchema.shape.colors.safeParse(c.colors).data ?? base.colors,
    fontHeading: DesignSchema.shape.fontHeading.safeParse(c.font_heading).data ?? base.fontHeading,
    fontBody: DesignSchema.shape.fontBody.safeParse(c.font_body).data ?? base.fontBody,
    logoPath: c.logo_path,
    bgPath: c.bg_path,
    name: c.display_name ?? "",
    handle: c.handle ?? "",
  };
};
export const withDesign = (c: Client, d: Design): Client => ({
  ...c,
  theme: d.template,
  colors: d.colors,
  font_heading: d.fontHeading,
  font_body: d.fontBody,
  logo_path: d.logoPath ?? null,
  bg_path: d.bgPath ?? null,
  display_name: d.name || null,
  handle: d.handle || null,
});
export const blankClient = (niche: Niche, market: MarketCode): Client => {
  const d = defaultDesign(nicheDefaultTemplate(niche));
  return {
    name: "",
    niche,
    specialty: null,
    market,
    audience: null,
    notes: null,
    theme: d.template,
    colors: d.colors,
    font_heading: d.fontHeading,
    font_body: d.fontBody,
    logo_path: null,
    bg_path: null,
    display_name: null,
    handle: null,
    tone: "warm, clear and expert",
    language: "English",
    is_default: false,
  };
};

