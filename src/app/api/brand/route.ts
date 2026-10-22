import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { ColorsSchema, FONT_KEYS, THEMES } from "@/lib/types";

export const GET = handle(async () => {
  const { sb } = await requireUser();
  const { data } = await sb.from("brand_settings").select("*").order("is_default", { ascending: false }).order("updated_at", { ascending: false });
  return NextResponse.json({ brands: data ?? [] });
});

const Body = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  theme: z.enum(THEMES),
  colors: ColorsSchema,
  font_heading: z.enum(FONT_KEYS),
  font_body: z.enum(FONT_KEYS),
  logo_path: z.string().max(400).nullable().optional(),
  tone: z.string().max(80).optional(),
  language: z.string().max(40).optional(),
  is_default: z.boolean().default(true),
});

export const PUT = handle(async (req: Request) => {
  const { sb, user } = await requireUser();
  const b = Body.parse(await req.json());
  if (b.is_default) await sb.from("brand_settings").update({ is_default: false }).eq("user_id", user.id);
  const row = { ...b, user_id: user.id };
  const q = b.id ? sb.from("brand_settings").update(row).eq("id", b.id) : sb.from("brand_settings").insert(row);
  const { data, error } = await q.select("*").single();
  if (error) throw error;
  return NextResponse.json({ brand: data });
});

export const DELETE = handle(async (req: Request) => {
  const { sb } = await requireUser();
  const id = z.string().uuid().parse(new URL(req.url).searchParams.get("id"));
  await sb.from("brand_settings").delete().eq("id", id);
  return NextResponse.json({ ok: true });
});
