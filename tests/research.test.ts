import { describe, expect, it } from "vitest";
import { feedUrl, mergeHeadlines, parseRss, type NewsItem } from "@/lib/research/news";
import { trendDirection } from "@/lib/research/wikipedia";
import { adsTrend } from "@/lib/research/googleAds";

const RSS = `<rss><channel>
<item><title>Supreme Court rules on tenant rights - The Guardian</title><link>https://news.google.com/a</link><pubDate>Thu, 22 Oct 2026 08:00:00 GMT</pubDate><source url="https://theguardian.com">The Guardian</source></item>
<item><title><![CDATA[Flu &amp; RSV cases rise &quot;sharply&quot; - BBC News]]></title><link>https://news.google.com/b</link><pubDate>Wed, 21 Oct 2026 08:00:00 GMT</pubDate><source url="https://bbc.co.uk">BBC News</source></item>
<item><title>No source here</title><link>https://news.google.com/c</link></item>
</channel></rss>`;

describe("Google News RSS parsing", () => {
  it("extracts title, link, source and ISO date, stripping the ' - Source' suffix", () => {
    const items = parseRss(RSS);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ title: "Supreme Court rules on tenant rights", link: "https://news.google.com/a", source: "The Guardian", published: "2026-10-22T08:00:00.000Z" });
  });

  it("decodes CDATA and HTML entities", () => {
    expect(parseRss(RSS)[1].title).toBe('Flu & RSV cases rise "sharply"');
  });

  it("tolerates items without source or date", () => {
    expect(parseRss(RSS)[2]).toMatchObject({ title: "No source here", source: "", published: "" });
  });

  it("returns an empty list for non-RSS input", () => {
    expect(parseRss("<html>blocked</html>")).toEqual([]);
  });
});

describe("headline merging", () => {
  const item = (title: string, published: string): NewsItem => ({ title, link: `https://x/${title}`, source: "S", published });

  it("de-duplicates by title (case-insensitive), sorts newest first and limits", () => {
    const out = mergeHeadlines(
      [
        [item("A story", "2026-10-20T00:00:00Z"), item("B story", "2026-10-22T00:00:00Z")],
        [item("a STORY", "2026-10-23T00:00:00Z"), item("C story", "2026-10-21T00:00:00Z")],
      ],
      2
    );
    expect(out.map((o) => o.title)).toEqual(["B story", "C story"]);
  });
});

describe("market-specific news feeds", () => {
  it("targets the client's country", () => {
    const uk = new URL(feedUrl("court ruling", 7, "UK"));
    expect(uk.searchParams.get("gl")).toBe("GB");
    expect(uk.searchParams.get("hl")).toBe("en-GB");
    expect(uk.searchParams.get("q")).toBe("court ruling when:7d");
    expect(new URL(feedUrl("x", 7, "AU")).searchParams.get("ceid")).toBe("AU:en");
  });
});

describe("trend direction from Wikipedia pageviews", () => {
  const series = (prior: number, recent: number) => [...Array(28).fill({ value: prior }), ...Array(28).fill({ value: recent })];
  it("detects rising, falling and steady interest with a ±15% band", () => {
    expect(trendDirection(series(100, 130))).toBe("rising");
    expect(trendDirection(series(100, 70))).toBe("falling");
    expect(trendDirection(series(100, 110))).toBe("stable");
  });
  it("needs 56 days of data", () => {
    expect(trendDirection(series(1, 2).slice(10))).toBeNull();
    expect(trendDirection(null)).toBeNull();
  });
  it("handles a zero baseline", () => {
    expect(trendDirection(series(0, 5))).toBe("rising");
    expect(trendDirection(series(0, 0))).toBe("stable");
  });
});

describe("trend direction from Google Ads monthly volumes", () => {
  const m = (...v: number[]) => v.map((searches) => ({ searches }));
  it("compares the last 3 months with the 3 before", () => {
    expect(adsTrend(m(100, 100, 100, 150, 150, 150))).toBe("rising");
    expect(adsTrend(m(100, 100, 100, 50, 50, 50))).toBe("falling");
    expect(adsTrend(m(100, 100, 100, 105, 100, 100))).toBe("stable");
    expect(adsTrend(m(1, 2, 3))).toBeNull();
  });
});
