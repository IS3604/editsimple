"use client";
import { cn as clsx } from '@/lib/utils';
import { Construction, Loader2, PlugZap } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useConfirm, useToast } from '@/components/feedback';
import { PushSettings } from '@/components/push';
import { buttonClass, Card, Skeleton } from '@/components/ui';
import { DAYS, EMAIL_RE, hourLabel, type EdsSettings } from '@/lib/eds';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useEds } from '../provider';

const TEXT = ['schedule_day', 'schedule_hour', 'openai_model', 'gsc_site', 'github_repo', 'github_branch', 'site_url', 'lead_to_email', 'lead_from_email'] as const;
const SECRET = ['openai_api_key', 'gsc_service_account', 'github_token', 'resend_api_key'] as const;
const BOOL = ['schedule_enabled', 'auto_publish'] as const;
type Form = Record<string, string>;

function fromSettings(S: EdsSettings): Form {
  const f: Form = {};
  for (const k of TEXT) f[k] = S[k] ?? '';
  for (const k of SECRET) f[k] = '';
  f.schedule_enabled = S.schedule_enabled === 'false' ? 'false' : 'true';
  f.auto_publish = S.auto_publish === 'true' ? 'true' : 'false';
  if (!f.schedule_day) f.schedule_day = '1';
  if (!f.schedule_hour) f.schedule_hour = '10';
  return f;
}

