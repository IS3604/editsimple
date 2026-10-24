"use client";
import { PageHeader } from "@/components/app-shell";
import { Card, ErrorBanner, Segmented } from "@/components/ui";
import { HeadlineList, IdeaCards, TrendingFooter, VideoList, useTrending } from "@/components/trending-lists";
import { NICHES } from "@/lib/niches";
import { useMarket, useNiche } from "@/lib/use-niche";
import { MARKETS, MARKET_CODES, type MarketCode } from "@/lib/markets";
import { Select } from "@/components/ui";

export default function TrendingPage() {
  const [niche, setNiche] = useNiche();
  const [market, setMarket] = useMarket();
  const { data, error, loading, reload } = useTrending(niche, market);

  return (
    <div>
      <PageHeader
        title={`Trending for ${NICHES[niche].label.toLowerCase()}`}
        subtitle={`This week's real headlines and videos in ${MARKETS[market].label}, turned into post ideas your team can write in one click.`}
        actions={
          <div className="flex flex-wrap gap-2">
          <Select className="w-44" value={market} onChange={(e) => setMarket(e.target.value as MarketCode)} aria-label="Market">
            {MARKET_CODES.map((c) => <option key={c} value={c}>{MARKETS[c].label}</option>)}
          </Select>
          <Segmented
            value={niche}
            onChange={setNiche}
            options={[
              { value: "medical", label: "Doctors" },
              { value: "legal", label: "Lawyers" },
            ]}
          />
          </div>
        }
      />
      <ErrorBanner error={error} onRetry={() => reload()} />

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg">Post ideas from this week</h2>
          <span className="text-xs text-muted-foreground">Written by AI from the headlines below</span>
        </div>
        <IdeaCards niche={niche} data={data} limit={8} />
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px]">In the news</h2>
          <p className="mt-1 text-xs text-muted-foreground">Google News, {MARKETS[market].label}, last 7 days</p>
          <div className="mt-2">
            <HeadlineList data={data} limit={14} />
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-[15px]">Most watched this week</h2>
          <p className="mt-1 text-xs text-muted-foreground">YouTube, “{NICHES[niche].youtubeQuery}”, real view counts</p>
          <div className="mt-2">
            <VideoList data={data} limit={10} />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <TrendingFooter data={data} loading={loading} onRefresh={() => reload(true)} />
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Instagram doesn&apos;t publish trending or search data through its official APIs, so EditSimple reads public news and YouTube signals instead.
          Post ideas are AI suggestions — check facts against the linked source before publishing.
        </p>
      </div>
    </div>
  );
}
