// Supabase Edge Function (EditSimple website module, name: eds-generate-post): writes one SEO blog post.
//   1. Keyword  - Google Search Console (real searches where the site ranks low), if set up in the dashboard
//   2. Research - OpenAI web search
//   3. Writing  - OpenAI, saved to the "eds_posts" table as a draft (or published if auto-publish is on)
// Called by: the weekly schedule (header x-cron-secret) or the dashboard "Generate now" button (logged-in admin).
// All keys are read from the "eds_settings" table (set them in the dashboard). Deploy with "Verify JWT" OFF.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

const db: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
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

// ---------- India-time schedule check ----------
function indiaNow() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { day: d.getUTCDay(), hour: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
}

// ---------- Google Search Console ----------
function b64url(bytes: Uint8Array | string) {
  const s = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function googleToken(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Google auth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token as string;
}

type Opp = { q: string; imp: number; pos: number };

async function searchConsole(s: Record<string, string>, used: Set<string>, log: string[]): Promise<Opp[]> {
  if (!s.gsc_service_account || !s.gsc_site) { log.push("Search Console not set up: AI picks the keyword"); return []; }
  try {
    const token = await googleToken(JSON.parse(s.gsc_service_account));
    const end = new Date(Date.now() - 3 * 864e5);
    const start = new Date(end.getTime() - 90 * 864e5);
    const res = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(s.gsc_site)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), dimensions: ["query"], rowLimit: 500 }),
      },
    );
    if (!res.ok) throw new Error(`Search Console ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows: { keys: string[]; impressions: number; position: number }[] = (await res.json()).rows ?? [];
    const opps = rows
      .map((r) => ({ q: r.keys[0].trim(), imp: r.impressions, pos: Math.round(r.position * 10) / 10 }))
      .filter((o) => !used.has(o.q.toLowerCase()) && !o.q.toLowerCase().replace(/\s/g, "").includes("editsimple") && o.q.split(/\s+/).length >= 2 && o.pos >= 4)
      .sort((a, b) => b.imp - a.imp)
      .slice(0, 25);
    log.push(`Search Console: ${rows.length} queries, ${opps.length} opportunities`);
    return opps;
  } catch (e) {
    log.push(`Search Console skipped: ${(e as Error).message}`);
    return [];
  }
}

// ---------- OpenAI ----------
const SYSTEM = `You are the EditSimple content team writing an article for the EditSimple blog (editsimple.in).
EditSimple runs YouTube channels end to end (strategy, scripts, editing, Shorts, thumbnails, publishing) for US dermatology,
plastic surgery, med spa and aesthetic practices. The doctor records once a month; EditSimple does the rest.
HIPAA-conscious workflow, BAA available.

Audience: practice owners, doctors and practice managers in the US.

Process: FIRST use web search to research the target keyword: what ranks for it, what searchers want to know, and current facts
(YouTube features, platform rules, healthcare advertising/HIPAA guidance, recent trends). Then write an article that answers the
search intent better and more specifically than what ranks now.

Voice (EditSimple's own blog, so it promotes EditSimple):
- Write as the EditSimple team, in first person plural ("we", "our team", "in our experience running channels for practices").
- Promote EditSimple in three places, each short and woven into the flow (never a separate ad block):
  1. In the introduction (first 2-3 paragraphs): one sentence that says who we are and what we do for practices.
  2. Around the middle of the article: one or two sentences showing how EditSimple handles exactly the work being described.
  3. The closing section: a clear invitation to book a free strategy call with EditSimple.
  Confident and helpful, not salesy anywhere else.
- Sound like experienced humans: specific, practical, varied sentence length, concrete examples from running practice channels
  in general terms. Never mention AI, ChatGPT, language models or that the article was generated or researched automatically.
- Plain, friendly US English.

Shape (a real long-form blog article, NOT a list of Q&As):
- Length: 1600-2200 words.
- Open with an engaging introduction of 2-3 paragraphs (no heading before it) that hooks the reader and uses the target keyword.
- Then only 4-6 <h2> sections in total for the main article. Each section is substantial: 3-6 paragraphs of 3-5 sentences,
  around 250-400 words, flowing like an essay with examples and reasoning. Use <h3> only rarely (at most 2 in the whole article).
- H2 headings are short, descriptive statements, not questions (e.g. "Why patients research on YouTube first").
- Use at most one <ul> or <ol> in the main article, and only where a list truly helps. Prefer paragraphs.
- After the main article, in this order:
  a) <h2>Key takeaways</h2> with a <ul> of 3-5 one-line takeaways,
     followed by <p><strong>Quick answer:</strong> a direct 40-60 word answer to the target query.</p>
  b) <h2>FAQ</h2> with exactly 3 <h3> questions people also search, each answered in one <p> of 40-70 words.
  c) A final <h2> that wraps up and invites the reader to book a free call with EditSimple.

