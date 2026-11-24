/** EditSimple Website module: shared types, labels and pure helpers (ported from the old CAS dashboard). */
import type { BadgeTone } from '@/components/ui';

export type EdsLeadStatus = 'new' | 'contacted' | 'won' | 'lost';
export type EdsLead = {
  id: number; created_at: string; form: 'popup' | 'contact' | string; name: string | null; email: string | null; phone: string | null;
  specialty: string | null; interested_in: string | null; message: string | null; page: string | null; page_url: string | null;
  button: string | null; button_location: string | null; referrer: string | null; fields: Record<string, unknown> | null;
  email_sent: boolean | null; status: EdsLeadStatus | null;
};
export type EdsPostStatus = 'generating' | 'draft' | 'published' | 'failed';
export type EdsPost = {
  id: string; slug: string; title: string; description: string; keywords: string[] | null; target_query: string | null;
  keyword_source: 'search-console' | 'ai' | 'topic' | string | null; sources: Array<{ title: string; url: string }> | null;
  body_html: string; model: string | null; status: EdsPostStatus; error: string | null; created_by: string | null;
  created_at: string; updated_at: string; published_at: string | null;
};
export type EdsMember = { email: string; role: 'owner' | 'admin'; added_at: string; added_by: string | null; has_account: boolean; confirmed: boolean; last_sign_in: string | null };
export type EdsSettingRow = { key: string; value: string | null; is_secret: boolean; is_set: boolean };
export type EdsSettings = Record<string, string> & { _set?: Record<string, boolean> };

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const LEAD_STATUS: Record<EdsLeadStatus, { label: string; tone: BadgeTone; color: string }> = {
  new: { label: 'New', tone: 'warn', color: '#f2551a' },
  contacted: { label: 'Contacted', tone: 'info', color: '#3a63c9' },
  won: { label: 'Won', tone: 'good', color: '#1f9e8a' },
  lost: { label: 'Lost', tone: 'muted', color: '#b8b0aa' },
};
export const leadStatus = (l: Pick<EdsLead, 'status'>): EdsLeadStatus => (l.status && l.status in LEAD_STATUS ? l.status : 'new');

export const SERIES = [
  { key: 'free', label: 'Free video', color: '#f2551a' },
  { key: 'call', label: 'Call booking', color: '#3a63c9' },
  { key: 'contact', label: 'Contact form', color: '#1f9e8a' },
] as const;
export type SeriesKey = (typeof SERIES)[number]['key'];
export const leadKind = (l: Pick<EdsLead, 'form' | 'interested_in'>): SeriesKey =>
  l.form === 'contact' ? 'contact' : l.interested_in === 'Free video' ? 'free' : 'call';

export const POST_STATUS: Record<EdsPostStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'To review', tone: 'info' },
  published: { label: 'Published', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  generating: { label: 'Writing…', tone: 'accent' },
};
export const KEYWORD_SOURCE: Record<string, string> = { 'search-console': 'Search Console keyword', ai: 'AI-picked keyword', topic: 'Your topic' };

/** Lead detail groups, in this exact order (the jsonb `fields` come back unordered). */
export const LEAD_GROUPS: Array<[string, string[]]> = [
  ['Contact', ['First Name', 'Last Name', 'Name', 'Email', 'Phone']],
  ['Request', ['Specialty', 'Interested in', 'Message']],
  ['Where it came from', ['Form Page', 'Button', 'Button Location', 'Page URL', 'Referrer']],
  ['Traffic source', ['UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Term', 'UTM Content', 'Ad Click ID', 'Landing Page', 'First Referrer']],
];
export const FIELD_LABELS: Record<string, string> = {
  'Form Page': 'Page', Button: 'Button clicked', 'Button Location': 'Button position', 'Page URL': 'Page link',
  'UTM Source': 'Source', 'UTM Medium': 'Medium', 'UTM Campaign': 'Campaign', 'UTM Term': 'Keyword', 'UTM Content': 'Ad content',
  'Ad Click ID': 'Ad click ID', 'Landing Page': 'Landing page', 'First Referrer': 'First referrer',
};

