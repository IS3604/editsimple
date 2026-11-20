"use client";
import { cn as clsx } from '@/lib/utils';
import { CalendarClock, Clock, ExternalLink, FileText, Inbox, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, buttonClass, Card, Skeleton } from '@/components/ui';
import { PanelHead } from './panel';
import { ago, avatarTone, CHANNELS, leadSource, type LeadChannel, hourLabel, initial, LEAD_STATUS, leadKind, leadStatus, nextRun, SERIES, type EdsLead, type EdsLeadStatus } from '@/lib/eds';
import { useEds } from './provider';

const DAY = 864e5;
const dayKey = (d: Date | string) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };

export default function OverviewView() {
  const { me, leads, posts, settings, siteUrl } = useEds();
  const L = leads.data, P = posts.data, S = settings.data;
  const loading = !leads.loaded || !posts.loaded;

  // time-of-day and dates depend on the viewer's clock: render them after mount so server and browser HTML match
  const [hr, setHr] = useState<number | null>(null);
  useEffect(() => setHr(new Date().getHours()), []);
  const first = me.split('@')[0].split(/[._-]/)[0];
  const hello = `${hr == null ? 'Hello' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'}${first ? `, ${first[0].toUpperCase()}${first.slice(1)}` : ''}`;
  const wk = Date.now() - 7 * DAY;
  const week = L.filter((l) => new Date(l.created_at).getTime() > wk).length;
  const prevWeek = L.filter((l) => { const t = new Date(l.created_at).getTime(); return t <= wk && t > wk - 7 * DAY; }).length;
  const fresh = L.filter((l) => leadStatus(l) === 'new').length;
  const review = P.filter((p) => p.status === 'draft').length;
  const pub = P.filter((p) => p.status === 'published').length;
  const diff = week - prevWeek;
  const summary = fresh
    ? `${fresh} new lead${fresh > 1 ? 's' : ''} waiting for a reply${review ? ` and ${review} post${review > 1 ? 's' : ''} to review.` : '.'}`
    : review ? `${review} post${review > 1 ? 's' : ''} waiting for review.` : "You're all caught up.";
  const nr = settings.loaded ? nextRun(S) : null;
  const nextWhen = nr?.toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  const kpis = [
    { icon: TrendingUp, label: 'Leads this week', value: week, sub: diff === 0 ? 'Same as last week' : <><b className={diff > 0 ? 'text-emerald-600' : 'text-rose-600'}>{diff > 0 ? '+' : ''}{diff}</b> vs last week</>, href: '/website/leads' },
    { icon: Inbox, label: 'New leads', value: fresh, sub: 'Waiting for a reply', href: '/website/leads?status=new' },
    { icon: Clock, label: 'Posts to review', value: review, sub: review ? 'Ready for approval' : 'All caught up', href: '/website/posts?filter=draft' },
    { icon: FileText, label: 'Published posts', value: pub, sub: 'Live on the blog', href: '/website/posts?filter=published' },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">{hello}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{loading ? 'Loading the latest leads and posts…' : summary}</p>
        </div>
        <div className="flex gap-2">
          {siteUrl && <a className={buttonClass('outline')} href={siteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />View website</a>}
          <Link className={buttonClass('accent')} href="/website/posts?write=1"><Sparkles className="h-4 w-4" />Write a post</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="group rounded-2xl border border-border bg-card p-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_14px_30px_-18px_rgb(15_18_30/.35)]">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><k.icon className="h-3.5 w-3.5" />{k.label}</div>
            {loading ? <Skeleton className="mt-3 h-7 w-12" /> : <div className="num mt-2 text-[28px] font-semibold leading-none">{k.value}</div>}
            <div className="mt-2 text-xs text-muted-foreground">{k.sub}</div>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {hr == null ? <Skeleton className="h-[300px] rounded-2xl" /> : <LeadsChart leads={L} loading={!leads.loaded} />}
          <Card>
            <PanelHead title="Recent leads" sub="Newest form submissions" action={<Link href="/website/leads" className={buttonClass('outline', 'sm')}>View all leads</Link>} />
            {!leads.loaded ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
              : L.length ? (
                <ul className="divide-y divide-border">
                  {L.slice(0, 6).map((l) => (
                    <li key={l.id}>
                      <Link href={`/website/leads?lead=${l.id}`} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 sm:grid-cols-[36px_1.2fr_1fr_auto_70px]">
                        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold', avatarTone(l.email))}>{initial(l.name || l.email)}</span>
                        <span className="min-w-0"><b className="block truncate text-sm font-medium">{l.name || l.email}</b><span className="block truncate text-xs text-muted-foreground">{l.interested_in || 'Enquiry'}</span></span>
                        <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm">{l.page || '—'}</span><span className="block truncate text-xs text-muted-foreground">{l.button || ''}</span></span>
                        <Badge dot tone={LEAD_STATUS[leadStatus(l)].tone}>{LEAD_STATUS[leadStatus(l)].label}</Badge>
                        <time className="hidden text-right text-xs text-muted-foreground sm:block">{ago(l.created_at)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <div className="px-6 py-12 text-center text-sm text-muted-foreground"><Inbox className="mx-auto mb-2 h-6 w-6" /><b className="block text-foreground">No leads yet</b>Form submissions from the website will show up here.</div>}
          </Card>
        </div>

        <div className="space-y-5">
          <Pipeline leads={L} loading={!leads.loaded} />
          <TrafficSources leads={L} loading={!leads.loaded} />
          <TopSources leads={L} loading={!leads.loaded} />
          <Card className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent-soft))] text-accent"><CalendarClock className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <b className="block text-sm font-semibold">{!settings.loaded ? 'Next blog post' : nr ? 'Next blog post' : 'Weekly posts paused'}</b>
              <span className="block text-xs text-muted-foreground">{!settings.loaded ? '…' : nr ? `${nextWhen}, ${S.auto_publish === 'true' ? 'publishes automatically' : 'waits for review'}` : 'Turn them on in Settings.'}</span>
              {settings.loaded && nr && <span className="block font-mono text-[10.5px] text-muted-foreground/80">every {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(S.schedule_day || 1)]} · {hourLabel(S.schedule_hour || 10)} IST</span>}
            </div>
            <Link href={nr ? '/website/posts' : '/website/settings'} className={buttonClass('outline', 'sm')}>Open</Link>
          </Card>
        </div>
      </div>
    </>
  );
}

function LeadsChart({ leads, loading }: { leads: EdsLead[]; loading: boolean }) {
  const plot = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ i: number; x: number } | null>(null);
  const { days, total, prev, top } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 30 }, (_, k) => { const d = new Date(today); d.setDate(d.getDate() - (29 - k)); return { date: d, key: dayKey(d), free: 0, call: 0, contact: 0, total: 0 }; });
    const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
    const start = days[0].date.getTime();
    let prev = 0;
    for (const l of leads) {
      const k = idx[dayKey(l.created_at)];
      if (k != null) { days[k][leadKind(l)]++; days[k].total++; }
      else { const t = new Date(l.created_at).getTime(); if (t < start && t >= start - 30 * DAY) prev++; }
    }
    const total = days.reduce((a, d) => a + d.total, 0);
    const max = Math.max(...days.map((d) => d.total));
    return { days, total, prev, top: Math.max(4, Math.ceil(max / 4) * 4) };
  }, [leads]);
  const diff = total - prev;
  const f = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const t = tip ? days[tip.i] : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-[13.5px] font-semibold">Leads in the last 30 days</h2>
          <div className="mt-1 flex items-baseline gap-2">
            {loading ? <Skeleton className="h-8 w-14" /> : <b className="num text-[28px] font-semibold leading-none">{total}</b>}
            {!loading && (prev || total) ? <span className="text-xs text-muted-foreground">{diff === 0 ? 'same as the 30 days before' : <><b className={diff > 0 ? 'text-emerald-600' : 'text-rose-600'}>{diff > 0 ? '+' : ''}{diff}</b> vs the 30 days before</>}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {SERIES.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}
        </div>
      </div>
      <div className="flex gap-2 px-5 pb-2 pt-4">
        <div className="relative w-6 shrink-0 font-mono text-[10px] text-muted-foreground">
          {[0, 0.5, 1].map((p) => <span key={p} className="absolute right-0 translate-y-1/2" style={{ bottom: `${p * 100}%` }}>{Math.round(top * p)}</span>)}
        </div>
        <div ref={plot} className="relative h-48 flex-1" onMouseLeave={() => setTip(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((p) => <div key={p} className="absolute inset-x-0 border-t border-dashed border-border" style={{ bottom: `${p * 100}%` }} />)}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {days.map((d, i) => (
              <div key={d.key} className="group relative flex h-full flex-1 cursor-default flex-col-reverse"
                onMouseEnter={(e) => { const r = plot.current!.getBoundingClientRect(), c = e.currentTarget.getBoundingClientRect(); setTip({ i, x: c.left - r.left + c.width / 2 }); }}>
                <div className="absolute inset-0 rounded-sm group-hover:bg-muted/60" />
                {SERIES.map((s) => d[s.key] ? <i key={s.key} className="relative block w-full first:rounded-b-sm last:rounded-t-[3px]" style={{ height: `${(d[s.key] / top) * 100}%`, background: s.color }} /> : null)}
              </div>
            ))}
          </div>
          {!loading && !total && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No leads in the last 30 days yet</div>}
          {t && tip && (
            <div className="pointer-events-none absolute z-10 w-40 -translate-x-1/2 -translate-y-full rounded-lg bg-foreground px-3 py-2 text-[11.5px] text-background shadow-2xl"
                 style={{ left: Math.min(Math.max(tip.x, 80), (plot.current?.clientWidth ?? 0) - 80), top: Math.max(0, (1 - t.total / top) * 192) }}>
              <b className="mb-1 block">{t.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
              {SERIES.map((s) => <div key={s.key} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}<em className="ml-auto not-italic">{t[s.key]}</em></div>)}
              <div className="mt-1 flex border-t border-white/15 pt-1">Total<em className="ml-auto not-italic">{t.total}</em></div>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between pb-4 pl-[52px] pr-5 font-mono text-[10px] text-muted-foreground">
        {[0, 7, 14, 21, 29].map((i) => <span key={i}>{i === 29 ? 'Today' : f(days[i].date)}</span>)}
      </div>
    </Card>
  );
}

function Pipeline({ leads, loading }: { leads: EdsLead[]; loading: boolean }) {
  const counts = leads.reduce((a, l) => { const s = leadStatus(l); a[s] = (a[s] || 0) + 1; return a; }, {} as Record<string, number>);
  const tot = leads.length, R = 52, C = 2 * Math.PI * R, gap = tot > 1 ? 2 : 0;
  let off = 0;
  const keys = Object.keys(LEAD_STATUS) as EdsLeadStatus[];
  return (
    <Card>
      <PanelHead title="Lead pipeline" sub="Click a status to see those leads" />
      <div className="flex items-center gap-5 p-5">
        <div className="relative h-[124px] w-[124px] shrink-0">
          {loading ? <Skeleton className="h-full w-full rounded-full" /> : (
            <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="66" cy="66" r={R} fill="none" className="stroke-muted" strokeWidth="16" />
              {keys.filter((k) => counts[k]).map((k) => {
                const len = Math.max(0, (counts[k] / tot) * C - gap);
                const el = <circle key={k} cx="66" cy="66" r={R} fill="none" stroke={LEAD_STATUS[k].color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />;
                off += (counts[k] / tot) * C;
                return el;
              })}
            </svg>
          )}
          {!loading && <div className="absolute inset-0 flex flex-col items-center justify-center"><b className="num text-2xl font-semibold leading-none">{tot}</b><span className="text-[10.5px] text-muted-foreground">total leads</span></div>}
        </div>
        <div className="flex-1 space-y-0.5">
          {keys.map((k) => {
            const n = counts[k] || 0;
            return (
              <Link key={k} href={`/website/leads?status=${k}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                <i className="h-2.5 w-2.5 rounded-sm" style={{ background: LEAD_STATUS[k].color }} />{LEAD_STATUS[k].label}
                <b className="num ml-auto font-semibold">{n}</b><em className="w-9 text-right font-mono text-[11px] not-italic text-muted-foreground">{tot ? Math.round((n / tot) * 100) : 0}%</em>
              </Link>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function TopSources({ leads, loading }: { leads: EdsLead[]; loading: boolean }) {
  const top = useMemo(() => {
    const mo = Date.now() - 30 * DAY, map = new Map<string, { page: string; button: string; n: number }>();
    for (const l of leads) {
      if (new Date(l.created_at).getTime() <= mo) continue;
      const page = l.page || 'Unknown page', button = l.button || 'Form', k = `${page}||${button}`;
      const cur = map.get(k) ?? { page, button, n: 0 }; cur.n++; map.set(k, cur);
    }
    return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 5);
  }, [leads]);
  const mx = top[0]?.n ?? 1;
  return (
    <Card>
      <PanelHead title="Top pages & buttons" sub="Last 30 days, where the form was opened" />
      <div className="space-y-3 p-5">
        {loading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />) : top.length ? top.map((t) => (
          <div key={t.page + t.button}>
            <div className="flex items-baseline justify-between gap-2 text-sm"><b className="truncate font-medium">{t.page}</b><span className="shrink-0 text-xs text-muted-foreground">{t.n} lead{t.n > 1 ? 's' : ''}</span></div>
            <div className="truncate text-xs text-muted-foreground">{t.button}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(6, Math.round((t.n / mx) * 100))}%` }} /></div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No leads in the last 30 days.</p>}
      </div>
    </Card>
  );
}

/** Leads by specific source (Instagram, LinkedIn, Google...) for the last 30 days; hover shows medium and campaign. */
function TrafficSources({ leads, loading }: { leads: EdsLead[]; loading: boolean }) {
  type Row = { key: string; name: string; channel: LeadChannel; n: number; mediums: Map<string, number>; campaigns: Map<string, number> };
  const { rows, total, untracked } = useMemo(() => {
    const mo = Date.now() - 30 * DAY, map = new Map<string, Row>();
    let total = 0, untracked = 0;
    for (const l of leads) {
      if (new Date(l.created_at).getTime() <= mo) continue;
      total++;
      const s = leadSource(l);
      if (s.channel === 'unknown') { untracked++; continue; }
      const r = map.get(s.key) ?? { key: s.key, name: s.source, channel: s.channel, n: 0, mediums: new Map(), campaigns: new Map() };
      r.n++;
      if (s.medium) r.mediums.set(s.medium, (r.mediums.get(s.medium) ?? 0) + 1);
      if (s.campaign) r.campaigns.set(s.campaign, (r.campaigns.get(s.campaign) ?? 0) + 1);
      map.set(s.key, r);
    }
    return { rows: [...map.values()].sort((a, b) => b.n - a.n), total, untracked };
  }, [leads]);
  const [all, setAll] = useState(false);
  const mx = rows[0]?.n ?? 1;
  const list = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <PanelHead title="Leads by source (30 days)" sub="Hover for medium and campaign · click to see the leads" />
      <div className="p-3">
        {loading ? <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          : !total ? <p className="p-2 text-sm text-muted-foreground">No leads in the last 30 days.</p> : <>
          <ul>
            {(all ? rows : rows.slice(0, 6)).map((r) => {
              const tip = [`${r.name}: ${r.n} lead${r.n > 1 ? 's' : ''}`,
                ...list(r.mediums).map(([k, n]) => `Medium ${k}: ${n}`), ...list(r.campaigns).map(([k, n]) => `Campaign ${k}: ${n}`)].join('\n');
              const top = list(r.campaigns)[0];
              return (
                <li key={r.key}>
                  <Link href={`/website/leads?source=${encodeURIComponent(r.key)}`} title={tip} className="block rounded-lg px-2 py-2 hover:bg-muted/60">
                    <span className="flex items-baseline gap-2 text-sm">
                      <i className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: CHANNELS[r.channel].color }} />
                      <b className="truncate font-medium">{r.name}</b>
                      {r.mediums.size > 0 && <span className="truncate text-xs text-muted-foreground">{list(r.mediums).map(([k]) => k).slice(0, 2).join(', ')}</span>}
                      <span className="num ml-auto shrink-0 text-xs text-muted-foreground">{r.n}</span>
                    </span>
                    {top && <span className="block truncate pl-4 text-[11.5px] text-muted-foreground">Top campaign: {top[0]}</span>}
                    <span className="ml-4 mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${Math.max(6, (r.n / mx) * 100)}%`, background: CHANNELS[r.channel].color }} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {rows.length > 6 && <button className="mx-2 mt-1 text-xs font-medium text-accent hover:underline" onClick={() => setAll((v) => !v)}>{all ? 'Show less' : `Show all ${rows.length} sources`}</button>}
          {untracked > 0 && (
            <Link href="/website/leads?source=not-tracked" className="mx-2 mt-2 block text-[11.5px] text-muted-foreground hover:underline">
              {untracked} lead{untracked > 1 ? 's' : ''} without a source (sent before tracking was added)
            </Link>
          )}
        </>}
      </div>
    </Card>
  );
}