SEO + AEO (Google and answer engines like AI Overviews, ChatGPT, Perplexity):
- Use the target keyword naturally in the title, the first paragraph, one H2 and the quick answer. Use related phrases naturally.
- The first sentence of each H2 section states its main point directly, then expands on it.

Rules:
- Topic must help a practice grow with YouTube / video / content marketing.
- Do NOT give medical advice, treatment claims, dosages or outcome promises.
- Only use statistics, facts or quotes you actually found in your search results, and list those pages in "sources"
  (kept for our internal fact-check, not published). Never invent numbers, studies, client names, results or case studies.
- No "Sources" or "References" section in body_html, no citation markers, no links.
Return ONLY one JSON object (no markdown fences, no text before or after) with keys:
  "target_query" (the exact keyword targeted), "title" (max 65 chars), "slug" (lowercase-hyphenated, max 60 chars),
  "description" (meta description, 140-160 chars, includes the keyword), "keywords" (array of 4-6 phrases),
  "sources" (array of {"title","url"} for pages you used, max 8),
  "body_html" (HTML using only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>;
  no <h1>, no title repeat, no inline styles, no links, no citation markers).`;

// Structured output: OpenAI must return JSON matching this shape, so quotes inside the article can't break parsing.
const POST_SCHEMA = {
  type: "json_schema",
  name: "blog_post",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["target_query", "title", "slug", "description", "keywords", "sources", "body_html"],
    properties: {
      target_query: { type: "string" },
      title: { type: "string" },
      slug: { type: "string" },
      description: { type: "string" },
      keywords: { type: "array", items: { type: "string" } },
      sources: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["title", "url"], properties: { title: { type: "string" }, url: { type: "string" } } },
      },
      body_html: { type: "string" },
    },
  },
};

// Pulls the first complete {...} object out of text (ignores braces inside strings and anything after the object).
function firstObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function tryParse(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  for (const candidate of [t, firstObject(t)]) {
    if (!candidate) continue;
    try {
      const v = JSON.parse(candidate);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch { /* try next */ }
  }
  return null;
}

// ---------- Quality check: the article must be real long-form HTML in our shape ----------
const words = (html: string) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
function articleIssues(html: string): string[] {
  const issues: string[] = [];
  const w = words(html);
  const h2 = (html.match(/<h2>/gi) ?? []).length;
  const paras = (html.match(/<p>/gi) ?? []).length;
  if (/\*\*|^#{1,6}\s|^\s*[-*]\s/m.test(html) || paras < 8) issues.push("body_html must be real HTML (<h2>, <p>, <ul>), not markdown or one long block of text");
  if (w < 1400) issues.push(`the article is only about ${w} words; expand the main sections to reach 1600-2200 words`);
  if (h2 > 10) issues.push(`there are ${h2} <h2> headings; use only 4-6 for the main article plus Key takeaways, FAQ and the closing section`);
  if ((html.match(/EditSimple/g) ?? []).length < 3) issues.push("mention EditSimple in the introduction, once around the middle, and in the closing section");
  if (!/<h2>\s*Key takeaways/i.test(html) || !/Quick answer/i.test(html) || !/<h2>\s*FAQ/i.test(html)) issues.push("end with Key takeaways (+ Quick answer paragraph), then FAQ with 3 questions, then the closing section");
  return issues;
}
const EDITOR = `${SYSTEM}

You are now the EditSimple blog EDITOR. You receive a draft article as JSON and a list of problems.
Rewrite it into the final article that follows every rule above. Keep the facts and statistics from the draft (do not add new ones),
keep the same topic, target_query and sources. Return the same JSON shape.`;

async function openai(key: string, payload: Record<string, unknown>) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw Object.assign(new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`), { status: res.status });
  return await res.json();
}

