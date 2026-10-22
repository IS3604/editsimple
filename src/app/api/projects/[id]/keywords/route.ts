import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject } from "@/lib/data";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  researchId: z.string().uuid(),
  selectedIds: z.array(z.string().uuid()).max(60),
  custom: z.array(z.string().trim().min(1).max(80)).max(15).default([]),
});

/** Save the user's keyword selection (+ custom keywords) for a project. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  await getProject(sb, id);
  const b = Body.parse(await req.json());

  const { data: research } = await sb.from("keyword_research").select("id,project_id").eq("id", b.researchId).maybeSingle();
  if (!research) throw new HttpError(404, "Research not found");
  if (research.project_id !== id) await sb.from("keyword_research").update({ project_id: id }).eq("id", b.researchId);

  await sb.from("keyword_metrics").update({ selected: false }).eq("research_id", b.researchId);
  if (b.selectedIds.length)
    await sb.from("keyword_metrics").update({ selected: true }).eq("research_id", b.researchId).in("id", b.selectedIds);

  if (b.custom.length) {
    const { data: existing } = await sb.from("keyword_metrics").select("keyword").eq("research_id", b.researchId);
    const have = new Set((existing ?? []).map((e) => e.keyword.toLowerCase()));
    const fresh = b.custom.filter((c) => !have.has(c.toLowerCase()));
    if (fresh.length)
      await sb.from("keyword_metrics").insert(
        fresh.map((k) => ({ user_id: user.id, research_id: b.researchId, keyword: k, kind: "user", origin: "user", selected: true }))
      );
  }
  await sb.from("projects").update({ stage: 1 }).eq("id", id).lt("stage", 1);
  return NextResponse.json({ ok: true });
});
