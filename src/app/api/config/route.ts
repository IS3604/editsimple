import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";
import { env, adsConfigured } from "@/lib/env";

/** Which providers are configured (booleans only — never secrets). */
export const GET = handle(async () => {
  await requireUser();
  return NextResponse.json({
    text: env.groqKey || env.openaiKey ? (env.textProvider === "groq" && env.groqKey ? "groq" : env.openaiKey ? "openai" : "groq") : null,
    images: env.imageProvider === "openai" && env.openaiKey ? `openai:${env.openaiImageModel}` : null,
    googleAds: adsConfigured(),
    youtube: !!env.youtubeKey,
    wikipedia: true,
    region: env.region,
  });
});
