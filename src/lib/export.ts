"use client";
import { toBlob, toJpeg, toPng } from "html-to-image";

async function ready(node: HTMLElement) {
  await document.fonts.ready;
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); })))
  );
}

const opts = (w: number, h: number) => ({
  width: w,
  height: h,
  pixelRatio: 1, // node is already at native 1080px size
  cacheBust: true,
  style: { transform: "none" },
});

export async function renderPng(node: HTMLElement, w: number, h: number): Promise<Blob> {
  await ready(node);
  // first pass warms font/image embedding in some browsers (Safari) — the second is the keeper
  await toPng(node, opts(w, h)).catch(() => undefined);
  const blob = await toBlob(node, opts(w, h));
  if (!blob) throw new Error("Render failed");
  return blob;
}

export async function renderJpegDataUrl(node: HTMLElement, w: number, h: number) {
  await ready(node);
  return toJpeg(node, { ...opts(w, h), quality: 0.95, backgroundColor: "#ffffff" });
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
