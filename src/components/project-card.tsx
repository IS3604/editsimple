"use client";
import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { assetUrlClient } from "@/lib/asset-url";
import { cn } from "@/lib/utils";

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

const STATUS: Record<ProjectListItem["status"], { label: string; cls: string }> = {
  ready: { label: "Ready", cls: "bg-emerald-500" },
  failed: { label: "Needs attention", cls: "bg-rose-500" },
  generating: { label: "In progress", cls: "bg-amber-400" },
  draft: { label: "Draft", cls: "bg-neutral-300" },
};

export function ProjectCard({ p, compact }: { p: ProjectListItem; compact?: boolean }) {
  const first = [...(p.slides ?? [])].sort((a, b) => a.position - b.position)[0];
  const thumb = first?.render_path ?? null;
  const st = STATUS[p.status] ?? STATUS.draft;
  return (
    <Link href={`/projects/${p.id}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl ring-1 ring-border transition-shadow group-hover:shadow-[0_16px_34px_-20px_rgb(15_18_30/.5)]" style={{ background: p.design?.colors?.background ?? "#eceef2" }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrlClient(thumb)!} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center">
            <ImageIcon className="h-7 w-7 opacity-25" />
          </div>
        )}
      </div>
      <div className={cn("pt-2.5", compact && "pt-2")}>
        <p className={cn("line-clamp-2 font-medium leading-snug", compact ? "text-[13px]" : "text-[14px]")}>{p.title}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", st.cls)} />
          {st.label}
          {!compact && <span className="ml-1">{new Date(p.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
        </p>
      </div>
    </Link>
  );
}
