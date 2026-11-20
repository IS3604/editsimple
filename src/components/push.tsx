"use client";
import { BellOff, BellRing, Loader2, Send, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/components/feedback";
import { Badge, Button, type BadgeTone } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";

/* Browser push notifications for new website leads: helpers, the enable pop-up and the settings switch. */

export type PushState = "unsupported" | "ios-install" | "off" | "denied" | "on";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON();
  const { error } = await supabaseBrowser().rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: j.keys?.p256dh ?? "",
    p_auth: j.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
}

async function subscribe(reg: ServiceWorkerRegistration) {
  return (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
}

/** Current state; when permission is already granted it quietly (re)subscribes and saves, so this browser stays on. */
export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !standalone() ? "ios-install" : "unsupported";
  if (!KEY) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  try {
    await save(await subscribe(await registration()));
    return "on";
  } catch {
    return "off";
  }
}

/** Asks for permission (must run from a click) and subscribes this browser. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported() || !KEY) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm === "denied") return "denied";
  if (perm !== "granted") return "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub: PushSubscription;
  try {
    sub = await subscribe(reg);
  } catch {
    throw new Error("This browser couldn’t set up notifications. In Brave, turn on “Use Google services for push messaging” in settings, or use Chrome, Edge or Firefox.");
  }
  await save(sub);
  return "on";
}

export async function disablePush() {
  if (!pushSupported()) return;
  const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
  if (!sub) return;
  await supabaseBrowser().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

const SNOOZE = "eds-push-prompt-snooze";
const DAY = 864e5;

/**
 * Pop-up for Website team members who haven't turned on browser notifications yet.
 * "Later" hides it for 3 days (7 days when the browser has blocked notifications).
 */
export function PushPrompt() {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const s = await pushState();
      if (!alive) return;
      setState(s);
      let until = 0;
      try {
        until = Number(localStorage.getItem(SNOOZE) || 0);
      } catch {
        /* storage blocked */
      }
      if ((s === "off" || s === "denied" || s === "ios-install") && Date.now() > until) setShow(true);
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const later = () => {
    try {
      localStorage.setItem(SNOOZE, String(Date.now() + (state === "denied" ? 7 : 3) * DAY));
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  const enable = async () => {
    setBusy(true);
    try {
      const s = await enablePush();
      setState(s);
      if (s === "on") {
        setShow(false);
        toast(true, "Notifications are on. You’ll get one for every new website lead.");
      } else if (s === "denied") toast(false, "Notifications were blocked in this browser.");
    } catch (e) {
      toast(false, (e as Error).message);
    }
    setBusy(false);
  };

  if (!show || !state || typeof document === "undefined") return null;
  const blocked = state === "denied",
    ios = state === "ios-install";
  return createPortal(
    <div role="dialog" aria-labelledby="push-title" className="fixed inset-x-3 bottom-3 z-[60] animate-fade-up rounded-2xl border bg-card p-4 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px]">
      <button aria-label="Close" onClick={later} className="absolute right-2.5 top-2.5 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent-soft))] text-accent">
          {blocked ? <BellOff className="h-5 w-5" /> : ios ? <Smartphone className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2 id="push-title" className="text-[14.5px] font-semibold">
            {blocked ? "Notifications are blocked" : ios ? "Add EditSimple to your Home Screen" : "Get notified about new website leads"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {blocked ? (
              <>Click the lock icon next to the address bar, set <b className="text-foreground">Notifications</b> to <b className="text-foreground">Allow</b>, then reload this page.</>
            ) : ios ? (
              <>On iPhone, notifications only work from the Home Screen app. Tap <b className="text-foreground">Share</b>, then <b className="text-foreground">Add to Home Screen</b>, open it from there and turn them on.</>
            ) : (
              "This device pings you the moment someone fills in a form on editsimple.in, even when this tab is closed."
            )}
          </p>
          <div className="mt-3 flex gap-2">
            {!blocked && !ios && (
              <Button size="sm" variant="accent" onClick={enable} loading={busy}>
                {!busy && <BellRing className="h-3.5 w-3.5" />}Turn on
              </Button>
            )}
            <Button size="sm" variant={blocked || ios ? "accent" : "outline"} onClick={later}>
              {blocked || ios ? "Got it" : "Later"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const LABEL: Record<PushState, { text: string; tone: BadgeTone }> = {
  on: { text: "On in this browser", tone: "good" },
  off: { text: "Off in this browser", tone: "muted" },
  denied: { text: "Blocked by the browser", tone: "bad" },
  unsupported: { text: "Not supported here", tone: "muted" },
  "ios-install": { text: "Add to Home Screen first", tone: "warn" },
};

/** Per-browser notification switch + "Send test". */
export function PushSettings() {
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState<"toggle" | "test" | null>(null);
  useEffect(() => {
    void pushState().then(setState);
  }, []);

  const toggle = async () => {
    setBusy("toggle");
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        toast(true, "Notifications turned off in this browser");
      } else {
        const s = await enablePush();
        setState(s);
        if (s === "on") toast(true, "Notifications are on");
        else if (s === "denied") toast(false, "Notifications are blocked in this browser.");
      }
    } catch (e) {
      toast(false, (e as Error).message);
    }
    setBusy(null);
  };
  const test = async () => {
    setBusy("test");
    const r = await fetch("/api/push/test", { method: "POST" })
      .then((x) => x.json() as Promise<{ ok?: boolean; message?: string; error?: string }>)
      .catch((e: Error) => ({ ok: false, message: e.message }));
    toast(!!r.ok, r.message || ("error" in r && r.error) || "Request failed");
    setBusy(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <BellRing className="h-4 w-4 text-accent" />
        <b className="text-sm font-medium">New lead alerts</b>
        {state ? <Badge dot tone={LABEL[state].tone}>{LABEL[state].text}</Badge> : <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        {state === "denied"
          ? "Click the lock icon next to the address bar, set Notifications to Allow, then reload."
          : state === "ios-install"
            ? "On iPhone: Share → Add to Home Screen, then open it from the Home Screen and turn this on."
            : state === "unsupported" && !KEY
              ? "Push isn’t set up yet: add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel, then redeploy."
              : "Each device you use gets its own switch. With this on you get a notification for every new website lead."}
      </p>
      <div className="flex flex-wrap gap-2">
        {(state === "on" || state === "off") && (
          <Button size="sm" variant={state === "on" ? "outline" : "accent"} onClick={toggle} disabled={!!busy} loading={busy === "toggle"}>
            {state === "on" ? "Turn off" : "Turn on"}
          </Button>
        )}
        {state === "on" && (
          <Button size="sm" variant="outline" onClick={test} disabled={!!busy} loading={busy === "test"}>
            {busy !== "test" && <Send className="h-3.5 w-3.5" />}Send test
          </Button>
        )}
      </div>
    </div>
  );
}
