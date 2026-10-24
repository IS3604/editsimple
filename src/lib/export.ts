"use client";
import { toBlob, toJpeg, toPng } from "html-to-image";

async function ready(node: HTMLElement) {
  await document.fonts.ready;
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); })))
  );
}

/** First family name of a CSS font-family list, unquoted. */
export const primaryFamily = (ff: string) => ff.split(",")[0].trim().replace(/^['"]|['"]$/g, "");

/** Families actually used inside a node. */
export function usedFamilies(node: HTMLElement) {
  const set = new Set<string>();
  [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))].forEach((el) => set.add(primaryFamily(getComputedStyle(el).fontFamily)));
  return set;
}

const dataUrlCache = new Map<string, Promise<string>>();
const toDataUrl = (url: string) => {
  if (!dataUrlCache.has(url))
    dataUrlCache.set(
      url,
      fetch(url)
        .then((r) => r.blob())
        .then((b) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); }))
    );
  return dataUrlCache.get(url)!;
};

/**
 * Builds @font-face CSS for only the fonts this slide uses, with files inlined.
 * Without this, html-to-image embeds every loaded font (16 families) into every exported slide.
 */
async function fontCSSFor(node: HTMLElement) {
  const wanted = usedFamilies(node);
  const blocks: Promise<string>[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      if (!wanted.has(primaryFamily(rule.style.getPropertyValue("font-family")))) continue;
      const base = sheet.href ?? location.href;
      const css = rule.cssText;
      blocks.push(
        (async () => {
          let out = css;
          for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
            if (m[1].startsWith("data:")) continue;
            out = out.replace(m[0], `url("${await toDataUrl(new URL(m[1], base).href)}")`);
          }
          return out;
        })()
      );
    }
  }
  return (await Promise.all(blocks)).join("\n");
}

const opts = (w: number, h: number, fontEmbedCSS?: string) => ({
  width: w,
  height: h,
  pixelRatio: 1, // node is already at native 1080px size
  cacheBust: true,
  style: { transform: "none" },
  ...(fontEmbedCSS !== undefined ? { fontEmbedCSS } : {}),
});

export async function renderPng(node: HTMLElement, w: number, h: number): Promise<Blob> {
  await ready(node);
  const css = await fontCSSFor(node).catch(() => undefined);
  // first pass warms font/image embedding in some browsers (Safari) — the second is the keeper
  await toPng(node, opts(w, h, css)).catch(() => undefined);
  const blob = await toBlob(node, opts(w, h, css));
  if (!blob) throw new Error("Render failed");
  return blob;
}

export async function renderJpegDataUrl(node: HTMLElement, w: number, h: number) {
  await ready(node);
  const css = await fontCSSFor(node).catch(() => undefined);
  return toJpeg(node, { ...opts(w, h, css), quality: 0.95, backgroundColor: "#ffffff" });
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function zipSlides(files: { name: string; blob: Blob }[], zipName: string) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  saveBlob(await zip.generateAsync({ type: "blob" }), zipName);
}

export async function pdfSlides(pngs: Blob[], w: number, h: number, filename: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: h >= w ? "portrait" : "landscape", unit: "px", format: [w, h], hotfixes: ["px_scaling"], compress: true });
  for (let i = 0; i < pngs.length; i++) {
    if (i > 0) pdf.addPage([w, h], h >= w ? "portrait" : "landscape");
    const data = new Uint8Array(await pngs[i].arrayBuffer());
    pdf.addImage(data, "PNG", 0, 0, w, h, undefined, "FAST");
  }
  pdf.save(filename);
}

export const safeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "carousel";
