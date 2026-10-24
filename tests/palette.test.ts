import { describe, expect, it } from "vitest";
import {
  colourDistance, designFromPalette, exportTemplate, extractPalette, fromHex, hue, importTemplate, luminance, paletteToColors, saturation, templateFor, textOn, toHex,
} from "@/lib/palette";
import { contrast, defaultDesign } from "@/lib/themes";

/** Builds RGBA pixels: [count, r, g, b, a?] */
const pixels = (...groups: [number, number, number, number, number?][]) => {
  const out: number[] = [];
  groups.forEach(([n, r, g, b, a = 255]) => {
    for (let i = 0; i < n; i++) out.push(r, g, b, a);
  });
  return new Uint8ClampedArray(out);
};

describe("colour helpers", () => {
  it("round-trips hex", () => {
    expect(toHex(15, 124, 114)).toBe("#0F7C72");
    expect(fromHex("#0F7C72")).toEqual([15, 124, 114]);
    expect(toHex(300, -5, 12.6)).toBe("#FF000D");
  });
  it("computes hue, saturation and luminance", () => {
    expect(Math.round(hue("#FF0000"))).toBe(0);
    expect(Math.round(hue("#00FF00"))).toBe(120);
    expect(saturation("#808080")).toBe(0);
    expect(luminance("#FFFFFF")).toBeCloseTo(1);
    expect(luminance("#000000")).toBe(0);
    expect(colourDistance("#000000", "#000000")).toBe(0);
  });
});

describe("extractPalette", () => {
  it("orders colours by how much of the image they cover", () => {
    const p = extractPalette(pixels([70, 20, 24, 40], [20, 255, 111, 97], [10, 240, 240, 245]));
    expect(p[0].hex).toBe("#141828");
    expect(p[0].share).toBeCloseTo(0.7);
    expect(p.map((x) => x.hex)).toContain("#FF6F61");
  });
  it("ignores transparent pixels", () => {
    const p = extractPalette(pixels([90, 255, 0, 0, 0], [10, 0, 0, 255]));
    expect(p).toHaveLength(1);
    expect(p[0].hex).toBe("#0000FF");
  });
  it("merges near-identical shades", () => {
    const p = extractPalette(pixels([50, 100, 100, 100], [50, 111, 111, 111]));
    expect(p).toHaveLength(1);
  });
  it("returns nothing for an empty image", () => {
    expect(extractPalette(new Uint8ClampedArray())).toEqual([]);
  });
});

describe("paletteToColors", () => {
  it("always produces readable text (≥ 4.5:1)", () => {
    for (const bg of ["#141828", "#F6F1E8", "#1438FF", "#C9A45C", "#777777"]) {
      const c = paletteToColors([{ hex: bg, share: 0.8 }, { hex: "#FF6F61", share: 0.2 }]);
      expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("uses the most saturated distinct colour as the accent", () => {
    const c = paletteToColors([{ hex: "#141828", share: 0.6 }, { hex: "#EEEEF2", share: 0.3 }, { hex: "#FF6F61", share: 0.1 }]);
    expect(c.background).toBe("#141828");
    expect(c.accent).toBe("#FF6F61");
  });
  it("falls back to defaults for an empty palette", () => {
    expect(paletteToColors([])).toEqual(defaultDesign().colors);
  });
});

describe("templateFor", () => {
  it("maps colour moods to the closest built-in template", () => {
    expect(templateFor({ background: "#0F1B33", text: "#F3EEE4", accent: "#C9A45C", surface: "#17264A" })).toBe("counsel");
    expect(templateFor({ background: "#141828", text: "#FFFFFF", accent: "#FF6F61", surface: "#222222" })).toBe("noir");
    expect(templateFor({ background: "#FFFFFF", text: "#111111", accent: "#2E5BFF", surface: "#F1F3F7" })).toBe("studio");
    expect(templateFor({ background: "#1438FF", text: "#FFFFFF", accent: "#FFD84A", surface: "#0F2BD1" })).toBe("bold");
  });
  it("designFromPalette keeps the client's logo and name", () => {
    const base = { ...defaultDesign(), logoPath: "u/logo.png", name: "Dr. Hart" };
    const d = designFromPalette([{ hex: "#FFFFFF", share: 0.9 }, { hex: "#2E5BFF", share: 0.1 }], base);
    expect(d.logoPath).toBe("u/logo.png");
    expect(d.name).toBe("Dr. Hart");
    expect(d.template).toBe("studio");
  });
});

describe("branded backgrounds", () => {
  it("picks light text on dark images and dark text on light images", () => {
    expect(textOn("#101010")).toBe("#FFFFFF");
    expect(textOn("#F6F1E8")).toBe("#14161F");
  });
});

describe("template files", () => {
  const current = { ...defaultDesign("clinic"), logoPath: "u/logo.png", bgPath: "u/bg.png" };

  it("exports without private storage paths", () => {
    const file = exportTemplate(current, "Clinic look");
    expect(file).toMatchObject({ editsimple: "template", version: 1, name: "Clinic look" });
    expect("logoPath" in file.design).toBe(false);
    expect("bgPath" in file.design).toBe(false);
  });

  it("imports a valid file and keeps the current logo and background", () => {
    const file = exportTemplate(defaultDesign("counsel"), "Counsel");
    const res = importTemplate(JSON.parse(JSON.stringify(file)), current);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.design.template).toBe("counsel");
      expect(res.design.logoPath).toBe("u/logo.png");
      expect(res.design.bgPath).toBe("u/bg.png");
    }
  });

  it("rejects files that aren't EditSimple templates", () => {
    expect(importTemplate({ hello: "world" }, current)).toEqual({ ok: false, error: "This isn't an EditSimple template file." });
    expect(importTemplate({ editsimple: "template", version: 1, design: { template: "nope" } }, current).ok).toBe(false);
  });
});
