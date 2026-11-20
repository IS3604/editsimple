"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/components/feedback';
import type { EdsLead, EdsMember, EdsPost, EdsSettingRow, EdsSettings } from '@/lib/eds';
import { supabaseBrowser } from '@/lib/supabase/client';

type Loaded<T> = { data: T; loading: boolean; loaded: boolean };
type Ctx = {
  me: string;
  settings: Loaded<EdsSettings>; leads: Loaded<EdsLead[]>; posts: Loaded<EdsPost[]>; team: Loaded<EdsMember[]>;
  loadSettings: () => Promise<void>; loadLeads: (silent?: boolean) => Promise<void>; loadPosts: (silent?: boolean) => Promise<void>; loadTeam: () => Promise<void>;
  setLeads: (fn: (l: EdsLead[]) => EdsLead[]) => void;
  setPosts: (fn: (p: EdsPost[]) => EdsPost[]) => void;
  callFn: <T = { ok?: boolean; message?: string }>(name: string, body: Record<string, unknown>) => Promise<T>;
  siteUrl: string;
};
const EdsCtx = createContext<Ctx | null>(null);
export const useEds = () => {
  const c = useContext(EdsCtx);
  if (!c) throw new Error('useEds outside EdsProvider');
  return c;
};

const POST_COLS = 'id,slug,title,description,keywords,target_query,keyword_source,sources,body_html,model,status,error,created_by,created_at,updated_at,published_at';
const init = <T,>(data: T): Loaded<T> => ({ data, loading: false, loaded: false });

/**
 * Loads the EditSimple Website data once for all its screens (so switching tabs is instant) and keeps it fresh:
 * posts are polled every 8s while one is being written.
 */
export function EdsProvider({ me, supabaseUrl, children }: { me: string; supabaseUrl: string; children: ReactNode }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const toast = useToast();
  const toastRef = useRef(toast); toastRef.current = toast;
  const [settings, setSettings] = useState(init<EdsSettings>({}));
  const [leads, setLeadsS] = useState(init<EdsLead[]>([]));
  const [posts, setPostsS] = useState(init<EdsPost[]>([]));
  const [team, setTeam] = useState(init<EdsMember[]>([]));
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const known = useRef<Set<number> | null>(null);

  const loadSettings = useCallback(async () => {
    setSettings((s) => ({ ...s, loading: true }));
    const r = await sb.rpc('eds_get_settings');
    if (r.error) { toastRef.current(false, r.error.message); setSettings((s) => ({ ...s, loading: false })); return; }
    const S: EdsSettings = { _set: {} } as EdsSettings;
    for (const row of (r.data ?? []) as EdsSettingRow[]) { S[row.key] = row.value ?? ''; S._set![row.key] = row.is_set; }
    setSettings({ data: S, loading: false, loaded: true });
  }, [sb]);

  /** silent = background refresh: no loading state, and a toast + sidebar badge update when new leads arrive. */
  const loadLeads = useCallback(async (silent = false) => {
    if (!silent) setLeadsS((s) => ({ ...s, loading: true }));
    const r = await sb.from('eds_leads').select('*').order('created_at', { ascending: false }).limit(2000);
    if (r.error) { if (!silent) { toastRef.current(false, r.error.message); setLeadsS((s) => ({ ...s, loading: false })); } return; }
    const list = (r.data ?? []) as EdsLead[];
    const fresh = known.current ? list.filter((l) => !known.current!.has(l.id)) : [];
    known.current = new Set(list.map((l) => l.id));
    setLeadsS({ data: list, loading: false, loaded: true });
    if (fresh.length) {
      const who = fresh[0].name || fresh[0].email || 'someone';
      toastRef.current(true, fresh.length === 1 ? `New website lead: ${who}` : `${fresh.length} new website leads`);
    }
  }, [sb]);

  const loadPosts = useCallback(async (silent = false) => {
    if (!silent) setPostsS((s) => ({ ...s, loading: true }));
    const r = await sb.from('eds_posts').select(POST_COLS).order('created_at', { ascending: false });
    if (r.error) { if (!silent) { toastRef.current(false, r.error.message); setPostsS((s) => ({ ...s, loading: false })); } return; }
    const list = (r.data ?? []) as EdsPost[];
    setPostsS({ data: list, loading: false, loaded: true });
  }, [sb]);

  const loadTeam = useCallback(async () => {
    setTeam((s) => ({ ...s, loading: true }));
    const r = await sb.rpc('eds_team_list');
    if (r.error) { toastRef.current(false, r.error.message); setTeam((s) => ({ ...s, loading: false })); return; }
    setTeam({ data: (r.data ?? []) as EdsMember[], loading: false, loaded: true });
  }, [sb]);

  // first load
  useEffect(() => { void Promise.all([loadSettings(), loadLeads(), loadPosts(), loadTeam()]); }, [loadSettings, loadLeads, loadPosts, loadTeam]);

  // Keep leads and posts fresh without a page reload:
  //  * instantly through Supabase Realtime when the eds_ tables are in the realtime publication,
  //  * otherwise every 20s while the tab is visible, and right away when you come back to the tab.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (t) clearTimeout(t); t = setTimeout(() => { void loadLeads(true); void loadPosts(true); }, 400); };
    const ch = sb.channel('eds-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eds_leads' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eds_posts' }, refresh)
      .subscribe();
    const iv = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 20000);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      if (t) clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
      void sb.removeChannel(ch);
    };
  }, [sb, loadLeads, loadPosts]);

  // lets the weekly schedule reach the edge functions (same as the old dashboard did on start)
  useEffect(() => {
    if (settings.loaded && supabaseUrl && settings.data.supabase_url !== supabaseUrl) {
      void sb.rpc('eds_set_settings', { data: { supabase_url: supabaseUrl } });
    }
  }, [settings.loaded, settings.data.supabase_url, supabaseUrl, sb]);

  // poll while a post is being written
  const generating = posts.data.some((p) => p.status === 'generating');
  useEffect(() => {
    if (!generating) return;
    poll.current = setTimeout(() => { void loadPosts(true); }, 8000);
    return () => { if (poll.current) clearTimeout(poll.current); };
  }, [generating, posts.data, loadPosts]);

  const callFn = useCallback(async <T,>(name: string, body: Record<string, unknown>): Promise<T> => {
    const r = await sb.functions.invoke(name, { body });
    if (r.error) {
      let msg = r.error.message as string;
      try { const j = await (r.error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* not JSON */ }
      throw new Error(msg || 'Request failed');
    }
    return r.data as T;
  }, [sb]);

  const value = useMemo<Ctx>(() => ({
    me, settings, leads, posts, team, loadSettings, loadLeads, loadPosts, loadTeam, callFn,
    setLeads: (fn) => setLeadsS((s) => ({ ...s, data: fn(s.data) })),
    setPosts: (fn) => setPostsS((s) => ({ ...s, data: fn(s.data) })),
    siteUrl: (settings.data.site_url || '').replace(/\/$/, ''),
  }), [me, settings, leads, posts, team, loadSettings, loadLeads, loadPosts, loadTeam, callFn]);

  return <EdsCtx.Provider value={value}>{children}</EdsCtx.Provider>;
}