/* ---------- traffic source (the website saves utm_* tags, ad click IDs or the referring site with every form) ---------- */
export type LeadChannel = 'paid' | 'organic' | 'social' | 'email' | 'referral' | 'direct' | 'unknown';
export const CHANNELS: Record<LeadChannel, { label: string; color: string }> = {
  paid: { label: 'Paid ads', color: '#f2551a' },
  organic: { label: 'Search', color: '#1f9e8a' },
  social: { label: 'Social', color: '#8a5cf6' },
  email: { label: 'Email', color: '#d4a017' },
  referral: { label: 'Other sites', color: '#3a63c9' },
  direct: { label: 'Direct', color: '#6b5d54' },
  unknown: { label: 'Not tracked', color: '#b8b0aa' },
};
const SOCIAL = /(^|\.)(facebook|fb|instagram|linkedin|lnkd|twitter|x|t|youtube|youtu|whatsapp|wa|pinterest|reddit|tiktok|quora|threads)\.(com|me|co|in|net)$|^(facebook|instagram|linkedin|twitter|x|youtube|whatsapp|pinterest|reddit|tiktok|quora|threads|ig|fb|li|yt)$/i;
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|baidu)\.|^(google|bing|yahoo|duckduckgo)$/i;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const nice = (s: string) => {
  const h = s.replace(/^www\./, '').replace(/\.(com|in|co\.in|net|org|co)$/i, '');
  return ({ fb: 'Facebook', 'm.facebook': 'Facebook', 'l.facebook': 'Facebook', 'lm.facebook': 'Facebook', ig: 'Instagram', 'l.instagram': 'Instagram',
    li: 'LinkedIn', linkedin: 'LinkedIn', lnkd: 'LinkedIn', yt: 'YouTube', youtube: 'YouTube', 'm.youtube': 'YouTube', youtu: 'YouTube',
    whatsapp: 'WhatsApp', wa: 'WhatsApp', 'web.whatsapp': 'WhatsApp', 't.co': 'X', t: 'X', x: 'X', twitter: 'X', 'mobile.twitter': 'X', email: 'Email',
    tiktok: 'TikTok', duckduckgo: 'DuckDuckGo', chatgpt: 'ChatGPT', '(direct)': 'Direct' } as Record<string, string>)[h.toLowerCase()]
    ?? h.charAt(0).toUpperCase() + h.slice(1);
};

/** Where a lead came from: utm tags first, then the referrer (older leads), else unknown. */
export type LeadSource = { channel: LeadChannel; key: string; source: string; medium: string; campaign: string; content: string; term: string; label: string };
export function leadSource(l: EdsLead): LeadSource {
  const f = (l.fields ?? {}) as Record<string, unknown>;
  const g = (k: string) => (typeof f[k] === 'string' ? (f[k] as string).trim() : '');
  let src = g('UTM Source'), med = g('UTM Medium').toLowerCase();
  const campaign = g('UTM Campaign'), clickIds = g('Ad Click ID');
  if (!src) {
    const ref = g('First Referrer') || l.referrer || '';
    const h = ref ? host(ref) : '';
    if (h && h !== host(l.page_url || '')) { src = h; med = med || (SEARCH.test(h) ? 'organic' : 'referral'); }
  }
  let channel: LeadChannel;
  if (!src) channel = 'unknown';
  else if (src === '(direct)') channel = 'direct';
  else if (/cpc|ppc|paid|ads?$|display|banner|cpm/.test(med) || clickIds) channel = 'paid';
  else if (/email|newsletter|mail/.test(med)) channel = 'email';
  else if (/social|story|reel|post|bio/.test(med) || SOCIAL.test(src)) channel = 'social';
  else if (med === 'organic' || SEARCH.test(src)) channel = 'organic';
  else channel = 'referral';
  const source = !src ? 'Not tracked' : channel === 'direct' ? 'Direct' : nice(src);
  // one key per specific source (Instagram, LinkedIn, Google...), so google.com and "google" group together
  const key = !src ? 'not-tracked' : source.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const label = !src || channel === 'direct' ? source : `${source}${med ? ` / ${med}` : ''}`;
  return { channel, key, source, medium: med, campaign, content: g('UTM Content'), term: g('UTM Term'), label };
}

