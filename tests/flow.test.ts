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

describe("slide export", () => {
  it("caches images per full URL, so each post keeps its own background and logo", async () => {
    const { opts } = await import("@/lib/export");
    expect(opts(1080, 1350).includeQueryParams).toBe(true);
  });
});

describe("slide plans follow the kind of topic", () => {
  it("plans an A vs B post as: cover, what is A, what is B, key differences, …, CTA", async () => {
    const { slidePlan, topicShape, comparisonSides } = await import("@/lib/ai/prompts");
    expect(topicShape("Botox vs fillers")).toBe("comparison");
    expect(comparisonSides("Botox vs dermal fillers")).toEqual(["Botox", "dermal fillers"]);
    const p = slidePlan("Botox vs dermal fillers", 6);
    expect(p).toHaveLength(6);
    expect(p[0]).toMatch(/^hook/);
    expect(p[1]).toContain("WHAT IS BOTOX");
    expect(p[2]).toContain("WHAT IS DERMAL FILLERS");
    expect(p[3]).toMatch(/KEY DIFFERENCES/);
    expect(p[5]).toMatch(/^cta/);
  });

  it("recognises other shapes and fits any length", async () => {
    const { slidePlan, topicShape } = await import("@/lib/ai/prompts");
    expect(topicShape("How to prepare for laser hair removal")).toBe("how_to");
    expect(topicShape("5 signs your skincare is too harsh")).toBe("list");
    expect(topicShape("Myths about sunscreen")).toBe("myths");
    expect(topicShape("What is microneedling")).toBe("explainer");
    for (let n = 1; n <= 7; n++) expect(slidePlan("Botox or filler?", n)).toHaveLength(n);
    expect(slidePlan("What is microneedling", 4)[1]).toMatch(/WHAT IT IS/);
  });
});

describe("slide design", () => {
  it("highlights *starred* words in headings and strips the stars elsewhere", async () => {
    const { emphasisParts, plainHeading } = await import("@/components/slide-canvas");
    expect(emphasisParts("Botox *relaxes muscles*, fillers *add volume*")).toEqual([
      { t: "Botox ", em: false }, { t: "relaxes muscles", em: true }, { t: ", fillers ", em: false }, { t: "add volume", em: true },
    ]);
    expect(emphasisParts("No stars here")).toEqual([{ t: "No stars here", em: false }]);
    expect(emphasisParts("Broken *star")).toEqual([{ t: "Broken star", em: false }]);
    expect(plainHeading("Save this for your *next consult*")).toBe("Save this for your next consult");
  });

  it("every slide gets a sensible icon even when the writer didn't pick one", async () => {
    const { defaultIcon, SLIDE_ICONS } = await import("@/lib/slide-icons");
    expect(defaultIcon("statement", "How long does Botox last")).toBe("clock");
    expect(defaultIcon("myth_fact", "Will I look frozen")).toBe("question");
    for (const k of ["list", "steps", "checklist", "highlight", "cta", "statement"]) expect(SLIDE_ICONS[defaultIcon(k)]).toBeTruthy();
  });
});

describe("posts for doctors (B2B) as well as patients", () => {
  it("switches readers, news and formats to the professionals", async () => {
    const { nicheFor, audienceTypeOf } = await import("@/lib/niches");
    const { systemFor, trendIdeasPrompt, ideasPrompt, contentPrompt } = await import("@/lib/ai/prompts");
    expect(audienceTypeOf("pros")).toBe("pros");
    expect(audienceTypeOf("x")).toBe("public");
    const pro = nicheFor("medical", "pros");
    expect(pro.newsQueries.join(" ").toLowerCase()).toContain("med spa");
    expect(pro.audiences[0]).toMatch(/practice/i);
    expect(systemFor("medical", "US", "pros")).toContain("professionals, not their patients");
    expect(systemFor("medical", "US")).toContain("ordinary people");
    expect(trendIdeasPrompt("medical", "US", [{ title: "t", source: "s" }], "pros")).toContain("and their practices");
    expect(ideasPrompt({ niche: "medical", market: "US", specialty: "", audience: "", headlines: [], audienceType: "pros" })).toContain("Mistakes practices make");
    const base = { niche: "medical" as const, market: "US" as const, specialty: "", topic: "YouTube for med spas", audience: "", objective: "education", tone: "", language: "English", platform: "instagram", slideCount: 5, keywords: [], templateLabel: "Studio" };
    expect(contentPrompt({ ...base, audienceType: "pros" })).toContain("write like a sharp colleague");
    expect(contentPrompt(base)).toContain("smart 14-year-old");
  });
});