export default function SettingsView() {
  const { settings, loadSettings, callFn } = useEds();
  const sb = supabaseBrowser();
  const toast = useToast();
  const S = settings.data;
  const base = useMemo(() => fromSettings(S), [S]);
  const [f, setF] = useState<Form>(base);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ask, confirm] = useConfirm();
  const [switching, setSwitching] = useState(false);
  const maintenance = S.maintenance_mode === 'true';

  // Maintenance mode saves on its own (with a confirm), separate from the form below.
  const setMaintenance = async (on: boolean) => {
    const ok = await confirm(on
      ? { title: 'Put the website in maintenance mode?', text: 'Visitors to editsimple.in will see the maintenance page instead of the site until you turn this off.', label: 'Turn on maintenance', danger: true }
      : { title: 'Bring the website back online?', text: 'Visitors will see the normal site again within a minute.', label: 'Go live' });
    if (!ok) return;
    setSwitching(true);
    const r = await sb.rpc('eds_set_settings', { data: { maintenance_mode: on ? 'true' : 'false' } });
    setSwitching(false);
    if (r.error) { toast(false, r.error.message); return; }
    toast(true, on ? 'Maintenance mode is on. The website shows the maintenance page.' : 'The website is live again.');
    await loadSettings();
  };
  useEffect(() => setF(base), [base]);
  const dirty = useMemo(() => Object.keys(base).some((k) => (f[k] ?? '') !== base[k]), [f, base]);
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const save = async () => {
    const data: Record<string, string> = {};
    for (const k of TEXT) data[k] = (f[k] ?? '').trim();
    for (const k of BOOL) data[k] = f[k];
    for (const k of SECRET) if (f[k].trim()) data[k] = f[k].trim();
    if (data.gsc_service_account) {
      try { const sa = JSON.parse(data.gsc_service_account); if (!sa.client_email || !sa.private_key) throw 0; }
      catch { toast(false, 'The Search Console key must be the whole JSON file (with client_email and private_key).'); return; }
    }
    if (data.site_url && !/^https:\/\//.test(data.site_url)) { toast(false, 'Website address must start with https://'); return; }
    if (data.lead_to_email && data.lead_to_email.split(',').some((x) => !EMAIL_RE.test(x.trim()))) { toast(false, '“Send leads to” has an invalid email.'); return; }
    data.site_url = data.site_url.replace(/\/+$/, '');
    setSaving(true);
    const r = await sb.rpc('eds_set_settings', { data });
    setSaving(false);
    if (r.error) { toast(false, r.error.message); return; }
    toast(true, 'Settings saved');
    await loadSettings();
  };

  const test = async () => {
    if (dirty) { toast(false, 'Save your changes first, then test.'); return; }
    setTesting(true);
    try {
      const d = await callFn<{ ok?: boolean; message?: string; error?: string }>('eds-post-action', { action: 'check_github' });
      if (d?.error) throw new Error(d.error);
      toast(true, d?.message || 'Connected');
    } catch (e) { toast(false, (e as Error).message); }
    setTesting(false);
  };

  const secret = (k: (typeof SECRET)[number], label: string, help?: string, area?: boolean) => {
    const isSet = !!S._set?.[k];
    const props = { id: k, className: clsx('input', area && 'min-h-[96px] font-mono text-[12px]'), value: f[k] ?? '', autoComplete: 'off', spellCheck: false,
      placeholder: isSet ? 'Saved. Paste a new value to replace it' : 'Not set', onChange: (e: { target: { value: string } }) => set(k)(e.target.value) };
    return (
      <Field id={k} label={<>{label} <span className={clsx('font-normal', isSet ? 'text-emerald-600' : 'text-muted-foreground')}>· {isSet ? `Saved ${S[k] || ''}` : 'Not set'}</span></>} help={help}>
        {area ? <textarea {...props} rows={4} /> : <input {...props} type="password" />}
      </Field>
    );
  };
  const text = (k: (typeof TEXT)[number], label: string, placeholder?: string, help?: string) => (
    <Field id={k} label={label} help={help}><input id={k} className="input" value={f[k] ?? ''} placeholder={placeholder} onChange={(e) => set(k)(e.target.value)} /></Field>
  );

  if (!settings.loaded) return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Settings</h1>
        <p className="text-sm text-muted-foreground">Keys are stored securely in Supabase and only ever shown as the last 4 characters.</p>
      </div>

      <div className="space-y-5">
        <Section title="Website status" sub="Maintenance mode shows visitors a “back soon” page. Forms and the blog stay saved.">
          <div className="flex flex-wrap items-center gap-3">
            <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', maintenance ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>
              <Construction className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-sm font-semibold">{maintenance ? 'Maintenance mode is ON' : 'Website is live'}</b>
              <span className="text-xs text-muted-foreground">{maintenance ? 'Visitors see the maintenance page right now.' : 'Visitors see the normal site.'}</span>
            </div>
            <button className={buttonClass(maintenance ? 'accent' : 'outline', 'sm')} disabled={switching} onClick={() => setMaintenance(!maintenance)}>
              {switching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{maintenance ? 'Go live' : 'Turn on maintenance'}
            </button>
          </div>
        </Section>

        <Section title="Notifications" sub="Get a browser notification the moment a website lead comes in.">
          <PushSettings />
        </Section>

        <Section title="Blog schedule" sub="When the weekly article is written (India time).">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="schedule_day" label="Day">
              <select id="schedule_day" className="input" value={f.schedule_day} onChange={(e) => set('schedule_day')(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={String(d)}>{DAYS[d]}</option>)}
              </select>
            </Field>
            <Field id="schedule_hour" label="Time">
              <select id="schedule_hour" className="input" value={f.schedule_hour} onChange={(e) => set('schedule_hour')(e.target.value)}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={String(h)}>{hourLabel(h)} IST</option>)}
              </select>
            </Field>
          </div>
          <Switch on={f.schedule_enabled === 'true'} onChange={(v) => set('schedule_enabled')(String(v))} title="Write a new post every week" help="Turn off to pause automatic posts." />
          <Switch on={f.auto_publish === 'true'} onChange={(v) => set('auto_publish')(String(v))} title="Publish automatically" help="Off: new posts wait under “To review” until someone publishes them." />
        </Section>

        <Section title="OpenAI" sub="Researches and writes the articles. Create a key at platform.openai.com → API keys.">
          {secret('openai_api_key', 'API key')}
          {text('openai_model', 'Model', 'gpt-4.1-mini', 'Must support web search, e.g. gpt-4.1-mini, gpt-4.1 or gpt-5.5.')}
        </Section>

        <Section title="Google Search Console" sub="Optional. Lets articles target real searches your site already shows up for.">
          {text('gsc_site', 'Property', 'sc-domain:editsimple.in')}
          {secret('gsc_service_account', 'Service account key', 'Paste the whole JSON file.', true)}
        </Section>

        <Section title="Website publishing" sub="Published posts are saved to the website's GitHub repo, which rebuilds the blog pages.">
          <div className="grid gap-4 sm:grid-cols-2">
            {text('github_repo', 'Repository', 'IS3604/EDS-Web')}
            {text('github_branch', 'Branch', 'main')}
          </div>
          {secret('github_token', 'Access token', 'Fine-grained token for this repo only, with “Contents: Read and write”.')}
          {text('site_url', 'Website address', 'https://is3604.github.io/EDS-Web')}
          <div>
            <button className={buttonClass('outline', 'sm')} onClick={test} disabled={testing}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}{testing ? 'Testing…' : 'Test connection'}
            </button>
          </div>
        </Section>

        <Section title="Lead emails" sub="Every lead is saved here and also emailed through Resend.">
          {secret('resend_api_key', 'Resend API key')}
          <div className="grid gap-4 sm:grid-cols-2">
            {text('lead_to_email', 'Send leads to', 'contact@editsimple.in', 'Several? Separate with commas.')}
            {text('lead_from_email', 'From', 'EditSimple Website <leads@editsimple.in>')}
          </div>
        </Section>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-background/90 backdrop-blur lg:-mx-10">
        <div className="flex items-center justify-end gap-2 px-4 py-3 lg:px-10">
          {dirty && <span className="mr-auto flex items-center gap-2 text-sm font-medium text-amber-600"><i className="h-2 w-2 rounded-full bg-amber-500" />Unsaved changes</span>}
          <button className={buttonClass('outline')} disabled={!dirty || saving} onClick={() => setF(base)}>Discard</button>
          <button className={buttonClass('accent')} disabled={!dirty || saving} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      {ask}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr] lg:gap-8">
      <div><h2 className="text-[14.5px] font-semibold">{title}</h2><p className="mt-1 text-[13px] text-muted-foreground">{sub}</p></div>
      <Card className="space-y-4 p-5">{children}</Card>
    </div>
  );
}
function Field({ id, label, help, children }: { id: string; label: ReactNode; help?: string; children: ReactNode }) {
  return <div><label htmlFor={id} className="label">{label}</label>{children}{help && <span className="mt-1 block text-xs text-muted-foreground">{help}</span>}</div>;
}
function Switch({ on, onChange, title, help }: { on: boolean; onChange: (v: boolean) => void; title: string; help: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left hover:bg-muted/40">
      <span className={clsx('mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-accent' : 'bg-border')}>
        <span className={clsx('h-4 w-4 rounded-full bg-white shadow transition-transform', on && 'translate-x-4')} />
      </span>
      <span><b className="block text-sm font-medium">{title}</b><span className="text-xs text-muted-foreground">{help}</span></span>
    </button>
  );
}
