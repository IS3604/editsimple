import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { runResearch } from "@/lib/research";
import { getProject } from "@/lib/data";

export const maxDuration = 60;

const Body = z.object({
  topic: z.string().trim().min(2).max(200),
  niche: z.string().trim().max(120).optional().default(""),
  platform: z.enum(["instagram", "linkedin", "both"]).default("instagram"),
  audience: z.string().trim().max(200).optional().default(""),
  userKeywords: z.array(z.string().trim().min(1).max(80)).max(15).default([]),
  projectId: z.string().uuid().optional(),
});

/** Run research, persist it, return rows with ids. */
export const POST = handle(async (req: Request) => {
  const { sb, user } = await requireUser();
  const body = Body.parse(await req.json());
  if (body.projectId) await getProject(sb, body.projectId);

  const result = await runResearch(body);

  const { data: research, error } = await sb
    .from("keyword_research")
    .insert({ user_id: user.id, project_id: body.projectId ?? null, topic: body.topic, niche: body.niche, platform: body.platform, sources: result.sources })
    .select("*")
    .single();
  if (error) throw error;

  const { data: rows, error: e2 } = await sb
    .from("keyword_metrics")
    .insert(result.rows.map((r) => ({ ...r, user_id: user.id, research_id: research.id })))
    .select("*");
  if (e2) throw e2;

  if (body.projectId)
    await sb.from("projects").update({ stage: 1, status: "draft", stage_error: null }).eq("id", body.projectId).lt("stage", 1);

  return NextResponse.json({ research, rows });
});

/** GET ?id=<researchId> → one run with metrics; otherwise recent runs. */
export const GET = handle(async (req: Request) => {
  const { sb } = await requireUser();
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const [{ data: research }, { data: rows }] = await Promise.all([
      sb.from("keyword_research").select("*").eq("id", id).maybeSingle(),
      sb.from("keyword_metrics").select("*").eq("research_id", id),
    ]);
    if (!research) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ research, rows });
  }
  const { data } = await sb.from("keyword_research").select("id,topic,niche,platform,created_at,project_id").order("created_at", { ascending: false }).limit(20);
  return NextResponse.json({ runs: data ?? [] });
});
