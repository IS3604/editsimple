"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, Copy, Download, FileText, ImageIcon, ImagePlus, Loader2, Plus, RefreshCw, Trash2, Wand2,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ErrorBanner, Field, Input, Progress, Select, Skeleton, Spinner, Textarea } from "@/components/ui";
import { ColorControls, FontControls, LogoControls, ThemePicker } from "@/components/design-controls";
import { ScaledSlide, SlideCanvas, dims, type SlideSize } from "@/components/slide-canvas";
import { api } from "@/lib/api-client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { assetUrlClient } from "@/lib/asset-url";
import { pdfSlides, renderJpegDataUrl, renderPng, safeName, saveBlob, zipSlides } from "@/lib/export";
import { defaultDesign } from "@/lib/themes";
import { DesignSchema, STAGES, type Design, type Slide } from "@/lib/types";
import { cn } from "@/lib/utils";

type Project = {
  id: string; title: string; platform: "instagram" | "linkedin" | "both"; slide_count: number; size: SlideSize;
  design: Design; stage: number; status: "draft" | "generating" | "ready" | "failed"; stage_error: string | null;
};
type Caption = { platform: "instagram" | "linkedin"; body: string; hashtags: string[] };
type Bundle = { project: Project; brief: any; slides: Slide[]; captions: Caption[] };

const isNew = (id: string) => id.startsWith("new-");
const stripForSave = (s: Slide) => ({
  ...(isNew(s.id) ? {} : { id: s.id }),
  role: s.role, kicker: s.kicker, heading: s.heading, body: s.body, visual_prompt: s.visual_prompt,
  layout: s.layout, background_path: s.background_path, style: s.style ?? {},
});

/** project.stage → index of the STAGES step currently running/next */
const stageIndex = (stage: number) => (stage < 1 ? 0 : stage < 3 ? 1 : stage < 4 ? 3 : stage < 5 ? 4 : stage < 6 ? 5 : stage < 7 ? 6 : 7);

