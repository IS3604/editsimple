import { describe, expect, it } from "vitest";
import { contentPrompt, editorPrompt, keywordFocus, regenerateSlidePrompt } from "@/lib/ai/prompts";
import { safeNext } from "@/lib/auth-paths";
import { NICHES } from "@/lib/niches";

describe("posts follow the keywords the editor ticks", () => {
  it("makes a single chosen keyword the subject, with the topic only as background", () => {
    const f = keywordFocus("skincare tips", ["botox for forehead lines"]);
    expect(f.subject).toBe("botox for forehead lines");
    expect(f.line).toContain('"botox for forehead lines"');
    expect(f.line).toContain("Do not switch the subject");
    expect(f.line).toContain("Background (context only, not the subject): skincare tips");
  });

  it("uses the topic when nothing is ticked, and skips the background line when the topic is ticked", () => {
    expect(keywordFocus("lip filler", []).line).toBe("Topic: lip filler");
    expect(keywordFocus("Lip filler", ["lip filler"]).line).not.toContain("Background");
  });

  it("puts the focus into the writer, editor and slide prompts", () => {
    const base = { niche: "medical" as const, market: "US" as const, specialty: "", topic: "skincare", audience: "", objective: "education", tone: "warm", language: "English", platform: "instagram", slideCount: 5, templateLabel: "Studio" };
    const p = contentPrompt({ ...base, keywords: ["laser hair removal cost"] });
    expect(p).toContain("TARGET KEYWORD chosen by the editor");
    expect(p).toContain('"laser hair removal cost"');
    expect(p).not.toContain("Keywords to weave in naturally");
    expect(editorPrompt("{}", "medical", "US", ["laser hair removal cost"])).toContain("must stay about the editor's chosen keyword");
    expect(regenerateSlidePrompt({ ...base, keywords: ["laser hair removal cost"], position: 1, total: 5, kind: "list", current: "", neighbours: "" })).toContain('post on "laser hair removal cost"');
  });
});

describe("aesthetic niche", () => {
  it("searches news for dermatology, plastic surgery, med spas and injectables — not general health", () => {
    const q = NICHES.medical.newsQueries.join(" ").toLowerCase();
    for (const w of ["dermatolog", "plastic surg", "med spa", "botox"]) expect(q).toContain(w);
    expect(q).not.toContain("outbreak");
    expect(NICHES.medical.specialties).toContain("Med spa");
  });
});

describe("auth redirects", () => {
  it("only allows same-site paths in ?next=", () => {
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});
