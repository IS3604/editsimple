/** Icon set the writer can pick per slide (24px stroke paths, render identically in exports). */
export const SLIDE_ICONS = {
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  droplet: "M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  shield: "M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  calendar: "M4 6h16v15H4zM4 10h16M9 3v4M15 3v4",
  alert: "M12 3l10 18H2zM12 10v5M12 18v.5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
  question: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  smile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.5M15 9.5v.5",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  leaf: "M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  scale: "M12 3v18M7 21h10M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6",
  money: "M3 6h18v12H3zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v.5M18 14.5v.5",
  chat: "M4 5h16v11H9l-5 4z",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  zap: "M13 2L4 14h7l-1 8 9-12h-7z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  compare: "M8 3v18M16 3v18M3 8h5M16 16h5M3 16l2.5-2.5M21 8l-2.5 2.5",
  check: "M5 12.5l4.2 4.2L19 7",
} as const;

export type SlideIcon = keyof typeof SLIDE_ICONS;
export const SLIDE_ICON_KEYS = Object.keys(SLIDE_ICONS) as SlideIcon[];

/** A sensible icon when the writer didn't pick one. */
export function defaultIcon(kind: string | undefined, text = ""): SlideIcon {
  const t = text.toLowerCase();
  if (/sun|spf|uv/.test(t)) return "sun";
  if (/cost|price|\$|fee|pay/.test(t)) return "money";
  if (/time|long|last|week|day|recover|downtime/.test(t)) return "clock";
  if (/risk|side effect|warning|avoid|mistake/.test(t)) return "alert";
  if (/safe|protect|barrier/.test(t)) return "shield";
  if (/skin|hydrat|moistur|serum/.test(t)) return "droplet";
  if (/vs|versus|differen|compare/.test(t)) return "compare";
  if (/what is|what's|means/.test(t)) return "info";
  if (kind === "myth_fact") return "question";
  if (kind === "steps") return "target";
  if (kind === "checklist") return "check";
  if (kind === "highlight") return "star";
  if (kind === "cta") return "heart";
  return "bulb";
}
