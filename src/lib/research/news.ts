import "server-only";
import { env } from "@/lib/env";
import { fetchT } from "@/lib/http";

/**
 * Google News RSS (public feed, no key). Real headlines with source + date.
 * Used for: niche trending headlines, and "news mentions in the last 7 days" per keyword.
 */
export type NewsItem = { title: string; link: string; source: string; published: string };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

export function parseRss(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const get = (tag: string) => decode(block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? "");
    const source = get("source");
    let title = get("title");
    // Google appends " - Source" to titles
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const pub = get("pubDate");
    out.push({ title, link: get("link"), source, published: pub ? new Date(pub).toISOString() : "" });
  }
  return out;
}

const feedUrl = (q: string, days = 7) => {
  const hl = `${env.language}-${env.region}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${days}d`)}&hl=${hl}&gl=${env.region}&ceid=${env.region}:${env.language}`;
};

export async function searchNews(q: string, days = 7): Promise<NewsItem[]> {
  const r = await fetchT(feedUrl(q, days), { timeoutMs: 9000, headers: { "User-Agent": "Mozilla/5.0 (EditSimple news reader)" } });
  if (!r.ok) throw new Error(`Google News ${r.status}`);
  return parseRss(await r.text());
}

/** Number of distinct articles in the last 7 days (feed caps at ~100). */
export async function newsMentions(keyword: string): Promise<number> {
  const items = await searchNews(`"${keyword}"`);
  return new Set(items.map((i) => i.title.toLowerCase())).size;
}

export async function nicheHeadlines(queries: string[], limit = 30): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(queries.map((q) => searchNews(q, 7)));
  const seen = new Set<string>();
  const all: NewsItem[] = [];
  settled.forEach((s) => {
    if (s.status !== "fulfilled") return;
    s.value.slice(0, 15).forEach((i) => {
      const k = i.title.toLowerCase().slice(0, 80);
      if (!seen.has(k)) {
        seen.add(k);
        all.push(i);
      }
    });
  });
  if (!all.length && settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  return all.sort((a, b) => b.published.localeCompare(a.published)).slice(0, limit);
}
