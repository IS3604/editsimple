import { describe, expect, it } from "vitest";
import { escapeHtml, isHttpUrl, leadFields, leadKind, leadsCsv, leadSource, leadStatus, nextRun, slugify, type EdsLead } from "@/lib/eds";

const lead = (p: Partial<EdsLead> = {}): EdsLead => ({
  id: 1, created_at: "2026-11-01T10:00:00Z", form: "popup", name: "Dr Asha", email: "asha@example.com", phone: "+91 98", specialty: "Dermatology",
  interested_in: "Free video", message: "", page: "Home", page_url: "https://editsimple.in/", button: "Get free video", button_location: "hero",
  referrer: "", fields: {}, email_sent: true, status: null, ...p,
});

describe("website leads", () => {
  it("classifies lead type for the chart", () => {
    expect(leadKind(lead())).toBe("free");
    expect(leadKind(lead({ interested_in: "Book a call" }))).toBe("call");
    expect(leadKind(lead({ form: "contact", interested_in: "Free video" }))).toBe("contact");
  });

  it("defaults unknown status to new", () => {
    expect(leadStatus(lead({ status: null }))).toBe("new");
    expect(leadStatus(lead({ status: "won" }))).toBe("won");
  });

  it("reads the traffic source from UTM tags first, then the referrer", () => {
    expect(leadSource(lead({ fields: { "UTM Source": "instagram", "UTM Medium": "social", "UTM Campaign": "nov-reels" } }))).toMatchObject({ channel: "social", source: "Instagram", campaign: "nov-reels" });
    expect(leadSource(lead({ fields: { "UTM Source": "google", "UTM Medium": "cpc" } })).channel).toBe("paid");
    expect(leadSource(lead({ referrer: "https://www.google.com/" })).channel).toBe("organic");
    expect(leadSource(lead()).channel).toBe("unknown");
  });

  it("fills missing form fields from the table columns", () => {
    const f = leadFields(lead({ fields: { "First Name": "Asha" } }));
    expect(f.Email).toBe("asha@example.com");
    expect(f["Form Page"]).toBe("Home");
    expect(f.Name).toBeUndefined(); // First Name present → no duplicate Name
  });

  it("neutralises spreadsheet formulas in the CSV export", () => {
    const csv = leadsCsv([lead({ name: "=HYPERLINK(\"http://x\")", message: "+cmd|calc", phone: "+91 98765 43210" })]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csv).toContain("'+cmd|calc");
    expect(csv).toContain(",+91 98765 43210,"); // real phone numbers stay untouched
  });

  it("only treats http(s) values as links", () => {
    expect(isHttpUrl("https://editsimple.in/x")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("https://a.com <script>")).toBe(false);
  });
});

describe("website posts & schedule", () => {
  it("escapes preview text and makes clean slugs", () => {
    expect(escapeHtml(`<img src=x onerror="a">`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;");
    expect(slugify("  How Doctors Use Reels — 2026! ")).toBe("how-doctors-use-reels-2026");
  });

  it("computes the next weekly run in India time, or null when paused", () => {
    expect(nextRun({ schedule_enabled: "false" })).toBeNull();
    const d = nextRun({ schedule_enabled: "true", schedule_day: "1", schedule_hour: "10" })!;
    const ist = new Date(d.getTime() + 5.5 * 3600e3);
    expect(ist.getUTCDay()).toBe(1);
    expect(ist.getUTCHours()).toBe(10);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });
});
