"use client";
import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import type { Design } from "@/lib/types";
import { THEMES } from "@/lib/types";
import { THEME_PRESETS, contrast } from "@/lib/themes";
import { api } from "@/lib/api-client";
import { assetUrlClient } from "@/lib/asset-url";
import { Button, Field, Input, Select } from "@/components/ui";

export function ThemePicker({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {THEMES.map((t) => {
        const p = THEME_PRESETS[t];
        const active = design.theme === t;
        return (
          <button
            type="button"
            key={t}
            onClick={() => onChange({ ...design, theme: t, colors: p.colors, fontHeading: p.fontHeading, fontBody: p.fontBody })}
            className={`overflow-hidden rounded-lg border text-left transition ${active ? "ring-2 ring-accent" : "hover:border-foreground/30"}`}
          >
            <div className="flex h-14 items-end p-2" style={{ background: p.colors.background }}>
              <span style={{ color: p.colors.text, fontFamily: `var(--font-${p.fontHeading})` }} className="text-lg font-bold leading-none">
                Aa
              </span>
              <span className="ml-auto h-4 w-4 rounded-full" style={{ background: p.colors.accent }} />
            </div>
            <div className="px-2 py-1.5 text-xs font-medium">{p.label}</div>
          </button>
        );
      })}
    </div>
  );
}

export function ColorControls({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  const set = (k: keyof Design["colors"], v: string) => onChange({ ...design, colors: { ...design.colors, [k]: v } });
  const ratio = contrast(design.colors.text, design.colors.background);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["background", "text", "accent", "primary"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 rounded-lg border bg-card p-2 text-xs capitalize">
            <input type="color" value={design.colors[k]} onChange={(e) => set(k, e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
            {k}
          </label>
        ))}
      </div>
      {ratio < 4.5 && <p className="text-xs text-amber-700">Text/background contrast is {ratio.toFixed(1)}:1 — below 4.5:1, may be hard to read on phones.</p>}
    </div>
  );
}

export function FontControls({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Heading font">
        <Select value={design.fontHeading} onChange={(e) => onChange({ ...design, fontHeading: e.target.value as Design["fontHeading"] })}>
          <option value="display">Grotesque (Bricolage)</option>
          <option value="serif">Serif (Fraunces)</option>
          <option value="sans">Sans (Instrument)</option>
        </Select>
      </Field>
      <Field label="Body font">
        <Select value={design.fontBody} onChange={(e) => onChange({ ...design, fontBody: e.target.value as Design["fontBody"] })}>
          <option value="sans">Sans (Instrument)</option>
          <option value="display">Grotesque (Bricolage)</option>
          <option value="serif">Serif (Fraunces)</option>
        </Select>
      </Field>
    </div>
  );
}

export function LogoControls({ design, onChange }: { design: Design; onChange: (d: Design) => void }) {
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
      onChange({ ...design, logoPath: path, logoPosition: design.logoPosition === "none" ? "bottom-right" : design.logoPosition });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {design.logoPath ? (
          <div className="relative flex h-14 w-24 items-center justify-center rounded-lg border bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:12px_12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrlClient(design.logoPath)!} alt="Logo" className="max-h-12 max-w-20 object-contain" />
            <button type="button" onClick={() => onChange({ ...design, logoPath: null })} className="absolute -right-2 -top-2 rounded-full bg-primary p-0.5 text-primary-foreground" aria-label="Remove logo">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" /> {design.logoPath ? "Replace logo" : "Upload logo"}
        </Button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {err && <p className="text-xs text-rose-700">{err}</p>}
      {design.logoPath && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Logo position">
            <Select value={design.logoPosition} onChange={(e) => onChange({ ...design, logoPosition: e.target.value as Design["logoPosition"] })}>
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="none">Hidden</option>
            </Select>
          </Field>
          <Field label={`Logo size · ${design.logoSize}px`}>
            <input type="range" min={40} max={260} value={design.logoSize} onChange={(e) => onChange({ ...design, logoSize: Number(e.target.value) })} className="w-full accent-[hsl(var(--accent))]" />
          </Field>
        </div>
      )}
      <Field label="Handle on slides" hint="e.g. @editsimple — optional">
        <Input value={design.handle ?? ""} maxLength={60} onChange={(e) => onChange({ ...design, handle: e.target.value })} />
      </Field>
    </div>
  );
}
