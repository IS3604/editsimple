"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileJson, Frame, ImageUp, Loader2, X } from "lucide-react";
import { Button, Field, Segmented } from "@/components/ui";
import { ScaledSlide, SlideCanvas } from "@/components/slide-canvas";
import { api } from "@/lib/api-client";
import { designFromPalette, exportTemplate, extractPalette, importTemplate, textOn, toHex } from "@/lib/palette";
import type { Design } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "match" | "background" | "file";

async function pixelsOf(file: File, size = 140) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

/** Average colour of the central area (where text sits). */
function centreAverage(data: Uint8ClampedArray, w: number, h: number) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(h * 0.2); y < h * 0.8; y++)
    for (let x = Math.floor(w * 0.1); x < w * 0.9; x++) {
      const i = (y * w + x) * 4;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  return toHex(r / n, g / n, b / n);
}

export function ImportTemplateButton({ design, onApply, heading, className }: { design: Design; onApply: (d: Design) => void; heading?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <ImageUp className="h-3.5 w-3.5" />Import template
      </Button>
      {open && <ImportTemplateDialog design={design} heading={heading} onClose={() => setOpen(false)} onApply={(d) => { onApply(d); setOpen(false); }} />}
    </>
  );
}

export function ImportTemplateDialog({ design, onApply, onClose, heading }: { design: Design; onApply: (d: Design) => void; onClose: () => void; heading?: string }) {
  const [mode, setMode] = useState<Mode>("match");
  const [candidate, setCandidate] = useState<Design | null>(null);
  const [swatches, setSwatches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bgLocal, setBgLocal] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  useEffect(() => {
    setCandidate(null);
    setSwatches([]);
    setError(null);
    setBgLocal(null);
  }, [mode]);

  async function onFile(f: File) {
    setBusy(true);
    setError(null);
    try {
      if (mode === "file") {
        const res = importTemplate(JSON.parse(await f.text()), design);
        if (!res.ok) throw new Error(res.error);
        setCandidate(res.design);
        setSwatches([res.design.colors.background, res.design.colors.text, res.design.colors.accent, res.design.colors.surface]);
        return;
      }
      if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) throw new Error("Use a PNG, JPEG or WebP image.");
      if (f.size > 4 * 1024 * 1024) throw new Error("Images must be 4 MB or smaller.");
      const { data, w, h } = await pixelsOf(f);
      const palette = extractPalette(data, 6, 2);
      if (mode === "match") {
        const d = designFromPalette(palette, design);
        setCandidate({ ...d, bgPath: null });
        setSwatches(palette.map((p) => p.hex));
      } else {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("kind", "upload");
        const { path } = await api<{ path: string }>("/api/uploads", { method: "POST", body: fd });
        const avg = centreAverage(data, w, h);
        const text = textOn(avg);
        const accent = palette.find((p) => p.hex !== palette[0].hex)?.hex ?? design.colors.accent;
        setBgLocal(URL.createObjectURL(f));
        setCandidate({ ...design, bgPath: path, safeInset: design.safeInset ?? 40, colors: { ...design.colors, text, accent, background: palette[0]?.hex ?? design.colors.background } });
        setSwatches(palette.map((p) => p.hex));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    const blob = new Blob([JSON.stringify(exportTemplate(design, "EditSimple template"), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "editsimple-template.json";
    a.click();
  }

  const OPTIONS: { v: Mode; title: string; text: string; icon: typeof Frame }[] = [
    { v: "match", title: "Match a design", text: "Upload a screenshot of a post you like. We copy its colours and pick the closest layout.", icon: ImageUp },
    { v: "background", title: "Branded background", text: "Upload the client's slide background (1080×1350). Copy is set on top of it on every slide.", icon: Frame },
    { v: "file", title: "Template file", text: "Open a .json template exported from EditSimple — share looks across your team.", icon: FileJson },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(15_18_30/.45)] p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal aria-label="Import template" className="w-full max-w-3xl animate-scale-in overflow-hidden rounded-2xl bg-card shadow-[0_40px_80px_-30px_rgb(15_18_30/.6)]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-[16px]">Import a template</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {OPTIONS.map((o) => (
                <button
                  key={o.v}
                  onClick={() => setMode(o.v)}
                  className={cn("rounded-xl border p-3 text-left transition-colors", mode === o.v ? "border-accent bg-[hsl(var(--accent-soft))]" : "hover:border-foreground/25")}
                >
                  <o.icon className={cn("h-4 w-4", mode === o.v ? "text-accent" : "text-muted-foreground")} />
                  <p className="mt-2 text-[13px] font-medium">{o.title}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{o.text}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
              className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-background/60 text-[13px] text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageUp className="h-5 w-5" />}
              {busy ? "Reading…" : mode === "file" ? "Drop a .json template or click to choose" : "Drop an image or click to choose"}
            </button>
            <input
              ref={input}
              type="file"
              hidden
              accept={mode === "file" ? "application/json,.json" : "image/png,image/jpeg,image/webp"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = "";
              }}
            />
            {error && <p className="text-[13px] text-rose-700">{error}</p>}

            {swatches.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Colours found</p>
                <div className="flex gap-1.5">{swatches.map((c) => <span key={c} title={c} className="h-7 w-7 rounded-lg ring-1 ring-black/10" style={{ background: c }} />)}</div>
              </div>
            )}

            {candidate && mode === "background" && (
              <Field label={`Text margin ${candidate.safeInset ?? 40}px`} hint="Increase it if the background has a border, logo or frame near the edges.">
                <input type="range" min={0} max={160} step={4} value={candidate.safeInset ?? 40} onChange={(e) => setCandidate({ ...candidate, safeInset: Number(e.target.value) })} className="w-full accent-[hsl(var(--accent))]" />
              </Field>
            )}
            {candidate && mode === "background" && (
              <Field label="Text colour">
                <Segmented
                  size="sm"
                  value={candidate.colors.text.toUpperCase() === "#FFFFFF" ? "light" : "dark"}
                  onChange={(v) => setCandidate({ ...candidate, colors: { ...candidate.colors, text: v === "light" ? "#FFFFFF" : "#14161F" } })}
                  options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]}
                />
              </Field>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Preview</p>
            <div className="overflow-hidden rounded-xl ring-1 ring-border">
              <ScaledSlide width={220} size="1080x1350">
                <SlideCanvas
                  slide={{ id: "import-preview", kind: "hook", role: "hook", kicker: "", heading: heading || "Your cover line here", body: "", layout: "center", style: {}, background_path: null }}
                  design={candidate && bgLocal ? { ...candidate, bgPath: bgLocal } : candidate ?? design}
                  size="1080x1350"
                  index={0}
                  total={6}
                  bgUrl={null}
                  logoUrl={null}
                />
              </ScaledSlide>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t bg-background/60 px-6 py-4">
          <button onClick={download} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
            <Download className="h-3.5 w-3.5" />Export current look as a file
          </button>
          <div className="flex gap-2">
            {design.bgPath && (
              <Button variant="ghost" size="sm" onClick={() => onApply({ ...design, bgPath: null })}>Remove branded background</Button>
            )}
            <Button variant="accent" size="sm" disabled={!candidate} onClick={() => candidate && onApply(candidate)}>Apply template</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
