// Supabase Edge Function (EditSimple website module, name: eds-send-lead): receives EditSimple website form submissions,
// saves them to the "eds_leads" table (shown in the dashboard) and emails them via Resend.
// Expected JSON: { form: "popup" | "contact", subject: string, website: "" (honeypot), fields: { Email, ... } }
// Resend key / to / from emails are read from the dashboard Settings (falls back to old Supabase secrets).
// Deploy with "Verify JWT" OFF.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function cors(origin: string | null) {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());
  const ok = allowed.includes("*") || (origin !== null && allowed.includes(origin));
  return {
    "Access-Control-Allow-Origin": ok ? (origin ?? "*") : allowed[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Vary": "Origin",
  };
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const cut = (v: unknown, n = 500) => String(v ?? "").trim().slice(0, n);

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  if (body.website) return Response.json({ ok: true }, { headers }); // honeypot filled: silently drop bots

  const raw = (typeof body.fields === "object" && body.fields) ? body.fields as Record<string, unknown> : {};
  const fields = Object.entries(raw).filter(([, v]) => String(v ?? "").trim() !== "");
  const email = String(raw.Email ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Valid email required" }, { status: 400, headers });
  }
  if (fields.length > 25) return Response.json({ error: "Too many fields" }, { status: 400, headers });

  // 1. Save to the dashboard
  const name = cut(raw.Name || [raw["First Name"], raw["Last Name"]].filter(Boolean).join(" "), 200);
  const { data: saved, error: saveErr } = await db.from("eds_leads").insert({
    form: cut(body.form, 40),
    name,
    email: cut(email, 200),
    phone: cut(raw.Phone, 60),
    specialty: cut(raw.Specialty, 200),
    interested_in: cut(raw["Interested in"], 200),
    message: cut(raw.Message, 4000),
    page: cut(raw["Form Page"], 200),
    page_url: cut(raw["Page URL"], 1000),
    button: cut(raw.Button, 200),
    button_location: cut(raw["Button Location"], 200),
    referrer: cut(raw.Referrer, 1000),
    fields: Object.fromEntries(fields.map(([k, v]) => [cut(k, 60), cut(v, 4000)])),
  }).select("id").single();
  if (saveErr) console.error("Lead save failed", saveErr);

  // 2. Email it
  const { data: rows } = await db.from("eds_settings").select("key,value").in("key", ["resend_api_key", "lead_to_email", "lead_from_email"]);
  const s = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));
  const resendKey = s.resend_api_key || Deno.env.get("RESEND_API_KEY");
  const to = s.lead_to_email || Deno.env.get("TO_EMAIL");
  const from = s.lead_from_email || Deno.env.get("FROM_EMAIL");

  let emailed = false;
  if (resendKey && to && from) {
    const subject = String(body.subject ?? "New website enquiry").slice(0, 150);
    const trs = fields
      .map(([k, v]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #eee;font-weight:600;background:#fff7f2">${esc(k)}</td>` +
        `<td style="padding:8px 12px;border:1px solid #eee">${esc(String(v).slice(0, 2000)).replace(/\n/g, "<br>")}</td></tr>`)
      .join("");
    const html =
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#211b17">` +
      `<h2 style="color:#c2410c;margin:0 0 12px">${esc(subject)}</h2>` +
      `<table style="border-collapse:collapse">${trs}</table>` +
      `<p style="color:#888;font-size:12px;margin-top:16px">Sent from the EditSimple website (${esc(body.form ?? "form")}).</p></div>`;
    const text = fields.map(([k, v]) => `${k}: ${v}`).join("\n");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: to.split(",").map((x: string) => x.trim()).filter(Boolean), reply_to: email, subject, html, text }),
    });
    emailed = res.ok;
    if (!res.ok) console.error("Resend error", res.status, await res.text());
    if (emailed && saved) await db.from("eds_leads").update({ email_sent: true }).eq("id", saved.id);
  }

  if (!saved && !emailed) return Response.json({ error: "Could not save lead" }, { status: 502, headers });
  return Response.json({ ok: true }, { headers });
});
