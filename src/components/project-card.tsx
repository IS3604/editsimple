"use client";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import { assetUrlClient } from "@/lib/asset-url";
import { STAGES } from "@/lib/types";

export type ProjectListItem = {
  id: string;
  title: string;
  platform: string;
  slide_count: number;
  size: string;
  stage: number;
  status: "draft" | "generating" | "ready" | "failed";
  updated_at: string;
  design: { colors?: { background?: string; accent?: string } };
  slides: { render_path: string | null; background_path: string | null; position: number }[];
};

export function ProjectCard({ p }: { p: ProjectListItem }) {
  const first = [...(p.slides ?? [])].sort((a, b) => a.position - b.position)[0];
  const thumb = first?.render_path ?? null;
  const tone = p.status === "ready" ? "good" : p.status === "failed" ? "bad" : "muted";
  return (
    <Link href={`/projects/${p.id}`} className="lift group overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[4/5] overflow-hidden" style={{ background: p.design?.colors?.background ?? "#eee" }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrlClient(thumb)!} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageIcon className="h-8 w-8 opacity-30" />
          </div>
        )}
        <Badge tone={tone} className="absolute left-2 top-2 capitalize">{p.status}</Badge>
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 font-medium leading-snug">{p.title}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {p.platform} · {p.slide_count} slides · {new Date(p.updated_at).toLocaleDateString()}
        </p>
        {p.status !== "ready" && <p className="text-xs text-muted-foreground">Next: {STAGES[Math.min(p.stage < 1 ? 0 : p.stage < 3 ? 1 : p.stage < 4 ? 3 : p.stage - 1, 6)]}</p>}
      </div>
    </Link>
  );
}
