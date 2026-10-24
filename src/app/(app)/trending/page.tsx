"use client";
import { PageHeader } from "@/components/app-shell";
import { Card, ErrorBanner, Segmented } from "@/components/ui";
import { HeadlineList, IdeaCards, TrendingFooter, VideoList, useTrending } from "@/components/trending-lists";
import { NICHES } from "@/lib/niches";
import { useNiche } from "@/lib/use-niche";

export default function TrendingPage() {
  const [niche, setNiche] = useNiche();
  const { data, error, loading, reload } = useTrending(niche);

  return (
    <div>
      <PageHeader
        title={`Trending for ${NICHES[niche].label.toLowerCase()}`}
        subtitle="This week's real headlines and videos in your field, turned into post ideas you can write in one click."
        actions={
          <Segmented
            value={niche}
            onChange={setNiche}
            options={[
              { value: "medical", label: "Doctors" },
              { value: "legal", label: "Lawyers" },
            ]}
          />
        }
      />
      <ErrorBanner error={error} onRetry={() => reload()} />

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg">Post ideas from this week</h2>
          <span className="text-xs text-muted-foreground">Written by AI from the headlines on the right</span>
        </div>
        <IdeaCards niche={niche} data={data} limit={8} />
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px]">In the news</h2>
          <p className="mt-1 text-xs text-muted-foreground">Google News, India, last 7 days</p>
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
