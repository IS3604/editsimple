import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { pushConfigured, sendPush, type PushSub } from "@/lib/push-server";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sends a test notification to every browser where the signed-in user turned notifications on. */
export const POST = handle(async () => {
  const { sb } = await requireUser();
  if (!pushConfigured()) return NextResponse.json({ ok: false, message: "Push isn’t set up yet: add the VAPID keys in Vercel." });
  const { data, error } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (error) return NextResponse.json({ ok: false, message: error.message });
  if (!data?.length) return NextResponse.json({ ok: false, message: "Turn on notifications in this browser first." });
  const { sent, gone } = await sendPush(data as PushSub[], { title: "Test notification", body: "New website leads will show up like this.", url: "/website/leads", tag: "eds-test" });
  if (gone.length) await sb.from("push_subscriptions").delete().in("endpoint", gone);
  return NextResponse.json(
    sent
      ? { ok: true, message: `Sent to ${sent} device${sent > 1 ? "s" : ""}` }
      : { ok: false, message: "Couldn’t reach this browser. Turn notifications off and on again." }
  );
});
