"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button, Card, CardContent, CardHeader, CardTitle, Empty, ErrorBanner, Field, Input, Spinner } from "@/components/ui";
import { ColorControls, FontControls, LogoControls, ThemePicker } from "@/components/design-controls";
import { ScaledSlide, SlideCanvas } from "@/components/slide-canvas";
import { api } from "@/lib/api-client";
import { assetUrlClient } from "@/lib/asset-url";
import { defaultDesign } from "@/lib/themes";
import type { Design } from "@/lib/types";

type Brand = {
  id?: string; name: string; theme: Design["theme"]; colors: Design["colors"]; font_heading: Design["fontHeading"]; font_body: Design["fontBody"];
  logo_path: string | null; tone: string | null; language: string | null; is_default: boolean;
};

const toDesign = (b: Brand): Design => ({ ...defaultDesign(b.theme), colors: b.colors, fontHeading: b.font_heading, fontBody: b.font_body, logoPath: b.logo_path });
const fromDesign = (b: Brand, d: Design): Brand => ({ ...b, theme: d.theme, colors: d.colors, font_heading: d.fontHeading, font_body: d.fontBody, logo_path: d.logoPath ?? null });
const blankBrand = (): Brand => {
  const d = defaultDesign();
  return { name: "My brand", theme: d.theme, colors: d.colors, font_heading: d.fontHeading, font_body: d.fontBody, logo_path: null, tone: "clear and confident", language: "English", is_default: true };
};

export default function BrandPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [edit, setEdit] = useState<Brand | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = () =>
    api<{ brands: Brand[] }>("/api/brand")
      .then((r) => {
        setBrands(r.brands);
        setEdit((e) => e ?? r.brands[0] ?? null);
      })
      .catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save() {
    if (!edit) return;
    setBusy(true);
    setError(null);
    try {
      const { brand } = await api<{ brand: Brand }>("/api/brand", { method: "PUT", json: edit });
      setEdit(brand);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
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

  if (!brands) return error ? <ErrorBanner error={error} /> : <div className="grid h-48 place-items-center"><Spinner /></div>;
  const design = edit ? toDesign(edit) : null;

  return (
    <div>
      <PageHeader title="Brand settings" subtitle="Saved kits pre-fill every new carousel." actions={<Button variant="outline" onClick={() => setEdit(blankBrand())}><Plus className="h-4 w-4" />New kit</Button>} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr_340px]">
        <Card className="h-fit p-2">
          {brands.length ? brands.map((b) => (
            <button key={b.id} onClick={() => setEdit(b)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${edit?.id === b.id ? "bg-secondary" : "hover:bg-secondary/60"}`}>
              <span className="h-4 w-4 rounded-full border" style={{ background: b.colors.accent }} />
              <span className="flex-1 truncate">{b.name}</span>
              {b.is_default && <span className="text-[10px] uppercase text-muted-foreground">default</span>}
            </button>
          )) : <p className="p-3 text-sm text-muted-foreground">No kits yet.</p>}
        </Card>

        {edit && design ? (
          <Card>
            <CardHeader><CardTitle>{edit.id ? "Edit kit" : "New kit"}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Name"><Input value={edit.name} maxLength={60} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                <Field label="Default tone"><Input value={edit.tone ?? ""} maxLength={80} onChange={(e) => setEdit({ ...edit, tone: e.target.value })} /></Field>
                <Field label="Language"><Input value={edit.language ?? ""} maxLength={40} onChange={(e) => setEdit({ ...edit, language: e.target.value })} /></Field>
              </div>
              <ThemePicker design={design} onChange={(d) => setEdit(fromDesign(edit, d))} />
              <ColorControls design={design} onChange={(d) => setEdit(fromDesign(edit, d))} />
              <FontControls design={design} onChange={(d) => setEdit(fromDesign(edit, d))} />
              <LogoControls design={design} onChange={(d) => setEdit(fromDesign(edit, d))} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.is_default} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} className="accent-[hsl(var(--accent))]" />
                Use as default for new carousels
              </label>
              <ErrorBanner error={error} />
              <div className="flex gap-2">
                <Button onClick={save} loading={busy}>{ok ? "Saved ✓" : "Save kit"}</Button>
                {edit.id && <Button variant="ghost" onClick={() => remove(edit.id!)}><Trash2 className="h-4 w-4" />Delete</Button>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Empty title="Create a brand kit" action={<Button className="mt-3" onClick={() => setEdit(blankBrand())}>New kit</Button>}>Colours, fonts and logo you reuse on every carousel.</Empty>
        )}

        {design && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Preview</p>
            <div className="overflow-hidden rounded-xl shadow-lg">
              <ScaledSlide width={340} size="1080x1350">
                <SlideCanvas
                  slide={{ id: "preview", role: "hook", kicker: "Brand preview", heading: "Your carousels, on brand every time", body: "Headings, body copy, accents and logo placement update live.", layout: "top", style: {}, background_path: null }}
                  design={{ ...design, handle: "@yourbrand" }}
                  size="1080x1350"
                  index={0}
                  total={7}
                  bgUrl={null}
                  logoUrl={assetUrlClient(design.logoPath)}
                />
              </ScaledSlide>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
