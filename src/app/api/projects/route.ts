import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { BriefInputSchema } from "@/lib/types";

export const GET = handle(async () => {
  const { sb } = await requireUser();
  const { data, error } = await sb
    .from("projects")
    .select("id,title,platform,slide_count,size,stage,status,stage_error,updated_at,design,slides(render_path,background_path,position)")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return NextResponse.json({ projects: data ?? [] });
});

export const POST = handle(async (req: Request) => {
  const { sb, user } = await requireUser();
  const b = BriefInputSchema.parse(await req.json());
  const { data: project, error } = await sb
    .from("projects")
    .insert({ user_id: user.id, title: b.topic.slice(0, 120), platform: b.platform, slide_count: b.slideCount, size: b.size, design: b.design })
    .select("*")
    .single();
  if (error) throw error;
  const { error: e2 } = await sb.from("content_briefs").insert({
    user_id: user.id,
    project_id: project.id,
    topic: b.topic,
    industry: b.industry,
    audience: b.audience,
    objective: b.objective,
    tone: b.tone,
    language: b.language,
    reference_url: b.referenceUrl || null,
    user_keywords: b.keywords,
  });
  if (e2) {
    await sb.from("projects").delete().eq("id", project.id);
    throw e2;
  }
  return NextResponse.json({ project });
});
