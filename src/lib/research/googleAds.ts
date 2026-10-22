import "server-only";
import { env, adsConfigured } from "@/lib/env";
import { fetchT } from "@/lib/http";

/**
 * Google Ads API — KeywordPlanIdeaService.GenerateKeywordIdeas (REST).
 * The only official Google source of keyword search volume ranges & competition.
 * Requires: developer token (approved), OAuth client, refresh token, Ads customer id.
 */
export type AdsIdea = {
  keyword: string;
  avg_monthly_searches: number | null;
  competition: string | null;
  competition_index: number | null;
  monthly_searches: { month: string; searches: number }[] | null;
};

const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

let cached: { token: string; exp: number } | null = null;

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const r = await fetchT("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.ads.clientId,
      client_secret: env.ads.clientSecret,
      refresh_token: env.ads.refreshToken,
      grant_type: "refresh_token",
    }),
    timeoutMs: 10000,
  });
  if (!r.ok) throw new Error(`Google OAuth ${r.status}`);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

export { adsConfigured };

export async function keywordIdeas(seeds: string[], pageSize = 40): Promise<AdsIdea[]> {
  const token = await accessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": env.ads.developerToken,
    "Content-Type": "application/json",
  };
  if (env.ads.loginCustomerId) headers["login-customer-id"] = env.ads.loginCustomerId;

  const r = await fetchT(
    `https://googleads.googleapis.com/${env.ads.version}/customers/${env.ads.customerId}:generateKeywordIdeas`,
    {
      method: "POST",
      headers,
      timeoutMs: 20000,
      body: JSON.stringify({
        language: `languageConstants/${env.ads.language}`,
        geoTargetConstants: [`geoTargetConstants/${env.ads.geo}`],
        keywordPlanNetwork: "GOOGLE_SEARCH",
        includeAdultKeywords: false,
        pageSize,
        keywordSeed: { keywords: seeds.slice(0, 20) },
      }),
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Google Ads ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return (j.results ?? []).map((res: any) => {
    const m = res.keywordIdeaMetrics ?? {};
    const monthly = (m.monthlySearchVolumes ?? []).map((v: any) => ({
      month: `${v.year}-${String(MONTHS.indexOf(v.month) + 1).padStart(2, "0")}`,
      searches: Number(v.monthlySearches ?? 0),
    })).sort((a: { month: string }, b: { month: string }) => a.month.localeCompare(b.month));
    return {
      keyword: res.text,
      avg_monthly_searches: m.avgMonthlySearches != null ? Number(m.avgMonthlySearches) : null,
      competition: m.competition && m.competition !== "UNSPECIFIED" ? String(m.competition).toLowerCase() : null,
      competition_index: m.competitionIndex != null ? Number(m.competitionIndex) : null,
      monthly_searches: monthly.length ? monthly : null,
    };
  });
}

/** Last 3 months vs the 3 before, ±15%. */
export function adsTrend(monthly: { searches: number }[] | null) {
  if (!monthly || monthly.length < 6) return null;
  const v = monthly.map((m) => m.searches);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const recent = sum(v.slice(-3));
  const prior = sum(v.slice(-6, -3));
  if (!prior) return recent ? ("rising" as const) : ("stable" as const);
  const c = (recent - prior) / prior;
  return c > 0.15 ? ("rising" as const) : c < -0.15 ? ("falling" as const) : ("stable" as const);
}
