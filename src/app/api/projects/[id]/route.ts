import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/http";
import { BUCKET, requireUser } from "@/lib/supabase/server";
import { getProject, loadProjectBundle } from "@/lib/data";
import { DesignSchema } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb } = await requireUser();
  return NextResponse.json(await loadProjectBundle(sb, id));
});

const Patch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  design: DesignSchema.optional(),
  size: z.enum(["1080x1350", "1080x1080"]).optional(),
  stage: z.number().int().min(0).max(7).optional(),
  status: z.enum(["draft", "generating", "ready", "failed"]).optional(),
  stage_error: z.string().max(500).nullable().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb } = await requireUser();
  await getProject(sb, id);
  const body = Patch.parse(await req.json());
  const { data, error } = await sb.from("projects").update(body).eq("id", id).select("*").single();
  if (error) throw error;
  return NextResponse.json({ project: data });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { sb, user } = await requireUser();
  await getProject(sb, id);
  // remove stored files for this project
  const prefix = `${user.id}/projects/${id}`;
  for (const sub of ["backgrounds", "renders"]) {
    const { data } = await sb.storage.from(BUCKET).list(`${prefix}/${sub}`, { limit: 1000 });
    if (data?.length) await sb.storage.from(BUCKET).remove(data.map((f) => `${prefix}/${sub}/${f.name}`));
  }
  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
