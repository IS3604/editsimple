import "server-only";
import { env } from "@/lib/env";
import { fetchT } from "@/lib/http";

/**
 * Wikimedia public APIs (no key). Real data: daily human pageviews of the matching article,
 * used as a transparent PROXY for public interest over time (labelled as such in the UI).
 */
const headers = () => ({ "User-Agent": env.wikiUA, "Api-User-Agent": env.wikiUA });

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export async function resolveArticle(term: string): Promise<string | null> {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "query", list: "search", srsearch: term, srlimit: "1", format: "json", origin: "*" }).toString();
  const r = await fetchT(u.toString(), { headers: headers(), timeoutMs: 8000 });
  if (!r.ok) return null;
  const j = await r.json();
  return j?.query?.search?.[0]?.title ?? null;
}

export async function pageviews(title: string, days = 120): Promise<{ date: string; value: number }[] | null> {
  const end = new Date(Date.now() - 86400000); // yesterday (today is incomplete)
  const start = new Date(end.getTime() - days * 86400000);
  const article = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${article}/daily/${ymd(start)}00/${ymd(end)}00`;
  const r = await fetchT(url, { headers: headers(), timeoutMs: 8000 });
  if (!r.ok) return null;
  const j = await r.json();
  const items: { timestamp: string; views: number }[] = j?.items ?? [];
  if (!items.length) return null;
  return items.map((i) => ({
    date: `${i.timestamp.slice(0, 4)}-${i.timestamp.slice(4, 6)}-${i.timestamp.slice(6, 8)}`,
    value: i.views,
  }));
}

/** Compares the mean of the last 28 points with the 28 before. ±15% threshold. */
export function trendDirection(series: { value: number }[] | null): "rising" | "falling" | "stable" | null {
  if (!series || series.length < 56) return null;
  const v = series.map((s) => s.value);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const recent = avg(v.slice(-28));
  const prior = avg(v.slice(-56, -28));
  if (prior === 0) return recent > 0 ? "rising" : "stable";
  const change = (recent - prior) / prior;
  return change > 0.15 ? "rising" : change < -0.15 ? "falling" : "stable";
}

export type WikiTrending = { title: string; views: number; rank: number; extract?: string; date: string };

/** Most-read English Wikipedia articles for a day (real, published by Wikimedia). */
export async function mostRead(): Promise<WikiTrending[]> {
  const d = new Date(Date.now() - 86400000);
  const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  const r = await fetchT(`https://en.wikipedia.org/api/rest_v1/feed/featured/${path}`, { headers: headers(), timeoutMs: 10000 });
  if (!r.ok) throw new Error(`Wikimedia feed ${r.status}`);
  const j = await r.json();
  const arts: { titles?: { normalized?: string }; title?: string; views: number; rank: number; extract?: string }[] =
    j?.mostread?.articles ?? [];
  return arts
    .filter((a) => !/^(Special|Main_Page|Wikipedia):/.test(a.title ?? ""))
    .slice(0, 25)
    .map((a) => ({
      title: a.titles?.normalized ?? (a.title ?? "").replace(/_/g, " "),
      views: a.views,
      rank: a.rank,
      extract: a.extract?.slice(0, 200),
      date: j?.mostread?.date ?? path,
    }));
}
