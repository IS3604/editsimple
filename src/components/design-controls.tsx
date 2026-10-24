"use client";
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import type { Design } from "@/lib/types";
import { TEMPLATES as TEMPLATE_KEYS } from "@/lib/types";
import { FONTS, TEMPLATES, contrast } from "@/lib/themes";
import type { Niche } from "@/lib/niches";
import { api } from "@/lib/api-client";
import { assetUrlClient } from "@/lib/asset-url";
import { Button, Field, Input, Segmented, Select } from "@/components/ui";
import { ScaledSlide, SlideCanvas } from "@/components/slide-canvas";
import { cn } from "@/lib/utils";

/** Template gallery — each option is a real rendered cover with the user's own words. */
export function TemplatePicker({
  design,
  onChange,
  heading = "Your hook appears here",
  niche,
  columns = 4,
}: {
  design: Design;
  onChange: (d: Design) => void;
  heading?: string;
  niche?: Niche;
  columns?: number;
}) {
  return (
    <div className={cn("grid gap-3", columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
      {TEMPLATE_KEYS.map((t) => {
        const spec = TEMPLATES[t];
        const active = design.template === t;
        return (
          <button
            type="button"
            key={t}
            onClick={() => onChange({ ...design, template: t, colors: spec.colors, fontHeading: spec.fontHeading, fontBody: spec.fontBody })}
            className={cn("group rounded-2xl p-1.5 text-left transition-all", active ? "bg-[hsl(var(--accent-soft))] ring-2 ring-accent" : "hover:bg-secondary")}
            aria-pressed={active}
          >
            <div className="overflow-hidden rounded-xl ring-1 ring-black/5">
              <ScaledSlide width={150} size="1080x1350">
                <SlideCanvas
                  slide={{ id: `tpl-${t}`, kind: "hook", role: "hook", kicker: "", heading, body: "", layout: "center", style: {}, background_path: null }}
                  design={{ ...design, template: t, colors: spec.colors, fontHeading: spec.fontHeading, fontBody: spec.fontBody, logoPath: null }}
                  size="1080x1350"
                  index={0}
                  total={7}
                  bgUrl={null}
                  logoUrl={null}
                />
              </ScaledSlide>
            </div>
            <div className="px-1.5 pb-1 pt-2">
              <div className="flex items-center gap-1.5 text-[13px] font-medium">
                {spec.label}
                {niche && spec.bestFor === niche && <span className="rounded-full bg-card px-1.5 text-[10px] font-medium text-accent ring-1 ring-border">Suits you</span>}
              </div>
              <div className="line-clamp-1 text-[11px] text-muted-foreground">{spec.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ColorControls({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  const set = (k: keyof Design["colors"], v: string) => onChange({ ...design, colors: { ...design.colors, [k]: v } });
  const ratio = contrast(design.colors.text, design.colors.background);
  const labels: Record<keyof Design["colors"], string> = { background: "Background", text: "Text", accent: "Accent", surface: "Panels" };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(["background", "text", "accent", "surface"] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-xl border bg-card p-2 text-[13px] hover:border-foreground/25">
            <span className="relative h-7 w-7 overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: design.colors[k] }}>
              <input type="color" value={design.colors[k]} onChange={(e) => set(k, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={labels[k]} />
            </span>
            <span className="min-w-0">
              <span className="block leading-tight">{labels[k]}</span>
              <span className="block font-mono text-[10px] uppercase text-muted-foreground">{design.colors[k]}</span>
            </span>
          </label>
        ))}
      </div>
      {ratio < 4.5 && <p className="text-xs text-amber-700">Text on background is {ratio.toFixed(1)}:1 — under 4.5:1, which gets hard to read on a phone in sunlight.</p>}
    </div>
  );
}

export function FontControls({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  const [target, setTarget] = useState<"heading" | "body">("heading");
  const current = target === "heading" ? design.fontHeading : design.fontBody;
  const keys = (Object.keys(FONTS) as Design["fontHeading"][]).filter((k) => !FONTS[k].hidden && (target === "heading" || !FONTS[k].headingOnly));
  const groups = (["Sans", "Display", "Serif"] as const).map((g) => ({ g, items: keys.filter((k) => FONTS[k].kind === g) }));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">Fonts</span>
        <Segmented size="sm" value={target} onChange={setTarget} options={[{ value: "heading", label: `Headings: ${FONTS[design.fontHeading].label}` }, { value: "body", label: `Body: ${FONTS[design.fontBody].label}` }]} />
      </div>
      {groups.map(({ g, items }) => (
        <div key={g}>
          <p className="mb-1.5 text-[11px] text-muted-foreground">{g}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((k) => {
              const f = FONTS[k];
              const on = current === k;
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => onChange(target === "heading" ? { ...design, fontHeading: k } : { ...design, fontBody: k })}
                  className={cn("rounded-lg border px-2 py-2 text-left transition-colors", on ? "border-accent bg-[hsl(var(--accent-soft))]" : "bg-card hover:border-foreground/30")}
                  aria-pressed={on}
                >
                  <span className="block truncate text-[19px] leading-tight" style={{ fontFamily: f.family, fontWeight: f.fixedWeight ?? (target === "heading" ? 700 : 400) }}>
                    {target === "heading" ? "Aa Bb" : "Aa bb cc"}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IdentityControls({ design, onChange, niche }: { design: Design; onChange: (d: Design) => void; niche?: Niche }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(f: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("kind", "logo");
      const { path } = await api<{ path: string }>("/api/uploads", { method: "POST", body: fd });
      onChange({ ...design, logoPath: path, logoPosition: design.logoPosition === "none" ? "top-left" : design.logoPosition });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name on slides">
          <Input value={design.name ?? ""} maxLength={60} placeholder={niche === "legal" ? "Adv. Karan Mehta" : "Dr. Ananya Rao"} onChange={(e) => onChange({ ...design, name: e.target.value })} />
        </Field>
        <Field label="Handle">
          <Input value={design.handle ?? ""} maxLength={60} placeholder="@yourhandle" onChange={(e) => onChange({ ...design, handle: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {design.logoPath && (
          <div className="relative flex h-12 w-20 items-center justify-center rounded-lg border bg-[repeating-conic-gradient(#eef0f3_0_25%,#fff_0_50%)] bg-[length:10px_10px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrlClient(design.logoPath)!} alt="Your logo" className="max-h-10 max-w-16 object-contain" />
            <button type="button" onClick={() => onChange({ ...design, logoPath: null })} className="absolute -right-2 -top-2 rounded-full bg-primary p-0.5 text-primary-foreground" aria-label="Remove logo">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
          {!busy && <Upload className="h-3.5 w-3.5" />} {design.logoPath ? "Replace logo" : "Add logo"}
        </Button>
        {design.logoPath && (
          <Select className="h-8 w-auto text-[13px]" value={design.logoPosition} onChange={(e) => onChange({ ...design, logoPosition: e.target.value as Design["logoPosition"] })}>
            <option value="top-left">Top left</option>
            <option value="top-right">Top right</option>
            <option value="bottom-right">Bottom right</option>
            <option value="none">Hidden</option>
          </Select>
        )}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </div>
  );
}

export function ImageModeControl({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  return (
    <Field label="AI images" hint="Images never contain text — your words are typeset by EditSimple, so they're always sharp and correctly spelled.">
      <Segmented
        className="w-full"
        value={design.imageMode}
        onChange={(v) => onChange({ ...design, imageMode: v })}
        options={[
          { value: "cover-only", label: "Cover only" },
          { value: "per-slide", label: "Cover + 1" },
          { value: "none", label: "None" },
        ]}
      />
    </Field>
  );
}