export function CarouselEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [design, setDesign] = useState<Design>(defaultDesign());
  const [sel, setSel] = useState(0);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runStage, setRunStage] = useState<number | null>(null);
  const [visualProgress, setVisualProgress] = useState<string>("");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [busySlide, setBusySlide] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"slide" | "design">("slide");
  const exportRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const startedRef = useRef(false);
  const slidesRef = useRef<Slide[]>([]);
  const designRef = useRef<Design>(design);
  slidesRef.current = slides;
  designRef.current = design;

  const load = useCallback(async () => {
    try {
      const b = await api<Bundle>(`/api/projects/${projectId}`);
      setBundle(b);
      setSlides(b.slides);
      const parsed = DesignSchema.safeParse(b.project.design);
      setDesign(parsed.success ? parsed.data : defaultDesign());
      return b;
    } catch (e) {
      setLoadErr((e as Error).message);
      return null;
    }
  }, [projectId]);

  useEffect(() => {
    load().then((b) => {
      if (!b || startedRef.current) return;
      if (params.get("generate") === "1" && b.project.stage < 7) {
        startedRef.current = true;
        router.replace(`/projects/${projectId}`);
        runPipeline(b);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // ---------- autosave (text/style/design edits) ----------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(async () => {
    setSaveState("saving");
    try {
      const deck = slidesRef.current;
      await Promise.all([
        api(`/api/projects/${projectId}/slides`, { method: "PUT", json: { slides: deck.map(stripForSave) } }),
        api(`/api/projects/${projectId}`, { method: "PATCH", json: { design: designRef.current } }),
      ]);
      setSaveState("saved");
    } catch (e) {
      setSaveState("dirty");
      setError(`Autosave failed: ${(e as Error).message}`);
    }
  }, [projectId]);
  const markDirty = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 1200);
  }, [persist]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (saveState !== "saved") e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlides((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    markDirty();
  };
  const updateDesign = (d: Design) => { setDesign(d); markDirty(); };

  /** Structural changes (add/delete/reorder) save immediately and take server ids. */
  async function saveDeck(next: Slide[], selectIndex?: number) {
    setSaveState("saving");
    setError(null);
    try {
      const { slides: saved } = await api<{ slides: Slide[] }>(`/api/projects/${projectId}/slides`, { method: "PUT", json: { slides: next.map(stripForSave) } });
      setSlides(saved);
      if (selectIndex != null) setSel(Math.max(0, Math.min(saved.length - 1, selectIndex)));
      setSaveState("saved");
    } catch (e) {
      setError((e as Error).message);
      setSaveState("dirty");
    }
  }

  // ---------- pipeline ----------
  const waitForRender = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300))));

  async function renderAll(deck: Slide[]) {
    const { w, h } = dims(bundle?.project.size ?? "1080x1350");
    await waitForRender();
    const out: { slide: Slide; blob: Blob }[] = [];
    for (const s of deck) {
      const node = exportRefs.current[s.id];
      if (!node) throw new Error("Slide not mounted for rendering");
      out.push({ slide: s, blob: await renderPng(node, w, h) });
    }
    return out;
  }

  /** Uploads straight to Supabase Storage (own-folder RLS) — avoids Vercel's 4.5 MB body limit. */
  async function uploadRenders(rendered: { slide: Slide; blob: Blob }[]) {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("Signed out — please sign in again");
    const stamp = Date.now();
    const items = await Promise.all(
      rendered.map(async (r) => {
        const path = `${data.user!.id}/projects/${projectId}/renders/${r.slide.id}-${stamp}.png`;
        const { error } = await sb.storage.from("editsimple").upload(path, r.blob, { contentType: "image/png", upsert: true });
        if (error) throw new Error(`Saving render failed: ${error.message}`);
        return { slideId: r.slide.id, path };
      })
    );
    await api(`/api/projects/${projectId}/renders`, { method: "POST", json: { items } });
  }

  async function runPipeline(start?: Bundle) {
    const b = start ?? bundle;
    if (!b) return;
    setRunning(true);
    setError(null);
    let stage = b.project.stage;
    let deck = start ? b.slides : slidesRef.current;
    const d = designRef.current ?? b.project.design;
    const patchStage = (s: number, status: Project["status"] = "generating") =>
      api(`/api/projects/${projectId}`, { method: "PATCH", json: { stage: s, status, stage_error: null } });
    try {
      if (stage < 3) {
        setRunStage(1);
        const r = await api<{ slides: Slide[] }>(`/api/projects/${projectId}/content`, { method: "POST", json: {} });
        setRunStage(2);
        deck = r.slides.sort((a, c) => a.position - c.position);
        setSlides(deck);
        stage = 3;
      }
      if (stage < 4) {
        setRunStage(3);
        const mode = d.imageMode ?? "per-slide";
        const targets = mode === "none" ? [] : deck.filter((s, i) => !s.background_path && (mode === "per-slide" || i === 0));
        let done = 0;
        const failures: string[] = [];
        // small concurrency to respect provider rate limits
        const queue = [...targets];
        const worker = async () => {
          while (queue.length) {
            const s = queue.shift()!;
            try {
              const { slide } = await api<{ slide: Slide }>(`/api/projects/${projectId}/slides/${s.id}/background`, { method: "POST", json: {} });
              deck = deck.map((x) => (x.id === slide.id ? slide : x));
              setSlides(deck);
            } catch (e) {
              failures.push((e as Error).message);
            }
            setVisualProgress(`${++done}/${targets.length}`);
          }
        };
        await Promise.all([worker(), worker()]);
        if (failures.length === targets.length && targets.length) throw new Error(`Image generation failed: ${failures[0]}`);
        if (failures.length) setError(`${failures.length} visual(s) failed — slides keep the designed background. You can retry per slide. (${failures[0]})`);
        await patchStage(4);
        stage = 4;
      }
      if (stage < 5) {
        setRunStage(4);
        await uploadRenders(await renderAll(deck));
        await patchStage(5);
        stage = 5;
      }
      if (stage < 6) {
        setRunStage(5);
        const plats: Caption["platform"][] = b.project.platform === "both" ? ["instagram", "linkedin"] : [b.project.platform];
        for (const p of plats) await api(`/api/projects/${projectId}/caption`, { method: "POST", json: { platform: p } });
        stage = 6;
      }
      setRunStage(6);
      await patchStage(7, "ready");
      setRunStage(7);
      await load();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      await api(`/api/projects/${projectId}`, { method: "PATCH", json: { status: "failed", stage_error: msg.slice(0, 480) } }).catch(() => undefined);
      await load();
    } finally {
      setRunning(false);
      setVisualProgress("");
    }
  }

  // ---------- per-slide actions ----------
  async function regenerateCopy(s: Slide, instruction?: string) {
    if (isNew(s.id)) return;
    setBusySlide(s.id);
    setError(null);
    try {
      if (saveState !== "saved") await persist();
      const { slide } = await api<{ slide: Slide }>(`/api/projects/${projectId}/slides/${s.id}/regenerate`, { method: "POST", json: { instruction } });
      setSlides((xs) => xs.map((x) => (x.id === slide.id ? slide : x)));
    } catch (e) { setError((e as Error).message); } finally { setBusySlide(null); }
  }

  async function newBackground(s: Slide, file?: File) {
    setBusySlide(s.id);
    setError(null);
    try {
      if (saveState !== "saved") await persist();
      const init: RequestInit & { json?: unknown } = file
        ? { method: "POST", body: (() => { const fd = new FormData(); fd.append("file", file); return fd; })() }
        : { method: "POST", json: { prompt: s.visual_prompt ?? undefined } };
      const { slide } = await api<{ slide: Slide }>(`/api/projects/${projectId}/slides/${s.id}/background`, init);
      setSlides((xs) => xs.map((x) => (x.id === slide.id ? slide : x)));
    } catch (e) { setError((e as Error).message); } finally { setBusySlide(null); }
  }

  async function removeBackground(s: Slide) {
    updateSlide(s.id, { background_path: null });
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    saveDeck(next, j);
  }
  function addSlide(after: number) {
    if (slides.length >= 10) return setError("Max 10 slides");
    const blank: Slide = {
      id: `new-${crypto.randomUUID()}`, project_id: projectId, position: after + 1, role: "insight", kicker: "", heading: "New slide",
      body: "Add your point here.", visual_prompt: null, layout: "top", background_path: null, style: {}, render_path: null,
    };
    const next = [...slides];
    next.splice(after + 1, 0, blank);
    saveDeck(next, after + 1);
  }
  function deleteSlide(i: number) {
    if (slides.length <= 3) return setError("Keep at least 3 slides");
    saveDeck(slides.filter((_, k) => k !== i), Math.min(i, slides.length - 2));
  }

  // ---------- export ----------
  async function exportAs(kind: "png-zip" | "jpeg-zip" | "pdf" | "single") {
    if (!bundle) return;
    setExporting(kind);
    setError(null);
    try {
      if (saveState !== "saved") await persist();
      const { w, h } = dims(bundle.project.size);
      const base = safeName(bundle.project.title);
      if (kind === "single") {
        const s = slides[sel];
        const blob = await renderPng(exportRefs.current[s.id]!, w, h);
        saveBlob(blob, `${base}-${String(sel + 1).padStart(2, "0")}.png`);
        return;
      }
      if (kind === "jpeg-zip") {
        const files = [];
        await waitForRender();
        for (let i = 0; i < slides.length; i++) {
          const dataUrl = await renderJpegDataUrl(exportRefs.current[slides[i].id]!, w, h);
          files.push({ name: `${base}-${String(i + 1).padStart(2, "0")}.jpg`, blob: await (await fetch(dataUrl)).blob() });
        }
        await zipSlides(files, `${base}-jpg.zip`);
        return;
      }
      const rendered = await renderAll(slides);
      uploadRenders(rendered).catch(() => undefined); // keep stored renders in sync with what was downloaded
      if (kind === "png-zip") await zipSlides(rendered.map((r, i) => ({ name: `${base}-${String(i + 1).padStart(2, "0")}.png`, blob: r.blob })), `${base}.zip`);
      else await pdfSlides(rendered.map((r) => r.blob), w, h, `${base}.pdf`);
    } catch (e) { setError(`Export failed: ${(e as Error).message}`); } finally { setExporting(null); }
  }

  const onFit = useCallback((info: { id: string; overflow: boolean }) => {
    setOverflow((o) => (o[info.id] === info.overflow ? o : { ...o, [info.id]: info.overflow }));
  }, []);

  const logoUrl = useMemo(() => assetUrlClient(design.logoPath), [design.logoPath]);

  if (loadErr) return <ErrorBanner error={loadErr} onRetry={() => { setLoadErr(null); load(); }} />;
  if (!bundle) return <div className="grid h-64 place-items-center"><Spinner className="h-8 w-8" /></div>;

  const { project } = bundle;
  const size = project.size;
  const current = slides[sel];
  const pipelineIdx = runStage ?? stageIndex(project.stage);
  const showPipeline = running || project.stage < 7;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="h-11 max-w-xl border-transparent bg-transparent px-0 font-display text-2xl font-bold shadow-none focus-visible:ring-0 sm:text-3xl"
          value={bundle.project.title}
          onChange={(e) => setBundle({ ...bundle, project: { ...project, title: e.target.value } })}
          onBlur={(e) => api(`/api/projects/${projectId}`, { method: "PATCH", json: { title: e.target.value || "Untitled" } }).catch(() => undefined)}
          aria-label="Project title"
        />
        <Badge tone={project.status === "ready" ? "good" : project.status === "failed" ? "bad" : "muted"} className="capitalize">{running ? "generating" : project.status}</Badge>
        <span className="text-xs text-muted-foreground">
          {saveState === "saved" ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />Saved</span> : saveState === "saving" ? "Saving…" : "Unsaved changes"}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAs("single")} loading={exporting === "single"} disabled={!slides.length || running}><ImageIcon className="h-4 w-4" />This slide</Button>
          <Button variant="outline" size="sm" onClick={() => exportAs("jpeg-zip")} loading={exporting === "jpeg-zip"} disabled={!slides.length || running}>JPEG .zip</Button>
          <Button variant="outline" size="sm" onClick={() => exportAs("pdf")} loading={exporting === "pdf"} disabled={!slides.length || running}><FileText className="h-4 w-4" />PDF</Button>
          <Button size="sm" variant="accent" onClick={() => exportAs("png-zip")} loading={exporting === "png-zip"} disabled={!slides.length || running}><Download className="h-4 w-4" />PNG .zip</Button>
        </div>
      </div>

      <ErrorBanner error={error} />

      {showPipeline && (
        <Card className={cn("relative overflow-hidden p-5 transition-all", running && "aurora border-accent/30")}>
          <Progress value={(Math.min(pipelineIdx, 7) / 7) * 100} className="mb-4 h-1.5" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ol className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {STAGES.map((label, i) => {
                const done = i < pipelineIdx;
                const active = i === pipelineIdx && running;
                return (
                  <li key={label} className={cn("flex items-center gap-1.5", done ? "text-foreground" : active ? "font-semibold text-accent" : "text-muted-foreground")}>
                    {done ? <Check className="h-4 w-4 animate-pop text-emerald-600" /> : active ? <span className="grid place-items-center rounded-full animate-pulse-ring"><Loader2 className="h-4 w-4 animate-spin" /></span> : <span className="grid h-4 w-4 place-items-center rounded-full border text-[10px]">{i + 1}</span>}
                    {label}{active && i === 3 && visualProgress ? ` (${visualProgress})` : ""}
                  </li>
                );
              })}
            </ol>
            {!running && (
              <Button variant="accent" onClick={() => runPipeline()}>
                <RefreshCw className="h-4 w-4" /> {project.stage < 3 ? "Generate" : "Resume"} from “{STAGES[Math.min(stageIndex(project.stage), 6)]}”
              </Button>
            )}
          </div>
          {project.status === "failed" && project.stage_error && !running && <p className="mt-3 text-sm text-rose-700">Last run stopped: {project.stage_error}</p>}
        </Card>
      )}

      {bundle.brief?.strategy && (
        <details className="rounded-xl border bg-card p-4 text-sm">
          <summary className="cursor-pointer font-medium">Content strategy</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <p><b>Angle.</b> {bundle.brief.strategy.angle}</p>
            <p><b>Audience insight.</b> {bundle.brief.strategy.audience_insight}</p>
            <p><b>Visual direction.</b> {bundle.brief.strategy.visual_direction}</p>
            <p><b>Narrative.</b> {(bundle.brief.strategy.narrative ?? []).join(" → ")}</p>
            {bundle.brief.strategy.reference && <p className="text-muted-foreground sm:col-span-2">Reference: {bundle.brief.strategy.reference}</p>}
          </div>
        </details>
      )}

      {!slides.length ? (
        <Card className="grid h-72 place-items-center text-center text-muted-foreground">
          {running ? (
            <div className="w-full space-y-4 p-6">
              <div className="flex justify-center gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-24" />)}</div>
              <p className="animate-pulse">Writing your carousel — strategy first, then slide by slide…</p>
            </div>
          ) : <p>No slides yet — run generation above.</p>}
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[150px_minmax(0,1fr)_380px]">
          {/* filmstrip */}
          <div className="stagger flex gap-3 overflow-x-auto pb-2 xl:flex-col xl:overflow-visible">
            {slides.map((s, i) => (
              <div key={s.id} className="group relative shrink-0">
                <button onClick={() => setSel(i)} className={cn("block overflow-hidden rounded-lg border-2 transition-all duration-200", i === sel ? "scale-[1.03] border-accent shadow-lg" : "border-transparent opacity-80 hover:-translate-y-0.5 hover:border-border hover:opacity-100")} aria-label={`Slide ${i + 1}`}>
                  <ScaledSlide width={128} size={size}>
                    <SlideCanvas slide={s} design={design} size={size} index={i} total={slides.length} bgUrl={assetUrlClient(s.background_path)} logoUrl={logoUrl} />
                  </ScaledSlide>
                </button>
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
                {overflow[s.id] && <AlertTriangle className="absolute right-1.5 top-1.5 h-4 w-4 rounded bg-amber-400 p-0.5 text-black" aria-label="Text too long" />}
                {busySlide === s.id && <div className="skeleton absolute inset-0 grid place-items-center opacity-80"><Spinner /></div>}
              </div>
            ))}
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => addSlide(slides.length - 1)} disabled={slides.length >= 10 || running}><Plus className="h-4 w-4" />Add</Button>
          </div>

          {/* stage */}
          <div className="min-w-0">
            {current && (
              <div className="mx-auto w-full max-w-[520px]">
                <StageView width={520}>
                  {(wpx) => (
                    <div key={current.id} className="animate-scale-in overflow-hidden rounded-xl shadow-[0_30px_60px_-25px_rgb(0_0_0/.45)] ring-1 ring-black/5">
                      <ScaledSlide width={wpx} size={size}>
                        <SlideCanvas slide={current} design={design} size={size} index={sel} total={slides.length} bgUrl={assetUrlClient(current.background_path)} logoUrl={logoUrl} />
                      </ScaledSlide>
                    </div>
                  )}
                </StageView>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button size="icon" variant="outline" onClick={() => move(sel, -1)} disabled={sel === 0 || running} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" onClick={() => move(sel, 1)} disabled={sel === slides.length - 1 || running} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => addSlide(sel)} disabled={running}><Plus className="h-4 w-4" />Insert after</Button>
                  <Button size="icon" variant="outline" onClick={() => deleteSlide(sel)} disabled={running} aria-label="Delete slide"><Trash2 className="h-4 w-4" /></Button>
                </div>
                {overflow[current.id] && <p className="mt-2 text-center text-xs text-amber-700">Text is at minimum size and still overflows — shorten the copy.</p>}
              </div>
            )}
          </div>

          {/* inspector */}
          <Card className="h-fit">
            <div className="flex border-b">
              {(["slide", "design"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("flex-1 py-3 text-sm font-medium capitalize", tab === t ? "border-b-2 border-accent" : "text-muted-foreground")}>{t === "slide" ? `Slide ${sel + 1}` : "Design"}</button>
              ))}
            </div>
            <CardContent key={tab + (current?.id ?? "")} className="animate-fade-in space-y-4 pt-5">
              {tab === "slide" && current ? (
                <SlideInspector
                  key={current.id}
                  slide={current}
                  busy={busySlide === current.id || running}
                  onChange={(p) => updateSlide(current.id, p)}
                  onRegenerate={(ins) => regenerateCopy(current, ins)}
                  onNewBg={(f) => newBackground(current, f)}
                  onRemoveBg={() => removeBackground(current)}
                  isNewSlide={isNew(current.id)}
                />
              ) : (
                <div className="space-y-5">
                  <ThemePicker design={design} onChange={updateDesign} />
                  <ColorControls design={design} onChange={updateDesign} />
                  <FontControls design={design} onChange={updateDesign} />
                  <LogoControls design={design} onChange={updateDesign} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {slides.length > 0 && <CaptionPanel projectId={projectId} platform={project.platform} initial={bundle.captions} />}

      {/* off-screen native-size slides: the exact nodes we rasterise for export */}
      <div aria-hidden style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
        {slides.map((s, i) => (
          <SlideCanvas
            key={s.id}
            ref={(el) => { exportRefs.current[s.id] = el; }}
            slide={s}
            design={design}
            size={size}
            index={i}
            total={slides.length}
            bgUrl={assetUrlClient(s.background_path)}
            logoUrl={logoUrl}
            onFit={onFit}
          />
        ))}
      </div>
    </div>
  );
}

