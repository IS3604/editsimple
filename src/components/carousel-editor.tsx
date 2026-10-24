"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, FileText, ImageIcon,
  ImagePlus, Loader2, Plus, RefreshCw, Trash2, Upload, Wand2, X,
} from "lucide-react";
import { AiTag, Button, Chip, ErrorBanner, Field, Input, Segmented, Select, Skeleton, Spinner, Textarea } from "@/components/ui";
import { ColorControls, FontControls, IdentityControls, TemplatePicker } from "@/components/design-controls";
import { ScaledSlide, SlideCanvas, dims, type SlideSize } from "@/components/slide-canvas";
import { api } from "@/lib/api-client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { assetUrlClient } from "@/lib/asset-url";
import { pdfSlides, renderJpegDataUrl, renderPng, safeName, saveBlob, zipSlides } from "@/lib/export";
import { defaultDesign, migrateDesign } from "@/lib/themes";
import { NICHES, nicheOf } from "@/lib/niches";
import { DesignSchema, STAGES, type Design, type Slide, type SlideItem, type SlideKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type Project = {
  id: string; title: string; platform: "instagram" | "linkedin" | "both"; slide_count: number; size: SlideSize;
  design: Design; stage: number; status: "draft" | "generating" | "ready" | "failed"; stage_error: string | null;
};
type Caption = { platform: "instagram" | "linkedin"; body: string; hashtags: string[] };
type Bundle = { project: Project; brief: any; slides: Slide[]; captions: Caption[] };

const KIND_LABEL: Record<SlideKind, string> = {
  hook: "Cover",
  statement: "Single point",
  list: "List",
  steps: "Steps",
  checklist: "Checklist",
  myth_fact: "Myth vs fact",
  comparison: "Do vs don't",
  highlight: "Big statement",
  cta: "Closing / CTA",
};
const ITEM_KINDS: SlideKind[] = ["list", "steps", "checklist", "myth_fact", "comparison"];

const isNew = (id: string) => id.startsWith("new-");
const normalize = (s: Slide): Slide => ({ ...s, kind: (s.kind ?? "statement") as SlideKind, items: Array.isArray(s.items) ? s.items : [], style: s.style ?? {} });
const stripForSave = (s: Slide) => ({
  ...(isNew(s.id) ? {} : { id: s.id }),
  kind: s.kind, items: s.items, role: s.role, kicker: s.kicker, heading: s.heading, body: s.body, visual_prompt: s.visual_prompt,
  layout: s.layout, background_path: s.background_path, style: s.style ?? {},
});

/** project.stage → index into STAGES of the step that runs next */
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
  const [visualProgress, setVisualProgress] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [busySlide, setBusySlide] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<"content" | "design">("content");
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
      setSlides(b.slides.map(normalize));
      const parsed = DesignSchema.safeParse(b.project.design);
      setDesign(parsed.success ? parsed.data : migrateDesign(b.project.design) ?? defaultDesign());
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

  // ---------- autosave ----------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback(async () => {
    setSaveState("saving");
    try {
      await Promise.all([
        api(`/api/projects/${projectId}/slides`, { method: "PUT", json: { slides: slidesRef.current.map(stripForSave) } }),
        api(`/api/projects/${projectId}`, { method: "PATCH", json: { design: designRef.current } }),
      ]);
      setSaveState("saved");
    } catch (e) {
      setSaveState("dirty");
      setError(`Couldn't save your changes: ${(e as Error).message}`);
    }
  }, [projectId]);
  const markDirty = useCallback(() => {
    setSaveState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(persist, 1200);
  }, [persist]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlides((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    markDirty();
  };
  const updateDesign = (d: Design) => {
    setDesign(d);
    markDirty();
  };

  async function saveDeck(next: Slide[], selectIndex?: number) {
    setSaveState("saving");
    setError(null);
    try {
      const { slides: saved } = await api<{ slides: Slide[] }>(`/api/projects/${projectId}/slides`, { method: "PUT", json: { slides: next.map(stripForSave) } });
      setSlides(saved.map(normalize));
      if (selectIndex != null) setSel(Math.max(0, Math.min(saved.length - 1, selectIndex)));
      setSaveState("saved");
    } catch (e) {
      setError((e as Error).message);
      setSaveState("dirty");
    }
  }

  // ---------- pipeline ----------
  const waitForRender = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 350))));

  async function renderAll(deck: Slide[]) {
    const { w, h } = dims(bundle?.project.size ?? "1080x1350");
    await waitForRender();
    const out: { slide: Slide; blob: Blob }[] = [];
    for (const s of deck) {
      const node = exportRefs.current[s.id];
      if (!node) throw new Error("A slide wasn't ready to render — try again.");
      out.push({ slide: s, blob: await renderPng(node, w, h) });
    }
    return out;
  }

  /** Uploads straight to Supabase Storage (own-folder RLS) — avoids Vercel's 4.5 MB body limit. */
  async function uploadRenders(rendered: { slide: Slide; blob: Blob }[]) {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("You've been signed out — sign in again to continue.");
    const stamp = Date.now();
    const items = await Promise.all(
      rendered.map(async (r) => {
        const path = `${data.user!.id}/projects/${projectId}/renders/${r.slide.id}-${stamp}.png`;
        const { error } = await sb.storage.from("editsimple").upload(path, r.blob, { contentType: "image/png", upsert: true });
        if (error) throw new Error(`Saving slide images failed: ${error.message}`);
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
    let deck = (start ? b.slides : slidesRef.current).map(normalize);
    const d = designRef.current;
    const patchStage = (s: number, status: Project["status"] = "generating") =>
      api(`/api/projects/${projectId}`, { method: "PATCH", json: { stage: s, status, stage_error: null } });
    try {
      if (stage < 3) {
        setRunStage(1);
        const t = setTimeout(() => setRunStage(2), 6000);
        const r = await api<{ slides: Slide[] }>(`/api/projects/${projectId}/content`, { method: "POST", json: {} });
        clearTimeout(t);
        deck = r.slides.map(normalize).sort((a, c) => a.position - c.position);
        setSlides(deck);
        setSel(0);
        stage = 3;
      }
      if (stage < 4) {
        setRunStage(3);
        const mode = d.imageMode ?? "cover-only";
        const targets = mode === "none" ? [] : deck.filter((s, i) => !s.background_path && (i === 0 || (mode === "per-slide" && !!s.visual_prompt)));
        let done = 0;
        const failures: string[] = [];
        const queue = [...targets];
        const worker = async () => {
          while (queue.length) {
            const s = queue.shift()!;
            try {
              const { slide } = await api<{ slide: Slide }>(`/api/projects/${projectId}/slides/${s.id}/background`, { method: "POST", json: {} });
              deck = deck.map((x) => (x.id === slide.id ? normalize(slide) : x));
              setSlides(deck);
            } catch (e) {
              failures.push((e as Error).message);
            }
            setVisualProgress(`${++done} of ${targets.length}`);
          }
        };
        await Promise.all([worker(), worker()]);
        if (failures.length)
          setError(`${failures.length === targets.length ? "Images couldn't be created" : `${failures.length} image(s) couldn't be created`} — the slides use your template instead. You can retry from the slide panel. (${failures[0]})`);
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
      setRunStage(null);
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
      setSlides((xs) => xs.map((x) => (x.id === slide.id ? normalize(slide) : x)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusySlide(null);
    }
  }

  async function newBackground(s: Slide, file?: File) {
    setBusySlide(s.id);
    setError(null);
    try {
      if (saveState !== "saved") await persist();
      const init: RequestInit & { json?: unknown } = file
        ? { method: "POST", body: (() => { const fd = new FormData(); fd.append("file", file); return fd; })() }
        : { method: "POST", json: { prompt: s.visual_prompt || undefined } };
      const { slide } = await api<{ slide: Slide }>(`/api/projects/${projectId}/slides/${s.id}/background`, init);
      setSlides((xs) => xs.map((x) => (x.id === slide.id ? normalize(slide) : x)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusySlide(null);
    }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    saveDeck(next, j);
  }
  function addSlide(after: number) {
    if (slides.length >= 10) return setError("A carousel can have up to 10 slides.");
    const blank: Slide = {
      id: `new-${crypto.randomUUID()}`, project_id: projectId, position: after + 1, kind: "statement", role: "insight", kicker: "", heading: "New point",
      body: "Explain it in one or two sentences.", items: [], visual_prompt: null, layout: "top", background_path: null, style: {}, render_path: null,
    };
    const next = [...slides];
    next.splice(after + 1, 0, blank);
    saveDeck(next, after + 1);
  }
  function deleteSlide(i: number) {
    if (slides.length <= 3) return setError("Keep at least 3 slides.");
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
        saveBlob(await renderPng(exportRefs.current[s.id]!, w, h), `${base}-${String(sel + 1).padStart(2, "0")}.png`);
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
      uploadRenders(rendered).catch(() => undefined);
      if (kind === "png-zip") await zipSlides(rendered.map((r, i) => ({ name: `${base}-${String(i + 1).padStart(2, "0")}.png`, blob: r.blob })), `${base}.zip`);
      else await pdfSlides(rendered.map((r) => r.blob), w, h, `${base}.pdf`);
    } catch (e) {
      setError(`Download failed: ${(e as Error).message}`);
    } finally {
      setExporting(null);
    }
  }

  const onFit = useCallback((info: { id: string; overflow: boolean }) => {
    setOverflow((o) => (o[info.id] === info.overflow ? o : { ...o, [info.id]: info.overflow }));
  }, []);
  const logoUrl = useMemo(() => assetUrlClient(design.logoPath), [design.logoPath]);

  // keyboard: ← → to move between slides (outside inputs)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if (e.key === "ArrowRight") setSel((s) => Math.min(slidesRef.current.length - 1, s + 1));
      if (e.key === "ArrowLeft") setSel((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  if (loadErr) return <ErrorBanner error={loadErr} onRetry={() => { setLoadErr(null); load(); }} />;
  if (!bundle) return <div className="grid h-72 place-items-center"><Spinner className="h-7 w-7" /></div>;

  const { project } = bundle;
  const niche = nicheOf(bundle.brief?.niche);
  const disclaimer = NICHES[niche].disclaimer;
  const size = project.size;
  const current = slides[sel];
  const pipelineIdx = runStage ?? stageIndex(project.stage);
  const showPipeline = running || project.stage < 7;

  return (
    <div data-niche={niche} className="space-y-5">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link href="/projects" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Back to projects">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          className="min-w-0 flex-1 bg-transparent font-display text-[30px] leading-tight outline-none placeholder:text-muted-foreground sm:text-[34px]"
          value={bundle.project.title}
          onChange={(e) => setBundle({ ...bundle, project: { ...project, title: e.target.value } })}
          onBlur={(e) => api(`/api/projects/${projectId}`, { method: "PATCH", json: { title: e.target.value || "Untitled carousel" } }).catch(() => undefined)}
          aria-label="Carousel title"
        />
        <span className="text-xs text-muted-foreground">
          {running ? "Generating…" : saveState === "saved" ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />Saved</span> : saveState === "saving" ? "Saving…" : "Unsaved"}
        </span>
        <ExportMenu disabled={!slides.length || running} exporting={exporting} onExport={exportAs} />
      </div>

      <ErrorBanner error={error} />

      {/* generation progress */}
      {showPipeline && (
        <div className={cn("rounded-2xl border bg-card p-5", running && "ring-1 ring-[hsl(var(--accent)/.25)]")}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-[13px]">
              {STAGES.map((label, i) => {
                const done = i < pipelineIdx;
                const active = i === pipelineIdx && running;
                return (
                  <li key={label} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                        done ? "text-foreground" : active ? "bg-[hsl(var(--accent-soft))] font-medium text-accent" : "text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5 text-accent" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />}
                      {label}
                      {active && i === 3 && visualProgress ? ` (${visualProgress})` : ""}
                    </span>
                    {i < STAGES.length - 1 && <span className="h-px w-3 bg-border" />}
                  </li>
                );
              })}
            </ol>
            {!running && (
              <Button variant="accent" onClick={() => runPipeline()}>
                <RefreshCw className="h-4 w-4" /> {project.stage < 3 ? "Generate carousel" : `Continue from “${STAGES[Math.min(stageIndex(project.stage), 6)]}”`}
              </Button>
            )}
          </div>
          {project.status === "failed" && project.stage_error && !running && <p className="mt-3 text-[13px] text-rose-700">Stopped at this step: {project.stage_error}</p>}
        </div>
      )}

      {bundle.brief?.strategy && (
        <details className="group rounded-2xl border bg-card px-5 py-4 text-[13px]">
          <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
            <span className="flex items-center gap-2">The angle <AiTag>plan</AiTag></span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-4 leading-relaxed text-foreground/85 sm:grid-cols-2">
            <p><span className="font-medium text-foreground">Angle. </span>{bundle.brief.strategy.angle}</p>
            <p><span className="font-medium text-foreground">Why it lands. </span>{bundle.brief.strategy.audience_insight}</p>
            {bundle.brief.strategy.hook_options?.length > 0 && (
              <div className="sm:col-span-2">
                <p className="mb-1.5 font-medium text-foreground">Alternative cover hooks — click to use</p>
                <div className="flex flex-wrap gap-1.5">
                  {bundle.brief.strategy.hook_options.map((h: string) => (
                    <Chip key={h} onClick={() => slides[0] && updateSlide(slides[0].id, { heading: h })}>{h}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {!slides.length ? (
        <div className="grid h-80 place-items-center rounded-2xl border bg-card text-center">
          {running ? (
            <div className="space-y-4">
              <div className="flex justify-center gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-24" />)}</div>
              <p className="text-[14px] text-muted-foreground">Planning the angle, then writing each slide and sharpening it…</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No slides yet. Click “Generate carousel” above.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[112px_minmax(0,1fr)_400px]">
          {/* filmstrip */}
          <div className="flex gap-3 overflow-x-auto pb-1 xl:max-h-[calc(100vh-160px)] xl:flex-col xl:overflow-y-auto xl:overflow-x-visible xl:pr-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setSel(i)}
                className={cn("relative shrink-0 rounded-[10px] p-0.5 transition-all", i === sel ? "ring-2 ring-accent" : "opacity-80 ring-1 ring-border hover:opacity-100")}
                aria-label={`Slide ${i + 1}`}
              >
                <div className="overflow-hidden rounded-lg">
                  <ScaledSlide width={100} size={size}>
                    <SlideCanvas slide={s} design={design} size={size} index={i} total={slides.length} bgUrl={assetUrlClient(s.background_path)} logoUrl={logoUrl} disclaimer={disclaimer} />
                  </ScaledSlide>
                </div>
                {overflow[s.id] && <AlertTriangle className="absolute right-1.5 top-1.5 h-4 w-4 rounded bg-amber-400 p-0.5 text-black" aria-label="Text too long" />}
                {busySlide === s.id && <div className="skeleton absolute inset-0.5 opacity-80" />}
              </button>
            ))}
            <button
              onClick={() => addSlide(slides.length - 1)}
              disabled={slides.length >= 10 || running}
              className="grid h-[125px] w-[104px] shrink-0 place-items-center rounded-[10px] border border-dashed text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-40"
              aria-label="Add slide"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {/* stage */}
          <div className="min-w-0">
            {current && (
              <div className="mx-auto w-full max-w-[540px]">
                <StageView max={540}>
                  {(wpx) => (
                    <div key={current.id} className="animate-fade-in overflow-hidden rounded-2xl shadow-[0_30px_60px_-30px_rgb(15_18_30/.5)] ring-1 ring-black/5">
                      <ScaledSlide width={wpx} size={size}>
                        <SlideCanvas slide={current} design={design} size={size} index={sel} total={slides.length} bgUrl={assetUrlClient(current.background_path)} logoUrl={logoUrl} disclaimer={disclaimer} />
                      </ScaledSlide>
                    </div>
                  )}
                </StageView>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setSel(Math.max(0, sel - 1))} disabled={sel === 0} aria-label="Previous slide"><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="grid min-w-14 place-items-center text-[13px] tabular-nums text-muted-foreground">{sel + 1} of {slides.length}</span>
                    <Button size="icon" variant="ghost" onClick={() => setSel(Math.min(slides.length - 1, sel + 1))} disabled={sel === slides.length - 1} aria-label="Next slide"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(sel, -1)} disabled={sel === 0 || running} aria-label="Move slide earlier" title="Move earlier"><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(sel, 1)} disabled={sel === slides.length - 1 || running} aria-label="Move slide later" title="Move later"><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => addSlide(sel)} disabled={running}><Plus className="h-4 w-4" />Insert after</Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteSlide(sel)} disabled={running} aria-label="Delete slide" title="Delete slide"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {overflow[current.id] && <p className="mt-2 text-center text-xs text-amber-700">This slide has more text than fits — shorten it or remove an item.</p>}
              </div>
            )}
          </div>

          {/* inspector */}
          <div className="h-fit rounded-2xl border bg-card xl:sticky xl:top-6">
            <div className="p-3 pb-0">
              <Segmented
                className="w-full"
                value={tab}
                onChange={setTab}
                options={[
                  { value: "content", label: `Slide ${sel + 1}` },
                  { value: "design", label: "Design" },
                ]}
              />
            </div>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5">
              {tab === "content" && current ? (
                <SlideInspector
                  key={current.id}
                  slide={current}
                  busy={busySlide === current.id || running}
                  isNewSlide={isNew(current.id)}
                  onChange={(p) => updateSlide(current.id, p)}
                  onRegenerate={(ins) => regenerateCopy(current, ins)}
                  onNewBg={(f) => newBackground(current, f)}
                />
              ) : (
                <div className="space-y-6">
                  <TemplatePicker design={design} onChange={updateDesign} heading={slides[0]?.heading} niche={niche} columns={3} />
                  <ColorControls design={design} onChange={updateDesign} />
                  <FontControls design={design} onChange={updateDesign} />
                  <IdentityControls design={design} onChange={updateDesign} niche={niche} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {slides.length > 0 && <CaptionPanel projectId={projectId} platform={project.platform} initial={bundle.captions} />}

      {/* off-screen native-size slides: the exact nodes rasterised for export */}
      <div aria-hidden style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
        {slides.map((s, i) => (
          <SlideCanvas
            key={s.id}
            ref={(el) => {
              exportRefs.current[s.id] = el;
            }}
            slide={s}
            design={design}
            size={size}
            index={i}
            total={slides.length}
            bgUrl={assetUrlClient(s.background_path)}
            logoUrl={logoUrl}
            disclaimer={disclaimer}
            onFit={onFit}
          />
        ))}
      </div>
    </div>
  );
}

function ExportMenu({ disabled, exporting, onExport }: { disabled: boolean; exporting: string | null; onExport: (k: "png-zip" | "jpeg-zip" | "pdf" | "single") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const items: { k: "png-zip" | "jpeg-zip" | "pdf" | "single"; label: string; hint: string; icon: typeof Download }[] = [
    { k: "png-zip", label: "All slides, PNG", hint: "Best quality for Instagram", icon: ImageIcon },
    { k: "pdf", label: "PDF document", hint: "For LinkedIn document posts", icon: FileText },
    { k: "jpeg-zip", label: "All slides, JPEG", hint: "Smaller files", icon: ImageIcon },
    { k: "single", label: "This slide only", hint: "PNG", icon: Download },
  ];
  return (
    <div ref={ref} className="relative">
      <Button variant="accent" disabled={disabled} loading={!!exporting} onClick={() => setOpen((o) => !o)}>
        {!exporting && <Download className="h-4 w-4" />}Download
        <ChevronDown className="h-3.5 w-3.5 opacity-80" />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 animate-fade-in rounded-xl border bg-card p-1.5 shadow-[0_20px_40px_-18px_rgb(15_18_30/.45)]">
          {items.map((it) => (
            <button
              key={it.k}
              onClick={() => {
                setOpen(false);
                onExport(it.k);
              }}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary"
            >
              <it.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>
                <span className="block text-[13px] font-medium">{it.label}</span>
                <span className="block text-xs text-muted-foreground">{it.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StageView({ max, children }: { max: number; children: (w: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(max);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.min(max, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [max]);
  return <div ref={ref}>{children(w)}</div>;
}

const QUICK = ["Shorter", "More specific", "Simpler words", "Stronger hook", "Add an Indian example"];

function SlideInspector({
  slide, busy, onChange, onRegenerate, onNewBg, isNewSlide,
}: {
  slide: Slide; busy: boolean; isNewSlide: boolean;
  onChange: (p: Partial<Slide>) => void; onRegenerate: (instruction?: string) => void; onNewBg: (f?: File) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [showStyle, setShowStyle] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = slide.style ?? {};
  const setStyle = (p: Partial<NonNullable<Slide["style"]>>) => onChange({ style: { ...st, ...p } });
  const items = slide.items ?? [];
  const setItem = (i: number, p: Partial<SlideItem>) => onChange({ items: items.map((it, k) => (k === i ? { ...it, ...p } : it)) });

  const changeKind = (kind: SlideKind) => {
    let next = items;
    if (kind === "myth_fact") next = [items[0] ?? { title: "Myth", text: "" }, items[1] ?? { title: "Fact", text: "" }].map((it, i) => ({ ...it, title: i ? "Fact" : "Myth" }));
    else if (kind === "comparison") next = [items[0] ?? { title: "Do", text: "" }, items[1] ?? { title: "Don't", text: "" }];
    else if (ITEM_KINDS.includes(kind) && !items.length) next = [{ title: "First point", text: "" }, { title: "Second point", text: "" }, { title: "Third point", text: "" }];
    onChange({ kind, items: next, layout: kind === "hook" ? "center" : slide.layout === "center" ? "top" : slide.layout });
  };

  const fixedItems = slide.kind === "myth_fact" || slide.kind === "comparison";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="Slide type">
          <Select value={slide.kind} onChange={(e) => changeKind(e.target.value as SlideKind)}>
            {(Object.keys(KIND_LABEL) as SlideKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Label" hint="A few words above the heading, e.g. “Red flag” or “Your right”.">
        <Input value={slide.kicker ?? ""} maxLength={60} onChange={(e) => onChange({ kicker: e.target.value })} />
      </Field>
      <Field label="Heading" aside={<span className="text-[11px] tabular-nums text-muted-foreground">{slide.heading.length}</span>}>
        <Textarea rows={2} maxLength={160} value={slide.heading} onChange={(e) => onChange({ heading: e.target.value })} className="text-[15px] font-medium" />
      </Field>
      {!["myth_fact", "comparison"].includes(slide.kind) && (
        <Field label="Supporting text" aside={<span className="text-[11px] tabular-nums text-muted-foreground">{slide.body.length}</span>}>
          <Textarea rows={3} maxLength={600} value={slide.body} onChange={(e) => onChange({ body: e.target.value })} />
        </Field>
      )}

      {ITEM_KINDS.includes(slide.kind) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">{slide.kind === "comparison" ? "Columns" : slide.kind === "myth_fact" ? "Myth and fact" : "Points"}</span>
            {!fixedItems && items.length < 6 && (
              <button className="inline-flex items-center gap-1 text-xs font-medium text-accent" onClick={() => onChange({ items: [...items, { title: "", text: "" }] })}>
                <Plus className="h-3 w-3" />Add point
              </button>
            )}
          </div>
          {items.map((it, i) => (
            <div key={i} className="space-y-1.5 rounded-xl bg-secondary/60 p-2.5">
              <div className="flex items-center gap-2">
                <Input className="h-8 bg-card text-[13px] font-medium" value={it.title} maxLength={80} placeholder="Title" onChange={(e) => setItem(i, { title: e.target.value })} disabled={slide.kind === "myth_fact"} />
                {!fixedItems && (
                  <button className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground" aria-label="Remove point" onClick={() => onChange({ items: items.filter((_, k) => k !== i) })}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Textarea
                className="min-h-[52px] bg-card text-[13px]"
                rows={slide.kind === "comparison" ? 3 : 2}
                value={it.text}
                maxLength={300}
                placeholder={slide.kind === "comparison" ? "One line per point" : "Detail (optional)"}
                onChange={(e) => setItem(i, { text: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2.5 rounded-xl border p-3.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-medium"><Wand2 className="h-4 w-4 text-accent" />Rewrite with AI</span>
          {busy && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <Chip key={q} className="py-1 text-xs" onClick={() => !busy && !isNewSlide && onRegenerate(q)}>{q}</Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <Input className="h-9 text-[13px]" placeholder="Or say what to change" value={instruction} maxLength={300} onChange={(e) => setInstruction(e.target.value)} />
          <Button size="sm" variant="secondary" className="h-9" disabled={busy || isNewSlide} onClick={() => onRegenerate(instruction || undefined)}>Rewrite</Button>
        </div>
        {isNewSlide && <p className="text-xs text-muted-foreground">Saving the new slide — AI rewrite is available in a moment.</p>}
      </div>

      <div className="space-y-2.5 rounded-xl border p-3.5">
        <span className="text-[13px] font-medium">Image</span>
        <Textarea rows={2} className="text-[13px]" placeholder="Describe the picture (no text in it)" value={slide.visual_prompt ?? ""} maxLength={600} onChange={(e) => onChange({ visual_prompt: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" disabled={busy || isNewSlide} onClick={() => onNewBg()}><ImagePlus className="h-4 w-4" />{slide.background_path ? "New image" : "Create image"}</Button>
          <Button size="sm" variant="outline" disabled={busy || isNewSlide} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Upload</Button>
        </div>
        {slide.background_path && (
          <>
            {slide.kind !== "hook" && (
              <Field label="Placement">
                <Segmented
                  size="sm"
                  className="w-full"
                  value={slide.layout}
                  onChange={(v) => onChange({ layout: v })}
                  options={[
                    { value: "top", label: "Below text" },
                    { value: "bottom", label: "Above text" },
                    { value: "split", label: "Side" },
                    { value: "center", label: "Full" },
                  ]}
                />
              </Field>
            )}
            <Field label="Image focus" hint="Slide to keep the important part of the picture in view.">
              <input type="range" min={0} max={100} value={st.focusY ?? 45} onChange={(e) => setStyle({ focusY: Number(e.target.value) })} className="w-full accent-[hsl(var(--accent))]" />
            </Field>
            <Button size="sm" variant="ghost" className="w-full" disabled={busy} onClick={() => onChange({ background_path: null })}>Remove image</Button>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && onNewBg(e.target.files[0])} />
      </div>

      <div className="rounded-xl border">
        <button className="flex w-full items-center justify-between px-3.5 py-3 text-[13px] font-medium" onClick={() => setShowStyle((s) => !s)}>
          This slide&apos;s colours and size
          <ChevronDown className={cn("h-4 w-4 transition-transform", showStyle && "rotate-180")} />
        </button>
        {showStyle && (
          <div className="space-y-3 border-t p-3.5">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {(["background", "text", "accent"] as const).map((k) => (
                <label key={k} className="flex flex-col items-center gap-1 capitalize">
                  <input type="color" value={st[k] ?? "#000000"} onChange={(e) => setStyle({ [k]: e.target.value })} className="h-8 w-full cursor-pointer rounded-lg border" />
                  {k}
                  {st[k] && <button className="text-[10px] text-muted-foreground underline" onClick={() => setStyle({ [k]: undefined })}>reset</button>}
                </label>
              ))}
            </div>
            <Field label={`Heading size ${Math.round((st.headingScale ?? 1) * 100)}%`}>
              <input type="range" min={0.6} max={1.4} step={0.05} value={st.headingScale ?? 1} onChange={(e) => setStyle({ headingScale: Number(e.target.value) })} className="w-full accent-[hsl(var(--accent))]" />
            </Field>
            {slide.background_path && (slide.kind === "hook" || slide.layout === "center") && (
              <Field label={`Image shade ${Math.round((st.overlay ?? 1) * 100)}%`}>
                <input type="range" min={0.3} max={1.2} step={0.05} value={st.overlay ?? 1} onChange={(e) => setStyle({ overlay: Number(e.target.value) })} className="w-full accent-[hsl(var(--accent))]" />
              </Field>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CaptionPanel({ projectId, platform, initial }: { projectId: string; platform: "instagram" | "linkedin" | "both"; initial: Caption[] }) {
  const plats: Caption["platform"][] = platform === "both" ? ["instagram", "linkedin"] : [platform];
  const [active, setActive] = useState<Caption["platform"]>(plats[0]);
  const [caps, setCaps] = useState<Record<string, Caption>>(() => Object.fromEntries(initial.map((c) => [c.platform, c])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const cap = caps[active];

  useEffect(() => {
    setCaps(Object.fromEntries(initial.map((c) => [c.platform, c])));
  }, [initial]);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const { caption } = await api<{ caption: Caption }>(`/api/projects/${projectId}/caption`, { method: "POST", json: { platform: active } });
      setCaps((c) => ({ ...c, [active]: caption }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(next: Caption) {
    try {
      await api(`/api/projects/${projectId}/caption`, { method: "PUT", json: next });
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px]">Caption <AiTag>draft</AiTag></h2>
        {plats.length > 1 && (
          <Segmented value={active} onChange={setActive} options={plats.map((p) => ({ value: p, label: p === "instagram" ? "Instagram" : "LinkedIn" }))} />
        )}
      </div>
      <div className="mt-4 space-y-3">
        <ErrorBanner error={err} />
        {cap ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Textarea rows={10} className="leading-relaxed" value={cap.body} onChange={(e) => setCaps({ ...caps, [active]: { ...cap, body: e.target.value } })} onBlur={() => save(cap)} />
            <div className="space-y-3">
              <Field label="Hashtags" hint="Separate with spaces.">
                <Textarea rows={5} value={cap.hashtags.join(" ")} onChange={(e) => setCaps({ ...caps, [active]: { ...cap, hashtags: e.target.value.split(/\s+/).filter(Boolean) } })} onBlur={() => save(cap)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(`${cap.body}\n\n${cap.hashtags.join(" ")}`, "all")}><Copy className="h-3.5 w-3.5" />{copied === "all" ? "Copied" : "Copy all"}</Button>
                <Button size="sm" variant="ghost" onClick={() => copy(cap.body, "body")}>{copied === "body" ? "Copied" : "Caption only"}</Button>
                <Button size="sm" variant="ghost" onClick={() => copy(cap.hashtags.join(" "), "tags")}>{copied === "tags" ? "Copied" : "Hashtags only"}</Button>
              </div>
              <Button size="sm" variant="soft" onClick={generate} loading={busy}>{!busy && <RefreshCw className="h-3.5 w-3.5" />}Write a new version</Button>
            </div>
          </div>
        ) : (
          <Button variant="soft" onClick={generate} loading={busy}>{!busy && <Wand2 className="h-4 w-4" />}Write the {active === "instagram" ? "Instagram" : "LinkedIn"} caption</Button>
        )}
      </div>
    </section>
  );
}
