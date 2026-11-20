// Supabase Edge Function (EditSimple website module, name: eds-post-action): publish / unpublish / delete blog posts, and test the GitHub connection.
// Publishing writes blog/posts/<slug>.json into the website's GitHub repo; the repo's build-site workflow
// then turns it into a real HTML page (good for SEO). Unpublish/delete removes that file.
// Called by the dashboard (logged-in admin) or by generate-post (x-cron-secret) for auto-publish.
// GitHub token / repo / branch are read from the "eds_settings" table. Deploy with "Verify JWT" OFF.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function settings(): Promise<Record<string, string>> {
  const { data, error } = await db.from("eds_settings").select("key,value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

async function adminEmail(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (!email) return null;
  const { data: row } = await db.from("eds_admins").select("email").ilike("email", email).maybeSingle();
  return row ? email : null;
}

// ---------- GitHub ----------
function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function github(s: Record<string, string>) {
  if (!s.github_token || !s.github_repo) throw new Error("GitHub token and repository are not set. Add them in Settings.");
  const repo = s.github_repo.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  const branch = s.github_branch || "main";
  const headers = {
    Authorization: `Bearer ${s.github_token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "editsimple-dashboard",
    "Content-Type": "application/json",
  };
  const url = (path: string) => `https://api.github.com/repos/${repo}/contents/${path}`;
  async function sha(path: string): Promise<string | null> {
    const r = await fetch(`${url(path)}?ref=${encodeURIComponent(branch)}`, { headers });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return (await r.json()).sha;
  }
  return {
    repo, branch,
    async check() {
      const r = await fetch(`https://api.github.com/repos/${repo}/branches/${encodeURIComponent(branch)}`, { headers });
      if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const p = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      const perms = (await p.json()).permissions ?? {};
      if (perms.push === false) throw new Error("Token can read the repo but cannot write to it. Give it Contents: Read and write.");
      return true;
    },
    async put(path: string, text: string, message: string) {
      const body: Record<string, unknown> = { message, content: toBase64(text), branch };
      const old = await sha(path);
      if (old) body.sha = old;
      const r = await fetch(url(path), { method: "PUT", headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
    },
    async remove(path: string, message: string) {
      const old = await sha(path);
      if (!old) return;
      const r = await fetch(url(path), { method: "DELETE", headers, body: JSON.stringify({ message, sha: old, branch }) });
      if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const s = await settings();
    const internal = !!req.headers.get("x-cron-secret") && req.headers.get("x-cron-secret") === s.cron_secret;
    const email = internal ? "auto-publish" : await adminEmail(req);
    if (!email) return json({ error: "Unauthorized" }, 401);

    const { action, id } = await req.json().catch(() => ({}));
    const gh = () => github(s);

    if (action === "check_github") {
      const g = gh();
      await g.check();
      return json({ ok: true, message: `Connected to ${g.repo} (${g.branch})` });
    }

    const { data: post, error } = await db.from("eds_posts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!post) return json({ error: "Post not found" }, 404);
    const path = `blog/posts/${post.slug}.json`;

    if (action === "publish") {
      if (!["draft", "published"].includes(post.status)) return json({ error: `Can't publish a ${post.status} post` }, 400);
      if (!post.title || !post.body_html) return json({ error: "Post needs a title and content" }, 400);
      const publishedAt = post.published_at ?? new Date().toISOString();
      const date = new Date(new Date(publishedAt).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // India date
      const file = {
        title: post.title, slug: post.slug, date, description: post.description, keywords: post.keywords,
        target_query: post.target_query, keyword_source: post.keyword_source, sources: post.sources,
        body_html: post.body_html, model: post.model,
      };
      await gh().put(path, JSON.stringify(file, null, 2) + "\n", `Blog: ${post.status === "published" ? "update" : "publish"} "${post.title}"`);
      await db.from("eds_posts").update({ status: "published", published_at: publishedAt, updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true, message: "Published. The website updates in about 1-2 minutes." });
    }

    if (action === "unpublish") {
      if (post.status === "published") await gh().remove(path, `Blog: unpublish "${post.title}"`);
      await db.from("eds_posts").update({ status: "draft", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ ok: true, message: "Unpublished. It is a draft again." });
    }

    if (action === "delete") {
      if (post.status === "published") await gh().remove(path, `Blog: delete "${post.title}"`);
      await db.from("eds_posts").delete().eq("id", id);
      return json({ ok: true, message: "Deleted." });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