/** All of a lead's details keyed like the website form, with the table columns filling any gaps. */
export function leadFields(l: EdsLead): Record<string, string> {
  const f: Record<string, string> = {};
  for (const [k, v] of Object.entries(l.fields ?? {})) if (v != null && typeof v !== 'object') f[k] = String(v);
  const fill = (k: string, v: string | null) => { if ((f[k] == null || f[k] === '') && v) f[k] = v; };
  fill('Email', l.email); fill('Phone', l.phone); fill('Form Page', l.page); fill('Page URL', l.page_url); fill('Button', l.button);
  fill('Button Location', l.button_location); fill('Message', l.message); fill('Specialty', l.specialty); fill('Interested in', l.interested_in);
  fill('Referrer', l.referrer);
  if (!f.Name && !f['First Name']) fill('Name', l.name);
  return f;
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const hourLabel = (h: number | string) => { const n = Number(h); return `${n % 12 || 12}:00 ${n < 12 ? 'AM' : 'PM'}`; };

/** When the weekly post runs next (schedule is in India time), or null if paused. */
export function nextRun(s: EdsSettings): Date | null {
  if (s.schedule_enabled === 'false') return null;
  const day = Number(s.schedule_day || 1), hour = Number(s.schedule_hour || 10);
  const ist = new Date(Date.now() + 5.5 * 3600e3);
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + i, hour, 5));
    if (d.getUTCDay() === day && d.getTime() > ist.getTime()) return new Date(d.getTime() - 5.5 * 3600e3);
  }
  return null;
}

export const fmtDay = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtWhen = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
export function ago(d: string | null | undefined) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return fmtDay(d);
}
export const initial = (s: string | null | undefined) => (String(s || '?').trim().charAt(0) || '?').toUpperCase();
const AV = ['bg-orange-50 text-orange-700', 'bg-blue-50 text-blue-700', 'bg-teal-50 text-teal-700', 'bg-violet-50 text-violet-700', 'bg-amber-50 text-amber-800', 'bg-pink-50 text-pink-700'];
export const avatarTone = (s: string | null | undefined) => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };

const fld = (k: string) => (l: EdsLead) => { const v = (l.fields ?? {})[k]; return v == null || typeof v === 'object' ? '' : String(v); };
export const CSV_COLS: Array<[string, (l: EdsLead) => unknown]> = [['Received', (l) => l.created_at], ['Name', (l) => l.name], ['Email', (l) => l.email],
  ['Phone', (l) => l.phone], ['Specialty', (l) => l.specialty], ['Interested in', (l) => l.interested_in], ['Message', (l) => l.message],
  ['Status', (l) => leadStatus(l)], ['Form', (l) => l.form], ['Page', (l) => l.page], ['Page link', (l) => l.page_url], ['Button', (l) => l.button],
  ['Button position', (l) => l.button_location], ['Referrer', (l) => l.referrer],
  ['Source', (l) => leadSource(l).source], ['Channel', (l) => CHANNELS[leadSource(l).channel].label], ['UTM source', fld('UTM Source')], ['UTM medium', fld('UTM Medium')],
  ['UTM campaign', fld('UTM Campaign')], ['UTM term', fld('UTM Term')], ['UTM content', fld('UTM Content')], ['Ad click ID', fld('Ad Click ID')],
  ['Landing page', fld('Landing Page')], ['First referrer', fld('First Referrer')]];
export function leadsCsv(list: EdsLead[]) {
  // quote fields and neutralise spreadsheet formulas (lead text comes from the public website)
  const q = (v: unknown) => { let s = String(v == null ? '' : v); if (/^[=@\t\r]|^[+-](?![\d\s()]+$)/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + CSV_COLS.map((c) => c[0]).join(',') + '\n' + list.map((l) => CSV_COLS.map(([, get]) => q(get(l))).join(',')).join('\n');
}

/** Escapes text for HTML (the post preview iframe; React escapes everything else). */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Only http(s) links are ever rendered as links (lead text comes from the public website). */
export const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);
