"use client";
import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button, Empty, ErrorBanner, Field, Input, Segmented, Select, Skeleton } from "@/components/ui";
import { ColorControls, FontControls, IdentityControls, TemplatePicker } from "@/components/design-controls";
import { PhonePreview } from "@/components/phone-preview";
import { api } from "@/lib/api-client";
import { NICHES, type Niche } from "@/lib/niches";
import { defaultDesign, nicheDefaultTemplate } from "@/lib/themes";
import { DesignSchema, type Design } from "@/lib/types";
import { useNiche } from "@/lib/use-niche";
import { cn } from "@/lib/utils";

type Brand = {
  id?: string;
  name: string;
  niche: Niche | null;
  theme: string;
  colors: Design["colors"];
  font_heading: Design["fontHeading"];
  font_body: Design["fontBody"];
  logo_path: string | null;
  display_name: string | null;
  handle: string | null;
  tone: string | null;
  language: string | null;
  is_default: boolean;
};

const toDesign = (b: Brand): Design => {
  const t = DesignSchema.shape.template.safeParse(b.theme);
  const base = defaultDesign(t.success ? t.data : "studio");
  const colors = DesignSchema.shape.colors.safeParse(b.colors);
  return { ...base, colors: colors.success ? colors.data : base.colors, fontHeading: DesignSchema.shape.fontHeading.safeParse(b.font_heading).data ?? base.fontHeading, fontBody: DesignSchema.shape.fontBody.safeParse(b.font_body).data ?? base.fontBody, logoPath: b.logo_path, name: b.display_name ?? "", handle: b.handle ?? "" };
};
const fromDesign = (b: Brand, d: Design): Brand => ({ ...b, theme: d.template, colors: d.colors, font_heading: d.fontHeading, font_body: d.fontBody, logo_path: d.logoPath ?? null, display_name: d.name || null, handle: d.handle || null });
const blankBrand = (niche: Niche): Brand => {
  const d = defaultDesign(nicheDefaultTemplate(niche));
  return { name: niche === "legal" ? "My practice" : "My clinic", niche, theme: d.template, colors: d.colors, font_heading: d.fontHeading, font_body: d.fontBody, logo_path: null, display_name: null, handle: null, tone: "warm, clear and expert", language: "English", is_default: true };
};

export default function BrandPage() {
  const [niche] = useNiche();
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [edit, setEdit] = useState<Brand | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = () =>
    api<{ brands: Brand[] }>("/api/brand")
      .then((r) => {
        setBrands(r.brands);
        setEdit((e) => e ?? r.brands[0] ?? null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      const { brand } = await api<{ brand: Brand }>("/api/brand", { method: "PUT", json: edit });
      setEdit(brand);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api(`/api/brand?id=${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    setEdit(null);
    load();
  }

  if (!brands) return error ? <ErrorBanner error={error} /> : <Skeleton className="h-96" />;
  const design = edit ? toDesign(edit) : null;
  const kitNiche: Niche = edit?.niche ?? niche;

  return (
    <div>
      <PageHeader
        title="Brand kit"
        subtitle="Your template, colours, name and logo — applied to every new carousel automatically."
        actions={<Button variant="outline" onClick={() => setEdit(blankBrand(niche))}><Plus className="h-4 w-4" />New kit</Button>}
      />

      {brands.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={() => setEdit(b)}
              className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px]", edit?.id === b.id ? "border-foreground bg-card" : "bg-card/60 hover:border-foreground/30")}
            >
              <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: b.colors.accent }} />
              {b.name}
              {b.is_default && <span className="text-xs text-muted-foreground">default</span>}
            </button>
          ))}
        </div>
      )}

      {edit && design ? (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="grid gap-5 rounded-2xl border bg-card p-6 sm:grid-cols-2">
              <Field label="Kit name"><Input value={edit.name} maxLength={60} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="For">
                <Segmented
                  className="w-full"
                  value={kitNiche}
                  onChange={(v) => setEdit({ ...edit, niche: v })}
                  options={[{ value: "medical", label: "Doctors" }, { value: "legal", label: "Lawyers" }]}
                />
              </Field>
              <Field label="Default tone"><Input value={edit.tone ?? ""} maxLength={80} onChange={(e) => setEdit({ ...edit, tone: e.target.value })} /></Field>
              <Field label="Default language">
                <Select value={edit.language ?? "English"} onChange={(e) => setEdit({ ...edit, language: e.target.value })}>
                  {["English", "Hinglish", "Hindi", "Marathi", "Tamil", "Telugu", "Bengali", "Gujarati", "Kannada"].map((l) => <option key={l}>{l}</option>)}
                </Select>
              </Field>
            </section>
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-[15px]">Identity</h2>
              <div className="mt-4"><IdentityControls design={design} onChange={(d) => setEdit(fromDesign(edit, d))} niche={kitNiche} /></div>
            </section>
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-[15px]">Template</h2>
              <div className="mt-4"><TemplatePicker design={design} onChange={(d) => setEdit(fromDesign(edit, d))} niche={kitNiche} heading={kitNiche === "legal" ? "Your rights, explained simply" : "Health facts, explained simply"} /></div>
            </section>
            <section className="space-y-5 rounded-2xl border bg-card p-6">
              <h2 className="text-[15px]">Colours and type</h2>
              <ColorControls design={design} onChange={(d) => setEdit(fromDesign(edit, d))} />
              <FontControls design={design} onChange={(d) => setEdit(fromDesign(edit, d))} />
            </section>
            <label className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={edit.is_default} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--accent))]" />
              Use this kit for new carousels
            </label>
            <ErrorBanner error={error} />
            <div className="flex gap-2">
              <Button variant="accent" onClick={save} loading={busy}>{saved ? <><Check className="h-4 w-4" />Saved</> : "Save kit"}</Button>
              {edit.id && <Button variant="ghost" onClick={() => remove(edit.id!)}><Trash2 className="h-4 w-4" />Delete kit</Button>}
            </div>
          </div>
          <aside className="hidden xl:block">
            <div className="sticky top-8">
              <PhonePreview
                slide={{ id: "kit", kind: "hook", role: "hook", kicker: kitNiche === "legal" ? "Know your rights" : "Health", heading: kitNiche === "legal" ? "Your landlord can't keep the deposit for this" : "Chest pain after 40 is not always gas", body: "", layout: "center", style: {}, background_path: null }}
                design={design}
                size="1080x1350"
                total={7}
                disclaimer={NICHES[kitNiche].disclaimer}
              />
            </div>
          </aside>
        </div>
      ) : (
        <Empty title="Set up your brand kit" action={<Button className="mt-4" variant="accent" onClick={() => setEdit(blankBrand(niche))}>Create kit</Button>}>
          Save your template, colours, name and logo once, and every carousel starts on brand.
        </Empty>
      )}
    </div>
  );
}
