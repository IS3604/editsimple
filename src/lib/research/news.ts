import "server-only";
import { MARKETS, type MarketCode } from "@/lib/markets";
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

/** Merge, de-duplicate (by title) and sort newest first. */
export function mergeHeadlines(lists: NewsItem[][], limit = 30): NewsItem[] {
  const seen = new Set<string>();
  const all: NewsItem[] = [];
  lists.forEach((l) =>
    l.slice(0, 15).forEach((i) => {
      const k = i.title.toLowerCase().slice(0, 80);
      if (!seen.has(k)) {
        seen.add(k);
        all.push(i);
      }
    })
  );
  return all.sort((a, b) => b.published.localeCompare(a.published)).slice(0, limit);
}

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

export const feedUrl = (q: string, days = 7, market: MarketCode = "US") => {
  const m = MARKETS[market];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${days}d`)}&hl=${m.hl}&gl=${m.gl}&ceid=${m.ceid}`;
};

export async function searchNews(q: string, days = 7, market: MarketCode = "US"): Promise<NewsItem[]> {
  const r = await fetchT(feedUrl(q, days, market), { timeoutMs: 9000, headers: { "User-Agent": "Mozilla/5.0 (EditSimple news reader)" } });
  if (!r.ok) throw new Error(`Google News ${r.status}`);
  return parseRss(await r.text());
}

/** Number of distinct articles in the last 7 days (feed caps at ~100). */
export async function newsMentions(keyword: string, market: MarketCode = "US"): Promise<number> {
  const items = await searchNews(`"${keyword}"`, 7, market);
  return new Set(items.map((i) => i.title.toLowerCase())).size;
}

export async function nicheHeadlines(queries: string[], limit = 30, market: MarketCode = "US"): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(queries.map((q) => searchNews(q, 7, market)));
  const lists = settled.map((x) => (x.status === "fulfilled" ? x.value : []));
  const all = mergeHeadlines(lists, limit);
  if (!all.length && settled.every((x) => x.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  return all;
}
