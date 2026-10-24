"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PenLine, Search } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button, Empty, ErrorBanner, Field, Input, Select, Skeleton } from "@/components/ui";
import { DataNotice, HashtagPicker, KeywordDetail, KeywordTable, Sources } from "@/components/keywords";
import { api } from "@/lib/api-client";
import { NICHES } from "@/lib/niches";
import { useMarket, useNiche } from "@/lib/use-niche";
import type { KeywordMetric, SourceStatus } from "@/lib/types";

type Run = { id: string; topic: string; created_at: string; project_id: string | null };
type Res = { research: { id: string; topic: string; created_at: string; sources: SourceStatus[] }; rows: KeywordMetric[] };

export default function KeywordsPage() {
  const [niche] = useNiche();
  const [market] = useMarket();
  const [topic, setTopic] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [audience, setAudience] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Res | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  const loadRuns = () => api<{ runs: Run[] }>("/api/keywords").then((r) => setRuns(r.runs)).catch(() => undefined);
  useEffect(() => {
    loadRuns();
    const t = new URLSearchParams(window.location.search).get("topic");
    if (t) setTopic(t);
  }, []);

  const show = (r: Res) => {
    setRes(r);
    setFocus(r.rows.find((x) => x.kind === "seed")?.keyword ?? r.rows[0]?.keyword ?? null);
  };

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      show(await api<Res>("/api/keywords", { method: "POST", json: { topic, niche, market, specialty, audience, platform: "instagram" } }));
      loadRuns();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function open(id: string) {
    setError(null);
    try {
      show(await api<Res>(`/api/keywords?id=${id}`));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Keyword research" subtitle="Find the phrases with the best chance of spreading on Instagram — scored from this week's news, YouTube momentum and public interest." />

      <form onSubmit={run} className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <Field label="Topic"><Input required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={niche === "legal" ? "e.g. cheque bounce case" : "e.g. thyroid in women"} /></Field>
        <Field label="Specialty">
          <Select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">Any</option>
            {NICHES[niche].specialties.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Audience"><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={NICHES[niche].audiences[0]} /></Field>
        <Button type="submit" variant="accent" loading={busy}>{!busy && <Search className="h-4 w-4" />}Research</Button>
      </form>
      <ErrorBanner error={error} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {busy ? (
            <div className="space-y-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : res ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px]">
                  {res.research.topic} <span className="text-[13px] text-muted-foreground">checked {new Date(res.research.created_at).toLocaleString()}</span>
                </p>
                <Link href={`/create?niche=${niche}&topic=${encodeURIComponent(res.research.topic)}`}>
                  <Button size="sm" variant="soft"><PenLine className="h-3.5 w-3.5" />Write a post on this</Button>
                </Link>
              </div>
              <Sources sources={res.research.sources} />
              <KeywordTable rows={res.rows} focusedKeyword={focus} onFocus={setFocus} />
              <DataNotice />
            </>
          ) : (
            <Empty title="Start with a topic">Search a topic your audience cares about. You&apos;ll get the phrases most likely to travel, with the evidence behind each score.</Empty>
          )}
        </div>
        <aside className="space-y-4">
          {res && <KeywordDetail row={res.rows.find((r) => r.keyword === focus) ?? null} />}
          {res && <HashtagPicker rows={res.rows} />}
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="text-[15px]">Earlier searches</h3>
            {runs.length ? (
              <ul className="mt-2 space-y-0.5">
                {runs.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => open(r.id)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-secondary">
                      <span className="line-clamp-1 text-[13px]">{r.topic}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-muted-foreground">Your searches will be listed here.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
