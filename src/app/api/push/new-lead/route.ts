import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { pushConfigured, sendPush } from '@/lib/push-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Called by the database (trigger on eds_leads, see supabase/migrations/0004_website_module.sql) with the shared secret. */
function authorized(req: NextRequest) {
  const want = process.env.PUSH_WEBHOOK_SECRET ?? '';
  const got = req.headers.get('x-push-secret') ?? '';
  if (want.length < 24 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const str = z.string().max(300).nullish();
const Body = z.object({
  lead: z.object({ id: z.union([z.number(), z.string()]), name: str, email: str, interested_in: str, form: str, page: str, source: str, medium: str }),
  subscriptions: z.array(z.object({ endpoint: z.string().url().max(1000), p256dh: z.string().max(200), auth: z.string().max(100) })).max(200),
});

const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'VAPID keys are not set' }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { lead, subscriptions } = parsed.data;

  const who = lead.name?.trim() || lead.email?.trim() || 'Someone';
  const what = lead.interested_in?.trim() || (lead.form === 'contact' ? 'Contact form' : 'Enquiry');
  const src = lead.source?.trim() ? (lead.source === '(direct)' ? 'Direct' : nice(lead.source.trim())) : '';
  const body = [what, lead.page?.trim() && `on ${lead.page.trim()}`, src && `via ${src}`].filter(Boolean).join(' · ');

  const { sent, gone } = await sendPush(subscriptions, {
    title: `New website lead: ${who}`.slice(0, 80),
    body: body.slice(0, 160),
    url: `/website/leads?lead=${encodeURIComponent(String(lead.id))}`,
    tag: `eds-lead-${lead.id}`,
  });

  if (gone.length && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await sb.rpc('push_prune', { p_secret: process.env.PUSH_WEBHOOK_SECRET, p_endpoints: gone });
  }
  return NextResponse.json({ ok: true, sent, removed: gone.length });
}
