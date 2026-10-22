import { PageHeader } from "@/components/app-shell";
import { TrendingLists } from "@/components/trending-lists";

export default function TrendingPage() {
  return (
    <div>
      <PageHeader title="Trending topics" subtitle="Live public attention signals — pick one to research." />
      <TrendingLists />
    </div>
  );
}