// Keep only safe formatting tags, with no attributes.
function cleanHtml(html: string) {
  const ok = new Set(["h2", "h3", "p", "ul", "ol", "li", "strong", "em", "b", "i", "blockquote", "br"]);
  let s = html.replace(/<(script|style|iframe|object)[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<\/?([a-zA-Z0-9]+)\b[^>]*>/g, (m, tag) => {
    const t = tag.toLowerCase();
    if (!ok.has(t)) return "";
    return m.startsWith("</") ? (t === "br" ? "" : `</${t}>`) : `<${t}>`;
  });
  s = s.replace(/<(?![\/a-z])/gi, "&lt;");
  s = s.replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, "").replace(/\[([^\]]+)\]\(https?:\/\/[^)]*\)/g, "$1").replace(/【[^】]*】/g, "");
  return s.trim();
}

function cleanUrl(u: unknown) {
  try {
    const url = new URL(String(u ?? "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    [...url.searchParams.keys()].filter((k) => k.startsWith("utm_")).forEach((k) => url.searchParams.delete(k));
    url.hash = "";
    return url.toString();
  } catch { return ""; }
}

async function writePost(s: Record<string, string>, topic: string, by: string) {
  const log: string[] = [];
  const temp = `generating-${crypto.randomUUID()}`;
  const { data: row, error } = await db.from("eds_posts")
    .insert({ slug: temp, title: topic ? `Generating: ${topic}` : "Generating new post…", status: "generating", created_by: by })
    .select("id").single();
  if (error) throw error;
  const id = row.id as string;

  try {
    if (!s.openai_api_key) throw new Error("OpenAI API key missing. Add it in Settings.");
    const { data: prev } = await db.from("eds_posts").select("title,target_query").in("status", ["draft", "published"]).order("created_at", { ascending: false }).limit(60);
    const used = new Set((prev ?? []).map((p) => (p.target_query ?? "").toLowerCase()).filter(Boolean));
    const opps = topic ? [] : await searchConsole(s, used, log);

    let user = `Today is ${new Date().toDateString()}. Write this week's article.`;
    if (topic) user += `\nTopic: ${topic}`;
    else if (opps.length) {
      user += "\nThese are real Google searches where our site already appears but ranks low (impressions, average position, query). " +
        "Pick the ONE with the best mix of search volume and relevance to our audience and use it as target_query, exactly as written:\n" +
        opps.map((o) => `- ${o.imp} impressions, pos ${o.pos}: ${o.q}`).join("\n");
    }
    if (prev?.length) user += "\nAlready published (pick a clearly different topic and keyword):\n- " + prev.map((p) => p.title).join("\n- ");

    const model = s.openai_model || "gpt-4.1-mini";
    const payload: Record<string, unknown> = {
      model, instructions: SYSTEM, input: user, max_output_tokens: 8000,
      tools: [{ type: "web_search", search_context_size: "medium", user_location: { type: "approximate", country: "US" } }],
      text: { format: POST_SCHEMA },
    };
    let data;
    try {
      data = await openai(s.openai_api_key, payload);
    } catch (e) {
      if ((e as { status?: number }).status !== 400) throw e;
      // Some models don't allow web search together with structured output: keep web search, parse leniently.
      delete payload.text;
      try {
        data = await openai(s.openai_api_key, payload);
        log.push(`Structured output not available with web search for ${model}`);
      } catch (e2) {
        if ((e2 as { status?: number }).status !== 400) throw e2;
        log.push(`Web search not available for ${model}; wrote without it`);
        delete payload.tools;
        payload.text = { format: POST_SCHEMA };
        data = await openai(s.openai_api_key, payload);
      }
    }
    if (data.status === "incomplete") log.push(`OpenAI stopped early: ${data.incomplete_details?.reason ?? "unknown"}`);

    let text = "";
    const cited: { title: string; url: string }[] = [];
    for (const item of data.output ?? []) {
      if (item.type === "web_search_call" && item.action?.query) log.push(`searched: ${item.action.query}`);
      if (item.type === "message") {
        for (const c of item.content ?? []) {
          if (c.type !== "output_text") continue;
          text += c.text ?? "";
          for (const a of c.annotations ?? []) if (a.type === "url_citation") cited.push({ title: a.title ?? "", url: a.url ?? "" });
        }
      }
    }
    if (!text.includes("{")) throw new Error("AI did not return an article. Try again.");
    let post = tryParse(text);
    if (!post) {
      // Broken JSON (e.g. an unescaped quote in the article): ask OpenAI to return the same article as valid JSON.
      log.push("AI returned broken JSON; repairing it");
      const fixed = await openai(s.openai_api_key, {
        model, max_output_tokens: 8000, text: { format: POST_SCHEMA },
        instructions: "Return the article below as one valid JSON object with the same content. Do not rewrite or shorten anything.",
        input: text,
      });
      const fixedText = (fixed.output ?? []).flatMap((i: { type: string; content?: { type: string; text?: string }[] }) =>
        i.type === "message" ? (i.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "") : []).join("");
      post = tryParse(fixedText);
      if (!post) throw new Error("AI returned an article that couldn't be read. Try again.");
    }
    for (const k of ["title", "slug", "description", "body_html"]) if (!post[k]) throw new Error(`AI response missing ${k}`);

    // Editor pass(es): fix format, length, structure and EditSimple mentions when the draft misses them.
    for (let round = 0; round < 2; round++) {
      const issues = articleIssues(String(post.body_html));
      if (!issues.length) break;
      log.push(`editing: ${issues.join("; ")}`);
      try {
        const ed = await openai(s.openai_api_key, {
          model, instructions: EDITOR, max_output_tokens: 10000, text: { format: POST_SCHEMA },
          input: `Problems to fix:\n- ${issues.join("\n- ")}\n\nDraft:\n${JSON.stringify(post)}`,
        });
        const edText = (ed.output ?? []).flatMap((i: { type: string; content?: { type: string; text?: string }[] }) =>
          i.type === "message" ? (i.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "") : []).join("");
        const better = tryParse(edText);
        if (better?.body_html && words(String(better.body_html)) >= words(String(post.body_html)) * 0.8) post = { ...post, ...better };
      } catch (e) {
        log.push(`editor pass failed: ${(e as Error).message}`);
        break;
      }
    }
    // Last safety net: turn any leftover markdown bold into HTML.
    post.body_html = String(post.body_html).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    log.push(`final: ${words(String(post.body_html))} words`);

    const seen = new Set<string>();
    const sources = [...(Array.isArray(post.sources) ? post.sources : []), ...cited]
      .map((x) => ({ title: String(x?.title ?? "").trim().slice(0, 120), url: cleanUrl(x?.url) }))
      .filter((x) => x.url && !seen.has(x.url) && seen.add(x.url))
      .map((x) => ({ title: x.title || new URL(x.url).hostname, url: x.url }))
      .slice(0, 8);

    let base = String(post.slug).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "") || "post";
    let slug = base, n = 2;
    while ((await db.from("eds_posts").select("id").eq("slug", slug).neq("id", id).maybeSingle()).data) slug = `${base}-${n++}`;

    const { error: upErr } = await db.from("eds_posts").update({
      slug,
      title: String(post.title).trim(),
      description: String(post.description).trim(),
      keywords: (Array.isArray(post.keywords) ? post.keywords : []).filter((k: unknown) => typeof k === "string").map((k: string) => k.trim()).slice(0, 6),
      target_query: String(post.target_query ?? "").trim(),
      keyword_source: topic ? "topic" : opps.length ? "search-console" : "ai",
      sources, body_html: cleanHtml(String(post.body_html)), model,
      status: "draft", error: log.join("\n"), updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (upErr) throw upErr;

    if (s.auto_publish === "true") {
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/eds-post-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": s.cron_secret },
        body: JSON.stringify({ action: "publish", id }),
      });
      if (!r.ok) await db.from("eds_posts").update({ error: log.concat(`Auto-publish failed: ${await r.text()}`).join("\n") }).eq("id", id);
    }
  } catch (e) {
    console.error(e);
    await db.from("eds_posts").update({ status: "failed", error: log.concat(String((e as Error).message ?? e)).join("\n"), updated_at: new Date().toISOString() }).eq("id", id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const s = await settings();

  let by = "";
  if (req.headers.get("x-cron-secret")) {
    if (!s.cron_secret || req.headers.get("x-cron-secret") !== s.cron_secret) return json({ error: "Unauthorized" }, 401);
    const now = indiaNow();
    const due = s.schedule_enabled !== "false" && now.day === Number(s.schedule_day ?? 1) && now.hour === Number(s.schedule_hour ?? 10) && s.last_auto_run !== now.date;
    if (!due) return json({ skipped: true, reason: "not scheduled now" });
    await db.from("eds_settings").upsert({ key: "last_auto_run", value: now.date, updated_at: new Date().toISOString() });
    by = "schedule";
  } else {
    const email = await adminEmail(req);
    if (!email) return json({ error: "Unauthorized" }, 401);
    by = email;
  }

  const topic = String(body.topic ?? "").trim().slice(0, 200);
  EdgeRuntime.waitUntil(writePost(s, topic, by));
  return json({ started: true }, 202);
});