function StageView({ width, children }: { width: number; children: (w: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(width);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.min(width, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return <div ref={ref}>{children(w)}</div>;
}

function SlideInspector({
  slide, busy, onChange, onRegenerate, onNewBg, onRemoveBg, isNewSlide,
}: {
  slide: Slide; busy: boolean; isNewSlide: boolean;
  onChange: (p: Partial<Slide>) => void; onRegenerate: (instruction?: string) => void; onNewBg: (f?: File) => void; onRemoveBg: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const st = slide.style ?? {};
  const setStyle = (p: Partial<NonNullable<Slide["style"]>>) => onChange({ style: { ...st, ...p } });

  return (
    <div className="space-y-4">
      <Field label="Kicker"><Input value={slide.kicker ?? ""} maxLength={60} onChange={(e) => onChange({ kicker: e.target.value })} /></Field>
      <Field label={`Heading · ${slide.heading.length}/90`}><Textarea rows={2} maxLength={160} value={slide.heading} onChange={(e) => onChange({ heading: e.target.value })} /></Field>
      <Field label={`Body · ${slide.body.length}/260`}><Textarea rows={4} maxLength={600} value={slide.body} onChange={(e) => onChange({ body: e.target.value })} /></Field>
      <Field label="Layout">
        <Select value={slide.layout} onChange={(e) => onChange({ layout: e.target.value as Slide["layout"] })}>
          <option value="top">Text top, visual below</option>
          <option value="bottom">Visual top, text below</option>
          <option value="center">Text over full visual</option>
          <option value="split">Split</option>
        </Select>
      </Field>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Regenerate copy</p>
        <Input placeholder="Optional instruction, e.g. “more specific”" value={instruction} maxLength={300} onChange={(e) => setInstruction(e.target.value)} />
        <Button size="sm" variant="secondary" className="w-full" disabled={busy || isNewSlide} onClick={() => onRegenerate(instruction || undefined)}><Wand2 className="h-4 w-4" />Rewrite this slide</Button>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Visual</p>
        <Textarea rows={3} placeholder="Describe the background (no text)" value={slide.visual_prompt ?? ""} maxLength={600} onChange={(e) => onChange({ visual_prompt: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" disabled={busy || isNewSlide} onClick={() => onNewBg()}><ImagePlus className="h-4 w-4" />Generate</Button>
          <Button size="sm" variant="outline" disabled={busy || isNewSlide} onClick={() => fileRef.current?.click()}>Upload</Button>
        </div>
        {slide.background_path && <Button size="sm" variant="ghost" className="w-full" disabled={busy} onClick={onRemoveBg}>Remove visual</Button>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && onNewBg(e.target.files[0])} />
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-sm font-medium">Slide style overrides</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {(["background", "text", "accent"] as const).map((k) => (
            <label key={k} className="flex flex-col items-center gap-1 capitalize">
              <input type="color" value={st[k] ?? "#000000"} onChange={(e) => setStyle({ [k]: e.target.value })} className="h-8 w-full cursor-pointer rounded border" />
              {k}
              {st[k] && <button className="text-[10px] underline" onClick={() => setStyle({ [k]: undefined })}>reset</button>}
            </label>
          ))}
        </div>
        <Field label={`Heading size · ${Math.round((st.headingScale ?? 1) * 100)}%`}>
          <input type="range" min={0.6} max={1.4} step={0.05} value={st.headingScale ?? 1} onChange={(e) => setStyle({ headingScale: Number(e.target.value) })} className="w-full accent-[hsl(var(--accent))]" />
        </Field>
        {slide.layout === "center" && (
          <Field label={`Image overlay · ${Math.round((st.overlay ?? 0.55) * 100)}%`}>
            <input type="range" min={0} max={0.9} step={0.05} value={st.overlay ?? 0.55} onChange={(e) => setStyle({ overlay: Number(e.target.value) })} className="w-full accent-[hsl(var(--accent))]" />
          </Field>
        )}
      </div>
    </div>
  );
}

function CaptionPanel({ projectId, platform, initial }: { projectId: string; platform: "instagram" | "linkedin" | "both"; initial: Caption[] }) {
  const plats: Caption["platform"][] = platform === "both" ? ["instagram", "linkedin"] : [platform];
  const [active, setActive] = useState<Caption["platform"]>(plats[0]);
  const [caps, setCaps] = useState<Record<string, Caption>>(() => Object.fromEntries(initial.map((c) => [c.platform, c])));
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const cap = caps[active];

  useEffect(() => { setCaps(Object.fromEntries(initial.map((c) => [c.platform, c]))); }, [initial]);

  async function generate() {
    setBusy("gen"); setErr(null);
    try {
      const { caption } = await api<{ caption: Caption }>(`/api/projects/${projectId}/caption`, { method: "POST", json: { platform: active } });
      setCaps((c) => ({ ...c, [active]: caption }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function save(next: Caption) {
    setBusy("save"); setErr(null);
    try { await api(`/api/projects/${projectId}/caption`, { method: "PUT", json: next }); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }
  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Caption & hashtags</CardTitle>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {plats.map((p) => (
            <button key={p} onClick={() => setActive(p)} className={cn("rounded-md px-3 py-1 text-sm capitalize", active === p ? "bg-card shadow-sm" : "text-muted-foreground")}>{p}</button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ErrorBanner error={err} />
        {cap ? (
          <>
            <Textarea rows={8} value={cap.body} onChange={(e) => setCaps({ ...caps, [active]: { ...cap, body: e.target.value } })} onBlur={() => save(cap)} />
            <Field label="Hashtags" hint="Space-separated">
              <Textarea rows={2} value={cap.hashtags.join(" ")} onChange={(e) => setCaps({ ...caps, [active]: { ...cap, hashtags: e.target.value.split(/\s+/).filter(Boolean) } })} onBlur={() => save(cap)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(cap.body, "body")}><Copy className="h-4 w-4" />{copied === "body" ? "Copied" : "Copy caption"}</Button>
              <Button size="sm" variant="outline" onClick={() => copy(cap.hashtags.join(" "), "tags")}><Copy className="h-4 w-4" />{copied === "tags" ? "Copied" : "Copy hashtags"}</Button>
              <Button size="sm" variant="outline" onClick={() => copy(`${cap.body}\n\n${cap.hashtags.join(" ")}`, "all")}>{copied === "all" ? "Copied" : "Copy both"}</Button>
              <Button size="sm" variant="secondary" onClick={generate} loading={busy === "gen"} className="ml-auto"><RefreshCw className="h-4 w-4" />Regenerate</Button>
            </div>
          </>
        ) : (
          <Button onClick={generate} loading={busy === "gen"}><Wand2 className="h-4 w-4" />Write {active} caption</Button>
        )}
      </CardContent>
    </Card>
  );
}
