"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { History, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button, Card, Empty, ErrorBanner, Field, Input, Select } from "@/components/ui";
import { DataNotice, HashtagPicker, KeywordDetail, KeywordTable, Sources } from "@/components/keywords";
import { api } from "@/lib/api-client";
import type { KeywordMetric, SourceStatus } from "@/lib/types";

type Run = { id: string; topic: string; niche: string | null; platform: string | null; created_at: string; project_id: string | null };

export default function KeywordsPage() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "linkedin" | "both">("instagram");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<KeywordMetric[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [current, setCurrent] = useState<{ id: string; topic: string; created_at: string } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);

  const loadRuns = () => api<{ runs: Run[] }>("/api/keywords").then((r) => setRuns(r.runs)).catch(() => undefined);
  useEffect(() => {
    loadRuns();
    const t = new URLSearchParams(window.location.search).get("topic");
    if (t) setTopic(t);
  }, []);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ research: { id: string; topic: string; created_at: string; sources: SourceStatus[] }; rows: KeywordMetric[] }>("/api/keywords", {
        method: "POST",
        json: { topic, niche, audience, platform },
      });
      setRows(r.rows);
      setSources(r.research.sources);
      setCurrent(r.research);
      setFocus(r.rows[0]?.keyword ?? null);
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
      const r = await api<{ research: { id: string; topic: string; created_at: string; sources: SourceStatus[] }; rows: KeywordMetric[] }>(`/api/keywords?id=${id}`);
      setRows(r.rows);
      setSources(r.research.sources);
      setCurrent(r.research);
      setFocus(r.rows.find((x) => x.kind === "seed")?.keyword ?? r.rows[0]?.keyword ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Keyword research" subtitle="Measured data where it exists, clearly-labelled AI estimates where it doesn't." />
      <Card className="p-5">
        <form onSubmit={run} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_160px_auto] md:items-end">
          <Field label="Topic"><Input required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. personal branding for designers" /></Field>
          <Field label="Niche"><Input value={niche} onChange={(e) => setNiche(e.target.value)} /></Field>
          <Field label="Audience"><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></Field>
          <Field label="Platform">
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="both">Both</option>
            </Select>
          </Field>
          <Button type="submit" variant="accent" loading={busy}><Search className="h-4 w-4" />Research</Button>
        </form>
      </Card>
      <ErrorBanner error={error} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {current ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <b className="text-foreground">{current.topic}</b> · updated {new Date(current.created_at).toLocaleString()}
                </p>
                <Link href={`/create?topic=${encodeURIComponent(current.topic)}`}>
                  <Button size="sm"><Sparkles className="h-4 w-4" />Create carousel on this</Button>
                </Link>
              </div>
              <Sources sources={sources} />
              <DataNotice />
              <KeywordTable rows={rows} focusedKeyword={focus} onFocus={setFocus} />
            </>
          ) : (
            <Empty title="No research open">Run a search above, or reopen a previous run.</Empty>
          )}
        </div>
        <div className="space-y-4">
          <KeywordDetail row={rows.find((r) => r.keyword === focus) ?? null} />
          <HashtagPicker rows={rows} />
          <Card className="p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" />Recent research</p>
            {runs.length ? (
              <ul className="space-y-1">
                {runs.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => open(r.id)} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary">
                      <span className="line-clamp-1">{r.topic}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}{r.project_id ? " · in a project" : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
