"use client";
import { cn as clsx } from '@/lib/utils';
import { Eye, ExternalLink, FileText, Loader2, Pencil, Send, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer, useConfirm } from '@/components/feedback';
import { useToast } from '@/components/feedback';
import { Badge, buttonClass, Card, Skeleton } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ago, fmtDay, KEYWORD_SOURCE, POST_STATUS, type EdsPost } from '@/lib/eds';
import { useEds } from '../provider';

const FILTERS = [['all', 'All'], ['draft', 'To review'], ['published', 'Published'], ['failed', 'Failed']] as const;
type Filter = (typeof FILTERS)[number][0];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function PostsView() {
  const { posts, loadPosts, callFn, siteUrl } = useEds();
  const toast = useToast();
  const [ask, confirm] = useConfirm();
  const router = useRouter(), path = usePathname(), qs = useSearchParams();
  const filter = (qs.get('filter') as Filter | null) ?? 'all';
  const editId = qs.get('post');
  const [topic, setTopic] = useState('');
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const topicRef = useRef<HTMLInputElement>(null);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(qs.toString());
    if (v) p.set(k, v); else p.delete(k);
    p.delete('write');
    router.replace(`${path}${p.size ? `?${p}` : ''}`, { scroll: false });
  };
  useEffect(() => { if (qs.get('write')) topicRef.current?.focus(); }, [qs]);

  const P = posts.data;
  const counts = useMemo(() => P.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, { all: P.length } as Record<string, number>), [P]);
  const list = P.filter((p) => filter === 'all' || p.status === filter);
  const editing = editId ? P.find((p) => p.id === editId) ?? null : null;

  const generate = async () => {
    setStarting(true);
    try {
      await callFn('eds-generate-post', topic.trim() ? { topic: topic.trim() } : {});
      setTopic('');
      toast(true, 'Writing a new post. It appears below in 1–2 minutes.');
      setParam('filter', null);
      setTimeout(() => { void loadPosts(); }, 1500);
    } catch (e) { toast(false, (e as Error).message); }
    setStarting(false);
  };

  /** Runs publish / unpublish / delete through the edge function. Returns true when it worked. */
  const postAction = async (action: 'publish' | 'unpublish' | 'delete', p: EdsPost) => {
    if (action === 'delete' && !(await confirm({ title: 'Delete this post?', text: `“${p.title || 'This post'}”${p.status === 'published' ? ' will also be removed from the website.' : ' will be removed.'}`, label: 'Delete', danger: true }))) return false;
    if (action === 'unpublish' && !(await confirm({ title: 'Unpublish this post?', text: `“${p.title}” will be taken off the website and go back to “To review”.`, label: 'Unpublish', danger: true }))) return false;
    setBusy(`${action}:${p.id}`);
    try {
      const d = await callFn<{ ok?: boolean; message?: string; error?: string }>('eds-post-action', { action, id: p.id });
      if (d?.error) throw new Error(d.error);
      toast(true, d?.message || 'Done');
      await loadPosts();
      return true;
    } catch (e) { toast(false, (e as Error).message); return false; }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Blog posts</h1>
          <p className="text-sm text-muted-foreground">AI-written articles for the website. Review them, then publish.</p>
        </div>
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input ref={topicRef} className="input flex-1" placeholder="Topic (optional). Leave empty to pick a keyword automatically" value={topic}
            onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !starting) void generate(); }} maxLength={200} />
          <button className={buttonClass('accent')} onClick={generate} disabled={starting}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{starting ? 'Starting…' : 'Generate post'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Takes 1–2 minutes. The post is saved as a draft for you to review.</p>
      </Card>

      <Card>
        <div className="flex overflow-x-auto border-b border-border p-3">
          <div className="flex rounded-lg border border-border bg-muted/50 p-0.5 text-[12.5px]">
            {FILTERS.map(([k, label]) => (
              <button key={k} onClick={() => setParam('filter', k === 'all' ? null : k)}
                className={clsx('whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition-colors', filter === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {label} <span className="num ml-0.5 text-muted-foreground">{counts[k] || 0}</span>
              </button>
            ))}
          </div>
        </div>
        {!posts.loaded ? <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : !list.length ? (
            <div className="px-6 py-14 text-center text-sm text-muted-foreground">
              <FileText className="mx-auto mb-2 h-6 w-6" />
              <b className="block text-foreground">{P.length ? 'Nothing here' : 'No posts yet'}</b>
              {P.length ? 'No posts in this view.' : 'Click “Generate post” to write the first article.'}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((p) => {
                const st = POST_STATUS[p.status] ?? POST_STATUS.draft;
                const meta = [
                  p.status === 'published' ? `Published ${fmtDay(p.published_at)}` : `Created ${ago(p.created_at)}`,
                  p.target_query && `Keyword: “${p.target_query}”`,
                  p.keyword_source && (KEYWORD_SOURCE[p.keyword_source] ?? p.keyword_source),
                  p.created_by && (p.created_by === 'schedule' ? 'Weekly schedule' : `By ${p.created_by}`),
                ].filter(Boolean) as string[];
                return (
                  <li key={p.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge dot tone={st.tone}>{p.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin" />}{st.label}</Badge>
                        <h3 className="min-w-0 text-[14px] font-semibold">{p.title || '(untitled)'}</h3>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">{meta.map((m) => <span key={m}>{m}</span>)}</div>
                      {p.status === 'failed' && p.error && <div className="mt-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 font-mono text-[11.5px] text-rose-600">{p.error.trim().split('\n').pop()}</div>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {p.status === 'draft' && <>
                        <button className={buttonClass('outline', 'sm')} onClick={() => setParam('post', p.id)}><Eye className="h-3.5 w-3.5" />Review</button>
                        <button className={buttonClass('accent', 'sm')} disabled={!!busy} onClick={() => postAction('publish', p)}>
                          {busy === `publish:${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{busy === `publish:${p.id}` ? 'Publishing…' : 'Publish'}
                        </button>
                      </>}
                      {p.status === 'published' && <>
                        <button className={buttonClass('outline', 'sm')} onClick={() => setParam('post', p.id)}><Pencil className="h-3.5 w-3.5" />Edit</button>
                        {siteUrl && <a className={buttonClass('outline', 'sm')} href={`${siteUrl}/blog/${encodeURIComponent(p.slug)}.html`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />View</a>}
                      </>}
                      {(p.status === 'failed' || p.status === 'generating') &&
                        <button className={buttonClass('outline', 'sm', 'text-rose-600 hover:bg-rose-50')} disabled={!!busy} onClick={() => postAction('delete', p)}><Trash2 className="h-3.5 w-3.5" />Remove</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </Card>

      {editing && <PostEditor key={editing.id} post={editing} onClose={() => setParam('post', null)} postAction={postAction} busy={busy} />}
      {ask}
    </>
  );
}

function Counter({ n, lo, hi }: { n: number; lo: number; hi: number }) {
  return <span className={clsx('font-normal', n && (n < lo || n > hi) ? 'text-rose-600' : 'text-muted-foreground')}>· {n} characters (aim {lo}–{hi})</span>;
}

function PostEditor({ post, onClose, postAction, busy }: {
  post: EdsPost; onClose: () => void; busy: string | null;
  postAction: (a: 'publish' | 'unpublish' | 'delete', p: EdsPost) => Promise<boolean>;
}) {
  const { setPosts, loadPosts, siteUrl } = useEds();
  const sb = supabaseBrowser();
  const toast = useToast();
  const live = post.status === 'published';
  const [title, setTitle] = useState(post.title ?? '');
  const [slug, setSlug] = useState(post.slug ?? '');
  const [keywords, setKeywords] = useState((post.keywords ?? []).join(', '));
  const [desc, setDesc] = useState(post.description ?? '');
  const [body, setBody] = useState(post.body_html ?? '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState<'save' | 'publish' | null>(null);

  const save = async () => {
    const upd: Partial<EdsPost> = {
      title: title.trim(), description: desc.trim(), body_html: body.trim(), updated_at: new Date().toISOString(),
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 8),
    };
    if (!upd.title || !upd.body_html) { toast(false, "Title and article can't be empty."); return false; }
    const s = slugify(slug);
    if (!live && s && s !== post.slug) upd.slug = s;
    const r = await sb.from('eds_posts').update(upd).eq('id', post.id).select().single();
    if (r.error) { toast(false, /duplicate|unique/i.test(r.error.message) ? 'Another post already uses that page address.' : r.error.message); return false; }
    setPosts((all) => all.map((x) => (x.id === post.id ? { ...x, ...(r.data as EdsPost) } : x)));
    return true;
  };
  const onSave = async () => {
    setSaving('save');
    if (await save()) { toast(true, live ? 'Saved. Click “Update website” to make it live.' : 'Draft saved'); void loadPosts(); }
    setSaving(null);
  };
  const onPublish = async () => {
    setSaving('publish');
    const ok = (await save()) && (await postAction('publish', post));
    setSaving(null);
    if (ok) onClose();
  };

  const preview = `<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 20px;color:#211b17;line-height:1.75;font-size:17px}h1{font-size:34px;line-height:1.15;margin:0 0 12px}h2{font-size:26px;margin:36px 0 10px;line-height:1.2}h3{font-size:20px;margin:24px 0 8px}p.lead{color:#6b5d54;font-size:18px;border-bottom:1px solid #efe3da;padding-bottom:20px}blockquote{border-left:4px solid #ff571a;background:#fffaf6;margin:20px 0;padding:12px 18px}img{max-width:100%}a{color:#c2441e}</style><h1>${esc(title)}</h1><p class="lead">${esc(desc)}</p>${body}`;
  const anyBusy = !!saving || !!busy;

  return (
    <Drawer open wide onClose={onClose}
      icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent-soft))] text-accent"><FileText className="h-4 w-4" /></span>}
      title={live ? 'Edit published post' : 'Review post'}
      sub={live ? `Published ${fmtDay(post.published_at)}` : `Created ${ago(post.created_at)}${post.target_query ? ` · Keyword: ${post.target_query}` : ''}`}
      headerExtra={
        <div className="hidden rounded-lg border border-border bg-muted/50 p-0.5 text-[12.5px] sm:flex">
          {(['edit', 'preview'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={clsx('rounded-md px-2.5 py-1 font-medium capitalize', mode === m ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{m}</button>)}
        </div>
      }
      footer={<>
        <button className={clsx(buttonClass('ghost', 'sm'), 'text-rose-600')} disabled={anyBusy} onClick={async () => { if (await postAction('delete', post)) onClose(); }}><Trash2 className="h-3.5 w-3.5" />Delete</button>
        {live && <button className={buttonClass('outline', 'sm')} disabled={anyBusy} onClick={async () => { if (await postAction('unpublish', post)) onClose(); }}>
          {busy === `unpublish:${post.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}Unpublish</button>}
        {live && siteUrl && <a className={buttonClass('ghost', 'sm')} href={`${siteUrl}/blog/${encodeURIComponent(post.slug)}.html`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />View</a>}
        <span className="flex-1" />
        <button className={buttonClass('outline', 'sm')} disabled={anyBusy} onClick={onSave}>{saving === 'save' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{saving === 'save' ? 'Saving…' : live ? 'Save (not live)' : 'Save draft'}</button>
        <button className={buttonClass('accent', 'sm')} disabled={anyBusy} onClick={onPublish}>
          {saving === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{saving === 'publish' ? 'Publishing…' : live ? 'Update website' : 'Publish'}
        </button>
      </>}>
      <div className="flex border-b border-border p-2 sm:hidden">
        {(['edit', 'preview'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={clsx('flex-1 rounded-md py-1.5 text-sm font-medium capitalize', mode === m ? 'bg-muted' : 'text-muted-foreground')}>{m}</button>)}
      </div>
      {mode === 'preview' ? (
        <iframe title="Preview" sandbox="" srcDoc={preview} className="h-full min-h-[70vh] w-full bg-white" />
      ) : (
        <div className="space-y-4 p-5">
          <label className="block"><span className="label">Title <Counter n={title.length} lo={30} hi={65} /></span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Page address</span>
              <input className="input font-mono text-[13px] disabled:opacity-60" value={slug} disabled={live} onChange={(e) => setSlug(e.target.value)} />
              <span className="mt-1 block text-xs text-muted-foreground">{live ? "Can't be changed once published." : `blog/${slugify(slug) || post.slug}.html`}</span></label>
            <label className="block"><span className="label">Keywords</span>
              <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="comma, separated" />
              <span className="mt-1 block text-xs text-muted-foreground">Up to 8, separated by commas.</span></label>
          </div>
          <label className="block"><span className="label">Description <Counter n={desc.length} lo={140} hi={160} /></span>
            <textarea className="input min-h-[72px]" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
          <label className="block"><span className="label">Article (HTML)</span>
            <textarea className="input min-h-[320px] font-mono text-[12.5px] leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} /></label>
          {!!post.sources?.length && (
            <section><div className="eyebrow mb-2">Sources used</div>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {post.sources.map((s, i) => <li key={i}>{/^https?:\/\//i.test(s.url) ? <a className="text-accent hover:underline" href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title || s.url}</a> : (s.title || s.url)}</li>)}
              </ol></section>
          )}
          {post.error && <section><div className="eyebrow mb-2">How it was written</div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11.5px] text-muted-foreground">{post.error}</pre></section>}
          {post.model && <p className="text-xs text-muted-foreground">Written with {post.model}</p>}
        </div>
      )}
    </Drawer>
  );
}
