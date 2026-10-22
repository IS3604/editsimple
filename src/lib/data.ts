import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http";
import type { KeywordMetric, Slide, SourceStatus } from "@/lib/types";

export async function getProject(sb: SupabaseClient, id: string) {
  const { data: project, error } = await sb.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!project) throw new HttpError(404, "Project not found");
  return project;
}

export async function loadProjectBundle(sb: SupabaseClient, id: string) {
  const project = await getProject(sb, id);
  const [brief, slides, captions, research] = await Promise.all([
    sb.from("content_briefs").select("*").eq("project_id", id).maybeSingle(),
    sb.from("slides").select("*").eq("project_id", id).order("position"),
    sb.from("captions").select("*").eq("project_id", id),
    sb.from("keyword_research").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  let keywords: KeywordMetric[] = [];
  if (research.data) {
    const { data } = await sb.from("keyword_metrics").select("*").eq("research_id", research.data.id);
    keywords = (data ?? []) as KeywordMetric[];
  }
  return {
    project,
    brief: brief.data,
    slides: (slides.data ?? []) as Slide[],
    captions: captions.data ?? [],
    research: research.data as (null | { id: string; sources: SourceStatus[]; created_at: string; topic: string }),
    keywords,
  };
}

export async function selectedKeywords(sb: SupabaseClient, projectId: string) {
  const { data: r } = await sb
    .from("keyword_research").select("id").eq("project_id", projectId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!r) return { keywords: [] as string[], hashtags: [] as string[] };
  const { data } = await sb.from("keyword_metrics").select("keyword,kind,selected").eq("research_id", r.id);
  const rows = data ?? [];
  return {
    keywords: rows.filter((k) => k.selected && k.kind !== "hashtag").map((k) => k.keyword),
    hashtags: rows.filter((k) => k.kind === "hashtag").map((k) => k.keyword),
  };
}

export async function setStage(sb: SupabaseClient, id: string, stage: number, status: "draft" | "generating" | "ready" | "failed" = "generating", error: string | null = null) {
  await sb.from("projects").update({ stage, status, stage_error: error }).eq("id", id);
}
