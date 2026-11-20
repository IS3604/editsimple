"use client";
import { cn as clsx } from '@/lib/utils';
import { Download, Inbox, Mail, Phone, Search, Trash2, User } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useConfirm, Drawer } from '@/components/feedback';
import { useToast } from '@/components/feedback';
import { Badge, buttonClass, Card, Skeleton } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ago, avatarTone, CHANNELS, FIELD_LABELS, fmtWhen, initial, LEAD_GROUPS, LEAD_STATUS, leadFields, leadsCsv, leadSource, leadStatus, isHttpUrl, type EdsLead, type LeadSource, type EdsLeadStatus } from '@/lib/eds';
import { useEds } from '../provider';

const KEYS = Object.keys(LEAD_STATUS) as EdsLeadStatus[];
const isUrl = isHttpUrl;

export default function LeadsView() {
  const { leads, setLeads } = useEds();
  const sb = supabaseBrowser();
  const toast = useToast();
  const [ask, confirm] = useConfirm();
  const router = useRouter(), path = usePathname(), qs = useSearchParams();
  const status = (qs.get('status') as EdsLeadStatus | null) ?? '';
  const openId = qs.get('lead');
  const [q, setQ] = useState('');
  const [page, setPage] = useState('');
  const [limit, setLimit] = useState(50);
  const source = qs.get('source') ?? '';
  const campaign = qs.get('campaign') ?? '';

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(qs.toString());
    if (v) p.set(k, v); else p.delete(k);
    router.replace(`${path}${p.size ? `?${p}` : ''}`, { scroll: false });
  };

  const L = leads.data;
  const pages = useMemo(() => [...new Set(L.map((l) => l.page).filter(Boolean) as string[])].sort(), [L]);
  const src = useMemo(() => new Map(L.map((l) => [l.id, leadSource(l)])), [L]);
  // every specific source (Instagram, LinkedIn, Google, Direct...) with its lead count, most leads first
  const sources = useMemo(() => {
    const c = new Map<string, { name: string; n: number }>();
    for (const v of src.values()) { const cur = c.get(v.key) ?? { name: v.source, n: 0 }; cur.n++; c.set(v.key, cur); }
    return [...c.entries()].sort((a, b) => (a[0] === 'not-tracked' ? 1 : b[0] === 'not-tracked' ? -1 : b[1].n - a[1].n));
  }, [src]);
  const campaigns = useMemo(() => [...new Set([...src.values()].map((v) => v.campaign).filter(Boolean))].sort(), [src]);
  const counts = useMemo(() => L.reduce((a, l) => { a[leadStatus(l)]++; return a; }, { new: 0, contacted: 0, won: 0, lost: 0 } as Record<EdsLeadStatus, number>), [L]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return L.filter((l) => {
      const so = src.get(l.id)!;
      return (!status || leadStatus(l) === status) && (!page || l.page === page) && (!source || so.key === source) && (!campaign || so.campaign === campaign) &&
        (!s || [l.name, l.email, l.phone, l.specialty, l.interested_in, l.page, l.button, l.button_location, l.message, so.label, so.campaign, so.content, so.term]
          .some((v) => (v || '').toLowerCase().includes(s)));
    });
  }, [L, q, status, page, source, campaign, src]);
  const shown = list.slice(0, limit);
  const open = openId ? L.find((l) => String(l.id) === openId) ?? null : null;

  const download = () => {
    const url = URL.createObjectURL(new Blob([leadsCsv(list)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `editsimple-leads-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const setStatus = async (l: EdsLead, s: EdsLeadStatus) => {
    const before = l.status;
    setLeads((all) => all.map((x) => (x.id === l.id ? { ...x, status: s } : x)));
    const r = await sb.from('eds_leads').update({ status: s }).eq('id', l.id).select('id');
    if (r.error || !r.data?.length) {
      setLeads((all) => all.map((x) => (x.id === l.id ? { ...x, status: before } : x)));
      toast(false, r.error?.message || "Couldn't update this lead.");
    } else toast(true, `Marked as ${LEAD_STATUS[s].label.toLowerCase()}`);
  };

  const remove = async (l: EdsLead) => {
    if (!(await confirm({ title: 'Delete this lead?', text: `${l.name || l.email || 'This lead'} will be removed for good. This can't be undone.`, label: 'Delete lead', danger: true }))) return;
    const r = await sb.from('eds_leads').delete().eq('id', l.id).select('id');
    if (r.error || !r.data?.length) { toast(false, r.error?.message || "Couldn't delete this lead."); return; }
    setLeads((all) => all.filter((x) => x.id !== l.id));
    setParam('lead', null);
    toast(true, 'Lead deleted');
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Leads</h1>
          <p className="text-sm text-muted-foreground">Everyone who filled in a form on the website.</p>
        </div>
        <button className={buttonClass('outline')} onClick={download} disabled={!list.length}><Download className="h-4 w-4" />Export CSV</button>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <label className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input className="input pl-9" placeholder="Search name, email, page, button or source" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="input w-auto max-w-[220px]" value={page} onChange={(e) => setPage(e.target.value)} aria-label="Page">
            <option value="">All pages</option>
            {pages.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input w-auto max-w-[200px]" value={source} onChange={(e) => setParam('source', e.target.value || null)} aria-label="Source">
            <option value="">All sources</option>
            {sources.map(([k, v]) => <option key={k} value={k}>{v.name} ({v.n})</option>)}
          </select>
          {campaigns.length > 0 && (
            <select className="input w-auto max-w-[200px]" value={campaign} onChange={(e) => setParam('campaign', e.target.value || null)} aria-label="Campaign">
              <option value="">All campaigns</option>
              {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <div className="flex overflow-x-auto rounded-lg border border-border bg-muted/50 p-0.5 text-[12.5px]">
            {(['', ...KEYS] as const).map((k) => (
              <button key={k || 'all'} onClick={() => setParam('status', k || null)}
                className={clsx('whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors', status === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {k ? LEAD_STATUS[k].label : 'All'} <span className="num ml-0.5 text-muted-foreground">{k ? counts[k] : L.length}</span>
              </button>
            ))}
          </div>
        </div>

        {!leads.loaded ? <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>
          : !list.length ? (
            <div className="px-6 py-14 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-6 w-6" />
              <b className="block text-foreground">{L.length ? 'No leads match' : 'No leads yet'}</b>
              {L.length ? 'Try a different search or filter.' : 'Form submissions from the website will show up here.'}
            </div>
          ) : (
            <>
              <table className="data-table hidden md:table">
                <thead><tr><th>Name</th><th>Interested in</th><th>Came from</th><th>Source</th><th>Status</th><th className="text-right">Received</th></tr></thead>
                <tbody>
                  {shown.map((l) => {
                    const st = LEAD_STATUS[leadStatus(l)];
                    return (
                      <tr key={l.id} className="cursor-pointer" onClick={() => setParam('lead', String(l.id))}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', avatarTone(l.email))}>{initial(l.name || l.email)}</span>
                            <span className="min-w-0"><b className="block truncate font-medium">{l.name || '—'}</b><span className="block truncate text-xs text-muted-foreground">{l.email || l.phone || ''}</span></span>
                          </div>
                        </td>
                        <td><span className="block max-w-[220px] truncate">{l.interested_in || (l.form === 'contact' ? 'Contact form' : '—')}</span><span className="block truncate text-xs text-muted-foreground">{l.specialty || ''}</span></td>
                        <td><span className="block max-w-[220px] truncate">{l.page || '—'}</span><span className="block max-w-[220px] truncate text-xs text-muted-foreground">{l.button || ''}</span></td>
                        <td><SourceCell s={src.get(l.id)!} /></td>
                        <td><Badge dot tone={st.tone}>{st.label}</Badge></td>
                        <td className="whitespace-nowrap text-right text-xs text-muted-foreground" title={fmtWhen(l.created_at)}>{ago(l.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="divide-y divide-border md:hidden">
                {shown.map((l) => {
                  const st = LEAD_STATUS[leadStatus(l)];
                  return (
                    <li key={l.id}>
                      <button className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-muted/60" onClick={() => setParam('lead', String(l.id))}>
                        <span className={clsx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold', avatarTone(l.email))}>{initial(l.name || l.email)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2"><b className="truncate text-sm font-medium">{l.name || l.email || '—'}</b><span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{ago(l.created_at)}</span></span>
                          <span className="block truncate text-xs text-muted-foreground">{l.interested_in || (l.form === 'contact' ? 'Contact form' : 'Enquiry')} · {l.page || 'Unknown page'}</span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2"><Badge dot tone={st.tone}>{st.label}</Badge><SourceCell s={src.get(l.id)!} compact /></span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                Showing {shown.length} of {list.length === L.length ? L.length : `${list.length} matching (${L.length} total)`} lead{L.length === 1 ? '' : 's'}
                {list.length > limit && <button className={clsx(buttonClass('outline', 'sm'), 'ml-auto')} onClick={() => setLimit((n) => n + 50)}>Show more</button>}
              </div>
            </>
          )}
      </Card>

      <LeadPanel lead={open} onClose={() => setParam('lead', null)} onStatus={setStatus} onDelete={remove} />
      {ask}
    </>
  );
}

/** Source chip: "Instagram / social", campaign underneath. */
function SourceCell({ s, compact }: { s: LeadSource; compact?: boolean }) {
  const c = CHANNELS[s.channel];
  if (s.channel === 'unknown') return <span className="text-sm text-muted-foreground">—</span>;
  const tip = [s.medium && `Medium: ${s.medium}`, s.campaign && `Campaign: ${s.campaign}`, s.content && `Ad content: ${s.content}`, s.term && `Keyword: ${s.term}`].filter(Boolean).join('\n');
  return (
    <span className={clsx('min-w-0', compact ? 'inline-flex' : 'block')} title={tip || undefined}>
      <span className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[12px] font-medium">
        <i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
        <span className="truncate">{s.source}{s.medium && s.channel !== 'direct' && <span className="font-normal text-muted-foreground"> / {s.medium}</span>}</span>
      </span>
      {!compact && s.campaign && <span className="mt-0.5 block max-w-[200px] truncate text-xs text-muted-foreground">Campaign: {s.campaign}</span>}
    </span>
  );
}

function LeadPanel({ lead, onClose, onStatus, onDelete }: { lead: EdsLead | null; onClose: () => void; onStatus: (l: EdsLead, s: EdsLeadStatus) => void; onDelete: (l: EdsLead) => void }) {
  if (!lead) return <Drawer open={false} onClose={onClose} title="">{null}</Drawer>;
  const f = leadFields(lead);
  const used = new Set<string>();
  const groups = LEAD_GROUPS.map(([title, keys]) => [title, keys.filter((k) => f[k]).map((k) => { used.add(k); return k; })] as const).filter(([, ks]) => ks.length);
  const other = Object.keys(f).filter((k) => !used.has(k) && f[k]);
  const cur = leadStatus(lead);
  const tel = lead.phone || f.Phone, mail = lead.email || f.Email;

  const value = (k: string, v: string) => {
    if (k === 'Email' || (EMAIL(v) && !isUrl(v))) return <a className="text-accent hover:underline" href={`mailto:${v}`}>{v}</a>;
    if (k === 'Phone') return <a className="text-accent hover:underline" href={`tel:${v.replace(/[^\d+]/g, '')}`}>{v}</a>;
    if (isUrl(v)) return <a className="break-all text-accent hover:underline" href={v} target="_blank" rel="noopener noreferrer nofollow">{v}</a>;
    return <span className="whitespace-pre-wrap break-words">{v}</span>;
  };
  const rows = (ks: readonly string[]) => (
    <dl className="divide-y divide-border rounded-xl border border-border">
      {ks.map((k) => (
        <div key={k} className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2.5 text-sm">
          <dt className="text-muted-foreground">{FIELD_LABELS[k] ?? k}</dt><dd className="min-w-0">{value(k, f[k])}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <Drawer open onClose={onClose}
      icon={<span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold', avatarTone(lead.email))}>{initial(lead.name || lead.email)}</span>}
      title={lead.name || lead.email || 'Lead'} sub={`${lead.interested_in || (lead.form === 'contact' ? 'Contact form' : 'Enquiry')} · ${ago(lead.created_at)} · ${leadSource(lead).channel === 'unknown' ? 'source not tracked' : `via ${leadSource(lead).source}`}`}
      footer={<>
        {tel && <a className={buttonClass('outline', 'sm')} href={`tel:${tel.replace(/[^\d+]/g, '')}`}><Phone className="h-3.5 w-3.5" />Call</a>}
        {mail && <a className={buttonClass('accent', 'sm')} href={`mailto:${mail}`}><Mail className="h-3.5 w-3.5" />Email</a>}
        <button className={clsx(buttonClass('ghost', 'sm'), 'ml-auto text-rose-600')} onClick={() => onDelete(lead)}><Trash2 className="h-3.5 w-3.5" />Delete</button>
      </>}>
      <div className="space-y-5 p-5">
        <div>
          <div className="eyebrow mb-2">Status</div>
          <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-muted/40 p-1">
            {KEYS.map((k) => (
              <button key={k} onClick={() => k !== cur && onStatus(lead, k)} aria-pressed={k === cur}
                className={clsx('flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition-colors', k === cur ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <i className="h-2 w-2 rounded-full" style={{ background: LEAD_STATUS[k].color }} />{LEAD_STATUS[k].label}
              </button>
            ))}
          </div>
        </div>
        {groups.map(([title, ks]) => <section key={title}><div className="eyebrow mb-2">{title}</div>{rows(ks)}</section>)}
        {other.length > 0 && <section><div className="eyebrow mb-2">Other details</div>{rows(other)}</section>}
        <section>
          <div className="eyebrow mb-2">Delivery</div>
          <dl className="divide-y divide-border rounded-xl border border-border text-sm">
            <div className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2.5"><dt className="text-muted-foreground">Received</dt><dd>{fmtWhen(lead.created_at)}</dd></div>
            <div className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2.5"><dt className="text-muted-foreground">Form</dt><dd>{lead.form === 'contact' ? 'Contact page form' : 'Pop-up form'}</dd></div>
            <div className="grid grid-cols-[120px_1fr] gap-3 px-3.5 py-2.5"><dt className="text-muted-foreground">Email alert</dt><dd>{lead.email_sent ? <Badge tone="good">Sent</Badge> : <Badge>Not sent</Badge>}</dd></div>
          </dl>
        </section>
        {!groups.length && !other.length && <p className="flex items-center gap-2 text-sm text-muted-foreground"><User className="h-4 w-4" />No details were sent with this lead.</p>}
      </div>
    </Drawer>
  );
}
const EMAIL = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
