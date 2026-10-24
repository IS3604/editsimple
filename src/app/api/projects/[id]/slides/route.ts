import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { getProject } from "@/lib/data";
import { LAYOUTS, SLIDE_KINDS } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const SlideIn = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(SLIDE_KINDS).default("statement"),
  items: z.array(z.object({ title: z.string().max(80), text: z.string().max(300) })).max(8).default([]),
  role: z.string().max(40).default("insight"),
  kicker: z.string().max(60).nullable().default(null),
  heading: z.string().max(160),
  body: z.string().max(600),
  visual_prompt: z.string().max(600).nullable().default(null),
  layout: z.enum(LAYOUTS),
  background_path: z.string().max(400).nullable().default(null),
  style: z
    .object({
      background: z.string().optional(),
      text: z.string().optional(),
      accent: z.string().optional(),
      headingScale: z.number().min(0.5).max(1.6).optional(),
      overlay: z.number().min(0).max(0.95).optional(),
      focusY: z.number().min(0).max(100).optional(),
    })
    .default({}),
});

/** Save the full slide deck (order = array order). Slides not in the list are deleted. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  await getProject(sb, id);
  const { slides } = z.object({ slides: z.array(SlideIn).min(1, "Keep at least 1 slide").max(10) }).parse(await req.json());

  const { data: existing } = await sb.from("slides").select("id").eq("project_id", id);
  const keep = new Set(slides.map((s) => s.id).filter(Boolean));
  const toDelete = (existing ?? []).map((e) => e.id).filter((x) => !keep.has(x));
  if (toDelete.length) await sb.from("slides").delete().in("id", toDelete);

  const rows = slides.map((s, i) => ({ ...s, position: i, project_id: id, user_id: user.id }));
  const withId = rows.filter((r) => r.id);
  const fresh = rows.filter((r) => !r.id).map(({ id: _drop, ...r }) => r);
  if (withId.length) {
    const { error } = await sb.from("slides").upsert(withId);
    if (error) throw error;
  }
  if (fresh.length) {
    const { error } = await sb.from("slides").insert(fresh);
    if (error) throw error;
  }
  await sb.from("projects").update({ slide_count: slides.length }).eq("id", id);
  const { data } = await sb.from("slides").select("*").eq("project_id", id).order("position");
  return NextResponse.json({ slides: data });
});
