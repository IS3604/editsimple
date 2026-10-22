"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ErrorBanner, Field, Input, Select, Textarea } from "@/components/ui";
import { ColorControls, FontControls, LogoControls, ThemePicker } from "@/components/design-controls";
import { DataNotice, HashtagPicker, KeywordDetail, KeywordTable, Sources } from "@/components/keywords";
import { api } from "@/lib/api-client";
import { defaultDesign } from "@/lib/themes";
import type { BriefInput, Design, KeywordMetric, SourceStatus } from "@/lib/types";

type Brand = { id: string; name: string; theme: Design["theme"]; colors: Design["colors"]; font_heading: Design["fontHeading"]; font_body: Design["fontBody"]; logo_path: string | null; tone: string | null; language: string | null; is_default: boolean };

const brandToDesign = (b: Brand, base: Design): Design => ({ ...base, theme: b.theme, colors: b.colors, fontHeading: b.font_heading, fontBody: b.font_body, logoPath: b.logo_path });

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Omit<BriefInput, "keywords"> & { keywordsText: string }>({
    topic: "",
    industry: "",
    audience: "",
    platform: "instagram",
    slideCount: 7,
    objective: "education",
    tone: "clear and confident",
    language: "English",
    referenceUrl: "",
    keywordsText: "",
    size: "1080x1350",
    design: defaultDesign(),
  });
  const [brands, setBrands] = useState<Brand[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [researchId, setResearchId] = useState<string | null>(null);
  const [rows, setRows] = useState<(KeywordMetric & { id: string })[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [customList, setCustomList] = useState<string[]>([]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("topic");
    if (t) setForm((f) => ({ ...f, topic: t.slice(0, 200) }));
    api<{ brands: Brand[] }>("/api/brand")
      .then(({ brands }) => {
        setBrands(brands);
        const def = brands.find((b) => b.is_default);
        if (def) setForm((f) => ({ ...f, design: brandToDesign(def, f.design), tone: def.tone || f.tone, language: def.language || f.language }));
      })
      .catch(() => undefined);
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setDesign = (d: Design) => set("design", d);

  async function research(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const keywords = form.keywordsText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15);
      const { keywordsText: _k, ...rest } = form;
      // brief changed after a previous research pass → replace the draft project
      if (projectId) await api(`/api/projects/${projectId}`, { method: "DELETE" }).catch(() => undefined);
      const { project } = await api<{ project: { id: string } }>("/api/projects", { method: "POST", json: { ...rest, keywords } });
      const pid = project.id;
      setProjectId(pid);
      const res = await api<{ research: { id: string; sources: SourceStatus[] }; rows: (KeywordMetric & { id: string })[] }>("/api/keywords", {
        method: "POST",
        json: { topic: form.topic, niche: form.industry, platform: form.platform, audience: form.audience, userKeywords: keywords, projectId: pid },
      });
      setResearchId(res.research.id);
      setSources(res.research.sources);
      setRows(res.rows);
      setFocus(res.rows.find((r) => r.kind === "seed")?.keyword ?? null);
      setStep(2);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!projectId || !researchId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/keywords`, {
        method: "PUT",
        json: { researchId, selectedIds: rows.filter((r) => r.selected).map((r) => r.id), custom: customList },
      });
      router.push(`/projects/${projectId}?generate=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const selectedCount = useMemo(() => rows.filter((r) => r.selected && r.kind !== "hashtag").length + customList.length, [rows, customList]);

  if (step === 2)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pick your keywords"
          subtitle={`Research for “${form.topic}” — choose what the carousel should weave in.`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Edit brief
              </Button>
              <Button variant="accent" size="lg" onClick={generate} loading={busy} disabled={!selectedCount}>
                <Sparkles className="h-4 w-4" /> Generate carousel ({selectedCount})
              </Button>
            </div>
          }
        />
        <Sources sources={sources} />
        <DataNotice />
        <ErrorBanner error={error} />
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <KeywordTable
              rows={rows}
              focusedKeyword={focus}
              onFocus={setFocus}
              onToggle={(k) => setRows((rs) => rs.map((r) => (r.keyword === k ? { ...r, selected: !r.selected } : r)))}
            />
            <Card className="p-4">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = custom.trim();
                  if (v && !customList.includes(v) && customList.length < 15) setCustomList([...customList, v]);
                  setCustom("");
                }}
              >
                <Input placeholder="Add your own keyword…" value={custom} maxLength={80} onChange={(e) => setCustom(e.target.value)} />
                <Button type="submit" variant="outline"><Plus className="h-4 w-4" />Add</Button>
              </form>
              {customList.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {customList.map((c) => (
                    <button key={c} onClick={() => setCustomList(customList.filter((x) => x !== c))}>
                      <Badge>{c} ×</Badge>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <div className="space-y-4">
            <KeywordDetail row={rows.find((r) => r.keyword === focus) ?? null} />
            <HashtagPicker rows={rows} />
          </div>
        </div>
      </div>
    );

  return (
    <div>
      <PageHeader title="Create a carousel" subtitle="Brief → keyword research → copy → visuals → export." />
      <form onSubmit={research} className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Content</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Topic" className="sm:col-span-2">
                <Input required minLength={3} maxLength={200} placeholder="e.g. Why most landing pages don't convert" value={form.topic} onChange={(e) => set("topic", e.target.value)} />
              </Field>
              <Field label="Industry / niche"><Input value={form.industry} maxLength={120} placeholder="SaaS, fitness, real estate…" onChange={(e) => set("industry", e.target.value)} /></Field>
              <Field label="Target audience"><Input value={form.audience} maxLength={200} placeholder="Early-stage founders" onChange={(e) => set("audience", e.target.value)} /></Field>
              <Field label="Platform">
                <Select value={form.platform} onChange={(e) => set("platform", e.target.value as BriefInput["platform"])}>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="both">Both</option>
                </Select>
              </Field>
              <Field label="Slides">
                <Select value={form.slideCount} onChange={(e) => set("slideCount", Number(e.target.value) as 6 | 7)}>
                  <option value={6}>6 slides</option>
                  <option value={7}>7 slides</option>
                </Select>
              </Field>
              <Field label="Objective">
                <Select value={form.objective} onChange={(e) => set("objective", e.target.value as BriefInput["objective"])}>
                  <option value="education">Education</option>
                  <option value="engagement">Engagement</option>
                  <option value="awareness">Awareness</option>
                  <option value="leads">Leads</option>
                </Select>
              </Field>
              <Field label="Format" hint="LinkedIn accepts both; square suits feed posts">
                <Select value={form.size} onChange={(e) => set("size", e.target.value as BriefInput["size"])}>
                  <option value="1080x1350">Portrait 1080 × 1350</option>
                  <option value="1080x1080">Square 1080 × 1080</option>
                </Select>
              </Field>
              <Field label="Tone"><Input value={form.tone} maxLength={80} onChange={(e) => set("tone", e.target.value)} /></Field>
              <Field label="Language"><Input value={form.language} maxLength={40} onChange={(e) => set("language", e.target.value)} /></Field>
              <Field label="Keywords (optional)" hint="Comma-separated" className="sm:col-span-2">
                <Textarea rows={2} value={form.keywordsText} onChange={(e) => set("keywordsText", e.target.value)} placeholder="conversion rate, landing page design" />
              </Field>
              <Field label="Reference URL (optional)" hint="Public pages only — Instagram/LinkedIn posts need login and won't be read" className="sm:col-span-2">
                <Input type="url" value={form.referenceUrl} onChange={(e) => set("referenceUrl", e.target.value)} placeholder="https://…" />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Design</CardTitle>
              {brands.length > 0 && (
                <Select
                  className="mt-2"
                  defaultValue={brands.find((b) => b.is_default)?.id}
                  onChange={(e) => {
                    const b = brands.find((x) => x.id === e.target.value);
                    if (b) setDesign(brandToDesign(b, form.design));
                  }}
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>Brand kit: {b.name}</option>
                  ))}
                </Select>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              <ThemePicker design={form.design} onChange={setDesign} />
              <ColorControls design={form.design} onChange={setDesign} />
              <FontControls design={form.design} onChange={setDesign} />
              <LogoControls design={form.design} onChange={setDesign} />
              <Field label="AI images" hint="Text is never drawn by the image model — it's rendered by the app">
                <Select value={form.design.imageMode} onChange={(e) => setDesign({ ...form.design, imageMode: e.target.value as Design["imageMode"] })}>
                  <option value="per-slide">A visual for every slide</option>
                  <option value="cover-only">Cover slide only</option>
                  <option value="none">No AI images (designed text slides)</option>
                </Select>
              </Field>
            </CardContent>
          </Card>
          <ErrorBanner error={error} />
          <Button type="submit" size="lg" variant="accent" className="w-full" loading={busy}>
            {busy ? "Researching keywords…" : "Research keywords →"}
          </Button>
        </div>
      </form>
    </div>
  );
}
