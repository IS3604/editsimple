import { describe, expect, it } from "vitest";
import { BriefInputSchema, DesignSchema } from "@/lib/types";
import { enforceStructure } from "@/lib/structure";
import { captionPrompt, contentPrompt, editorPrompt, structureFor, systemFor, ContentSchema, SlideCopySchema, SuggestBriefSchema } from "@/lib/ai/prompts";
import { MARKETS, marketOf } from "@/lib/markets";
import { NICHES, nicheOf, rulesFor } from "@/lib/niches";
import { contrast, defaultDesign, isDark, migrateDesign, TEMPLATES } from "@/lib/themes";
import { formatNumber, median, slugHashtag } from "@/lib/utils";

const brief = (over: Record<string, unknown> = {}) => ({ niche: "legal", topic: "What to do after a car accident", platform: "instagram", slideCount: 5, objective: "education", design: defaultDesign(), ...over });

describe("brief validation", () => {
  it("accepts 1 to 7 slides", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(BriefInputSchema.safeParse(brief({ slideCount: n })).success).toBe(true);
  });
  it("rejects 0 or 8 slides", () => {
    expect(BriefInputSchema.safeParse(brief({ slideCount: 0 })).success).toBe(false);
    expect(BriefInputSchema.safeParse(brief({ slideCount: 8 })).success).toBe(false);
  });
  it("coerces a numeric string from forms", () => {
    expect(BriefInputSchema.parse(brief({ slideCount: "3" })).slideCount).toBe(3);
  });
  it("defaults the market to the US and rejects unknown markets", () => {
    expect(BriefInputSchema.parse(brief()).market).toBe("US");
    expect(BriefInputSchema.safeParse(brief({ market: "XX" })).success).toBe(false);
  });
  it("accepts a branded background on the design", () => {
    expect(DesignSchema.parse({ ...defaultDesign(), bgPath: "u/bg.png", safeInset: 60 }).bgPath).toBe("u/bg.png");
  });
});

describe("slide structure", () => {
  const deck = (...k: string[]) => k.map((kind) => ({ kind })) as { kind: any }[];
  it("a single-image post never becomes a cover or CTA", () => {
    expect(enforceStructure(deck("hook"))[0].kind).toBe("statement");
    expect(enforceStructure(deck("checklist"))[0].kind).toBe("checklist");
  });
  it("two slides = cover + payoff", () => {
    expect(enforceStructure(deck("list", "cta")).map((s) => s.kind)).toEqual(["hook", "statement"]);
  });
  it("three or more slides open with a cover and close with a CTA", () => {
    expect(enforceStructure(deck("list", "steps", "list")).map((s) => s.kind)).toEqual(["hook", "steps", "cta"]);
    expect(enforceStructure(deck("statement", "list", "myth_fact", "checklist", "steps", "highlight", "list")).map((s) => s.kind).at(-1)).toBe("cta");
  });
  it("prompt structure matches the count", () => {
    expect(structureFor(1)).toMatch(/SINGLE-IMAGE/);
    expect(structureFor(2)).toMatch(/2-slide/);
    expect(structureFor(3)).toMatch(/3-slide/);
    expect(structureFor(7)).toMatch(/hook/);
  });
  it("model output with one slide is valid", () => {
    expect(
      ContentSchema.safeParse({
        strategy: { angle: "a", audience_insight: "b", visual_direction: "c" },
        slides: [{ kind: "checklist", heading: "Five signs", items: [{ title: "x", text: "y" }] }],
      }).success
    ).toBe(true);
  });
  it("unknown slide kinds fall back to a single point", () => {
    expect(SlideCopySchema.parse({ kind: "carousel-ish", heading: "Hi there" }).kind).toBe("statement");
  });
  it("suggested slide counts are clamped to 1–7", () => {
    expect(SuggestBriefSchema.parse({ sharper_topic: "t", audiences: [], tone: "x", keywords: [], hooks: [], tip: "", slide_count: 12 }).slide_count).toBe(6);
  });
});

describe("international, agency-aware prompts", () => {
  it("uses the client's market rules and spelling", () => {
    const uk = systemFor("legal", "UK");
    expect(uk).toMatch(/United Kingdom/);
    expect(uk).toMatch(/SRA/);
    expect(uk).toMatch(/UK English/);
    expect(systemFor("medical", "AU")).toMatch(/AHPRA/);
    expect(systemFor("legal", "US")).toMatch(/ABA Model Rules/);
    expect(systemFor("legal", "IN")).toMatch(/Bar Council of India/);
  });
  it("never applies Indian rules to international clients", () => {
    for (const m of ["US", "UK", "CA", "AU", "AE", "SG", "GLOBAL"] as const) expect(systemFor("legal", m)).not.toMatch(/Bar Council of India/);
  });
  it("writes as an agency on behalf of the client", () => {
    expect(systemFor("medical", "US")).toMatch(/agency/);
    const p = contentPrompt({
      niche: "medical", market: "CA", specialty: "Dermatology", topic: "Sunscreen myths", audience: "", objective: "education", tone: "warm",
      language: "English", platform: "instagram", slideCount: 1, keywords: ["spf"], templateLabel: "Studio", clientName: "Dr. Lee", clientNotes: "Never mention pricing",
    });
    expect(p).toMatch(/Dr\. Lee/);
    expect(p).toMatch(/Never mention pricing/);
    expect(p).toMatch(/Canada/);
    expect(p).toMatch(/SINGLE-IMAGE/);
    expect(p).toMatch(/Return exactly 1 slide/);
  });
  it("the editor pass and caption carry compliance and the disclaimer", () => {
    expect(editorPrompt("{}", "legal", "UK")).toMatch(/SRA/);
    const c = captionPrompt({ niche: "legal", market: "US", platform: "instagram", topic: "t", audience: "", objective: "education", tone: "", language: "English", slides: [], keywords: [], hashtagIdeas: [] });
    expect(c).toContain(NICHES.legal.disclaimer);
    expect(c).toMatch(/ABA/);
  });
  it("market helpers", () => {
    expect(marketOf("UK")).toBe("UK");
    expect(marketOf("mars")).toBe("US");
    expect(marketOf(null)).toBe("US");
    expect(rulesFor("medical", "UK").currency).toBe(MARKETS.UK.currency);
    expect(nicheOf("legal")).toBe("legal");
    expect(nicheOf("anything")).toBe("medical");
  });
});

describe("templates and themes", () => {
  it("every template has readable text", () => {
    for (const [k, t] of Object.entries(TEMPLATES)) expect(contrast(t.colors.text, t.colors.background), k).toBeGreaterThanOrEqual(4.5);
  });
  it("no template uses the retired serif face", () => {
    for (const t of Object.values(TEMPLATES)) expect(t.fontHeading).not.toBe("instrument");
  });
  it("detects dark colours", () => {
    expect(isDark("#0F1B33")).toBe(true);
    expect(isDark("#F2FAF8")).toBe(false);
  });
  it("migrates pre-v2 designs", () => {
    expect(migrateDesign({ theme: "luxury", handle: "@x" })?.template).toBe("counsel");
    expect(migrateDesign({ template: "studio" })).toBeNull();
    expect(migrateDesign(null)).toBeNull();
  });
});

describe("utils", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("hashtags", () => {
    expect(slugHashtag("tenant rights in London!")).toBe("#tenantRightsInLondon");
    expect(slugHashtag("   ")).toBe("");
  });
  it("compact numbers", () => {
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(null)).toBe("—");
  });
});
