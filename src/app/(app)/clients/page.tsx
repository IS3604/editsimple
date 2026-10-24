"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, PenLine, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button, Empty, ErrorBanner, Field, Input, Segmented, Select, Skeleton, Textarea } from "@/components/ui";
import { ColorControls, FontControls, IdentityControls, TemplatePicker } from "@/components/design-controls";
import { ImportTemplateButton } from "@/components/import-template";
import { PhonePreview } from "@/components/phone-preview";
import { api } from "@/lib/api-client";
import { NICHES, type Niche } from "@/lib/niches";
import { MARKETS, MARKET_CODES, marketOf, type MarketCode } from "@/lib/markets";
import { blankClient, clientDesign, withDesign, type Client } from "@/lib/clients";
import { useMarket, useNiche } from "@/lib/use-niche";
import { cn } from "@/lib/utils";

export default function ClientsPage() {
  const [niche] = useNiche();
  const [market] = useMarket();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [edit, setEdit] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = () =>
    api<{ brands: Client[] }>("/api/brand")
      .then((r) => setClients(r.brands.map((b) => ({ ...b, market: marketOf(b.market) }))))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!edit) return;
    if (!edit.name.trim()) return setError("Give the client a name.");
    setBusy(true);
    setError(null);
    try {
      const { brand } = await api<{ brand: Client }>("/api/brand", { method: "PUT", json: edit });
      setEdit({ ...brand, market: marketOf(brand.market) });
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

  if (!clients) return error ? <ErrorBanner error={error} /> : <Skeleton className="h-96" />;
  const design = edit ? clientDesign(edit) : null;
  const kitNiche: Niche = edit?.niche ?? niche;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="One profile per doctor or law firm you manage — their market, voice and look. Pick a client when you start a post and everything fills in."
        actions={<Button variant="accent" onClick={() => setEdit(blankClient(niche, market))}><Plus className="h-4 w-4" />Add client</Button>}
      />

      {clients.length > 0 && (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setEdit(c)}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-all hover:shadow-[0_10px_24px_-18px_rgb(15_18_30/.5)]",
                edit?.id === c.id && "border-accent ring-1 ring-accent"
              )}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[13px] font-semibold" style={{ background: c.colors.background, color: c.colors.text, boxShadow: `inset 0 0 0 2px ${c.colors.accent}` }}>
                {(c.display_name || c.name).replace(/^(Dr\.?|Adv\.?)\s*/i, "").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.niche ? NICHES[c.niche].label.slice(0, -1) : "Client"}{c.specialty ? `, ${c.specialty}` : ""} in {MARKETS[c.market].label}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {edit && design ? (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-[15px]">Client</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <Field label="Client or practice name"><Input value={edit.name} maxLength={60} placeholder={kitNiche === "legal" ? "Hart & Cole Law" : "Bright Smile Dental"} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                <Field label="Type">
                  <Segmented className="w-full" value={kitNiche} onChange={(v) => setEdit({ ...edit, niche: v, specialty: null })} options={[{ value: "medical", label: "Doctor" }, { value: "legal", label: "Lawyer" }]} />
                </Field>
                <Field label="Specialty">
                  <Select value={edit.specialty ?? ""} onChange={(e) => setEdit({ ...edit, specialty: e.target.value || null })}>
                    <option value="">General</option>
                    {NICHES[kitNiche].specialties.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </Field>
                <Field label="Audience is in">
                  <Select value={edit.market} onChange={(e) => setEdit({ ...edit, market: e.target.value as MarketCode })}>
                    {MARKET_CODES.map((c) => <option key={c} value={c}>{MARKETS[c].label}</option>)}
                  </Select>
                </Field>
                <Field label="Typical audience" className="sm:col-span-2">
                  <Input value={edit.audience ?? ""} maxLength={200} placeholder={NICHES[kitNiche].audiences[0]} onChange={(e) => setEdit({ ...edit, audience: e.target.value })} />
                </Field>
                <Field label="Voice and account notes" className="sm:col-span-2" hint="Shared with the AI on every post for this client — e.g. topics to avoid, words they never use, services to focus on.">
                  <Textarea rows={3} maxLength={600} value={edit.notes ?? ""} placeholder="Calm and reassuring. Never mention pricing. Focus on Invisalign and family dentistry." onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
                </Field>
                <Field label="Tone"><Input value={edit.tone ?? ""} maxLength={80} onChange={(e) => setEdit({ ...edit, tone: e.target.value })} /></Field>
                <Field label="Language">
                  <Select value={edit.language ?? "English"} onChange={(e) => setEdit({ ...edit, language: e.target.value })}>
                    {["English", "Spanish", "French", "German", "Arabic", "Portuguese", "Hindi"].map((l) => <option key={l}>{l}</option>)}
                  </Select>
                </Field>
              </div>
            </section>
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-[15px]">Name, handle and logo on slides</h2>
              <div className="mt-4"><IdentityControls design={design} onChange={(d) => setEdit(withDesign(edit, d))} niche={kitNiche} /></div>
            </section>
            <section className="rounded-2xl border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px]">Look</h2>
                <ImportTemplateButton design={design} onApply={(d) => setEdit(withDesign(edit, d))} heading={edit.name || undefined} />
              </div>
              <div className="mt-4"><TemplatePicker design={design} onChange={(d) => setEdit(withDesign(edit, d))} niche={kitNiche} heading={kitNiche === "legal" ? "Your rights, explained simply" : "Health facts, explained simply"} /></div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <ColorControls design={design} onChange={(d) => setEdit(withDesign(edit, d))} />
                <FontControls design={design} onChange={(d) => setEdit(withDesign(edit, d))} />
              </div>
            </section>
            <ErrorBanner error={error} />
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={save} loading={busy}>{saved ? <><Check className="h-4 w-4" />Saved</> : "Save client"}</Button>
              {edit.id && (
                <Link href={`/create?client=${edit.id}`}><Button variant="outline"><PenLine className="h-4 w-4" />New post for {edit.name || "this client"}</Button></Link>
              )}
              {edit.id && <Button variant="ghost" onClick={() => remove(edit.id!)}><Trash2 className="h-4 w-4" />Delete</Button>}
            </div>
          </div>
          <aside className="hidden xl:block">
            <div className="sticky top-8">
              <PhonePreview
                slide={{ id: "client", kind: "hook", role: "hook", kicker: edit.specialty ?? "", heading: kitNiche === "legal" ? "What to do in the first 24 hours after an accident" : "Chest pain after 40 is not always heartburn", body: "", layout: "center", style: {}, background_path: null }}
                design={design}
                size="1080x1350"
                total={7}
                disclaimer={NICHES[kitNiche].disclaimer}
              />
            </div>
          </aside>
        </div>
      ) : (
        clients.length === 0 && (
          <Empty title="Add your first client" action={<Button className="mt-4" variant="accent" onClick={() => setEdit(blankClient(niche, market))}>Add client</Button>}>
            Save each doctor or firm once — specialty, market, voice notes, template and logo — and every post starts on brand.
          </Empty>
        )
      )}
    </div>
  );
}
