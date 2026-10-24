"use client";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { Design, Slide, SlideItem } from "@/lib/types";
import { FONTS, FONT_VARS, TEMPLATES, isDark } from "@/lib/themes";
import { assetUrlClient } from "@/lib/asset-url";

export type SlideSize = "1080x1350" | "1080x1080";
export const dims = (size: SlideSize) => {
  const [w, h] = size.split("x").map(Number);
  return { w, h };
};

export type CanvasSlide = Pick<Slide, "id" | "kicker" | "heading" | "body" | "layout" | "style" | "background_path" | "role"> & {
  kind?: Slide["kind"];
  items?: SlideItem[];
};

type Props = {
  slide: CanvasSlide;
  design: Design;
  size: SlideSize;
  index: number;
  total: number;
  bgUrl: string | null;
  logoUrl: string | null;
  disclaimer?: string;
  onFit?: (info: { id: string; scale: number; overflow: boolean }) => void;
};

const PAD = 96;
const MIN_FIT = 0.6;

/* ---------- tiny inline icons (render identically in exports) ---------- */
const Icon = ({ d, size = 34, color, stroke = 3.2 }: { d: string; size?: number; color: string; stroke?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
);
const I = {
  check: "M5 12.5l4.2 4.2L19 7",
  cross: "M6 6l12 12M18 6L6 18",
  save: "M6 3h12v18l-6-4.5L6 21z",
  send: "M21 3L10 14M21 3l-7 18-4-7-7-4z",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/**
 * One slide at native pixel size. Every glyph is DOM/CSS/SVG, and the same node is rasterised for export,
 * so downloads match the preview. Text auto-fits: sizes step down until the content box stops overflowing.
 */
export const SlideCanvas = forwardRef<HTMLDivElement, Props>(function SlideCanvas(
  { slide, design, size, index, total, bgUrl, logoUrl, disclaimer, onFit },
  ref
) {
  const { w, h } = dims(size);
  const P = PAD + (design.bgPath ? design.safeInset ?? 40 : 0);
  const brandBg = design.bgPath?.startsWith("blob:") ? design.bgPath : assetUrlClient(design.bgPath ?? null);
  const tpl = TEMPLATES[design.template] ?? TEMPLATES.studio;
  const look = tpl.look;
  const kind = slide.kind ?? (index === 0 ? "hook" : index === total - 1 ? "cta" : "statement");
  const items = slide.items ?? [];

  const bg = slide.style?.background ?? design.colors.background;
  const ink = slide.style?.text ?? design.colors.text;
  const accent = slide.style?.accent ?? design.colors.accent;
  const surface = design.colors.surface;
  const onAccent = isDark(accent) ? "#FFFFFF" : "#0F1115";
  const muted = alpha(ink, 0.68);
  const hair = alpha(ink, 0.16);
  const headMeta = FONTS[design.fontHeading] ?? FONTS.geist;
  const bodyMeta = FONTS[design.fontBody] ?? FONTS.geist;
  const headFont = FONT_VARS[design.fontHeading];
  const bodyFont = bodyMeta.headingOnly ? FONT_VARS.geist : FONT_VARS[design.fontBody];
  const headWeight = headMeta.fixedWeight ?? look.headingWeight;
  const headTracking = headMeta.tracking ?? look.tracking;
  const scale = slide.style?.headingScale ?? 1;

  const hasImg = !!bgUrl;
  const fullBleed = hasImg && (kind === "hook" || slide.layout === "center");
  const split = hasImg && !fullBleed && slide.layout === "split";
  const framed = hasImg && !fullBleed && !split;
  const highlightField = kind === "highlight" && !hasImg;
  const fieldBg = highlightField ? accent : bg;
  const fieldInk = highlightField ? onAccent : fullBleed ? "#FFFFFF" : ink;
  const fieldMuted = highlightField ? alpha(onAccent, 0.8) : fullBleed ? "rgba(255,255,255,.82)" : muted;

  // ---------- auto-fit ----------
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const sig = JSON.stringify([slide.heading, slide.body, slide.kicker, items, kind, slide.layout, scale, size, design.fontHeading, design.fontBody, design.template, hasImg]);
  useLayoutEffect(() => setFit(1), [sig]);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const over = el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    if (over && fit > MIN_FIT) setFit((f) => Math.round((f - 0.04) * 100) / 100);
    else onFit?.({ id: slide.id, scale: fit, overflow: over });
  }, [fit, sig, slide.id, onFit]);

  const len = slide.heading.length;
  const headSize = (() => {
    let base: number;
    if (kind === "hook") base = len <= 24 ? 136 : len <= 44 ? 116 : len <= 64 ? 98 : 86;
    else if (kind === "highlight") base = len <= 40 ? 104 : len <= 80 ? 86 : 72;
    else if (kind === "statement" || kind === "cta") base = len <= 30 ? 100 : len <= 60 ? 82 : 70;
    else base = len <= 36 ? 84 : len <= 60 ? 72 : 64;
    if (split) base *= 0.82;
    if (size === "1080x1080") base *= 0.9;
    return base * scale * fit * (headMeta.scale ?? 1);
  })();
  const bodySize = 38 * fit;
  const itemTitle = 40 * fit;
  const itemText = 32 * fit;
  const gap = 30 * fit;

  // ---------- pieces ----------
  const kicker = slide.kicker ? (
    <div
      style={{
        alignSelf: kind === "highlight" ? "center" : "flex-start",
        fontFamily: bodyFont,
        fontSize: 26 * fit,
        fontWeight: 600,
        letterSpacing: "0.01em",
        color: fullBleed || highlightField ? fieldInk : accent,
        background: fullBleed ? alpha(accent, 0.95) : "transparent",
        ...(fullBleed ? { color: onAccent, padding: `${10 * fit}px ${22 * fit}px`, borderRadius: 999 } : {}),
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {!fullBleed && !highlightField && <span style={{ width: 28, height: 4, borderRadius: 4, background: accent, display: "inline-block" }} />}
      {slide.kicker}
    </div>
  ) : null;

  const heading = (
    <div
      style={{
        fontFamily: headFont,
        fontSize: headSize,
        lineHeight: headMeta.lineHeight ?? 0.98,
        fontWeight: headWeight,
        letterSpacing: headTracking,
        color: fieldInk,
        textWrap: "balance" as never,
        overflowWrap: "break-word",
        textAlign: kind === "highlight" ? "center" : "left",
      }}
    >
      {slide.heading}
    </div>
  );

  const body = slide.body ? (
    <div
      style={{
        fontFamily: bodyFont,
        fontSize: bodySize,
        lineHeight: 1.4,
        color: fieldMuted,
        maxWidth: 860,
        whiteSpace: "pre-line",
        textAlign: kind === "highlight" ? "center" : "left",
        alignSelf: kind === "highlight" ? "center" : undefined,
      }}
    >
      {slide.body}
    </div>
  ) : null;

  const cardBase = (emph = false): React.CSSProperties => {
    const r = look.radius * Math.max(fit, 0.8);
    switch (look.cards) {
      case "filled":
        return { background: emph ? alpha(accent, 0.12) : surface, borderRadius: r, padding: `${26 * fit}px ${30 * fit}px` };
      case "glass":
        return { background: "rgba(255,255,255,.62)", border: "2px solid rgba(255,255,255,.85)", borderRadius: r, padding: `${26 * fit}px ${30 * fit}px`, boxShadow: `0 20px 50px -30px ${alpha(ink, 0.35)}` };
      case "outline":
        return { border: `2px solid ${emph ? accent : alpha(ink, 0.22)}`, borderRadius: r, padding: `${24 * fit}px ${28 * fit}px` };
      case "rule":
      default:
        return { borderTop: `2px solid ${emph ? accent : hair}`, padding: `${22 * fit}px 0 0` };
    }
  };

  const ItemText = ({ it, titleColor = ink }: { it: SlideItem; titleColor?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 * fit, minWidth: 0 }}>
      {it.title && <div style={{ fontFamily: bodyFont, fontWeight: 650, fontSize: itemTitle, lineHeight: 1.2, color: titleColor, letterSpacing: "-0.01em" }}>{it.title}</div>}
      {it.text && <div style={{ fontFamily: bodyFont, fontSize: itemText, lineHeight: 1.38, color: muted, whiteSpace: "pre-line" }}>{it.text}</div>}
    </div>
  );

  const marker = (n: number | null, icon?: string, tone: "accent" | "muted" = "accent") => (
    <div
      style={{
        width: 58 * fit,
        height: 58 * fit,
        flexShrink: 0,
        borderRadius: look.cards === "rule" ? 4 : 999,
        display: "grid",
        placeItems: "center",
        background: tone === "accent" ? accent : alpha(ink, 0.1),
        color: tone === "accent" ? onAccent : ink,
        fontFamily: headFont,
        fontWeight: 700,
        fontSize: 28 * fit,
      }}
    >
      {icon ? <Icon d={icon} size={30 * fit} color={tone === "accent" ? onAccent : ink} /> : n}
    </div>
  );

  const content = (() => {
    switch (kind) {
      case "list":
        return (
          <>
            {kicker}
            {heading}
            {body}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 * fit, marginTop: 12 * fit }}>
              {items.map((it, i) => (
                <div key={i} style={{ ...cardBase(), display: "flex", gap: 24 * fit, alignItems: "flex-start" }}>
                  <span style={{ width: 14 * fit, height: 14 * fit, borderRadius: 99, background: accent, marginTop: 14 * fit, flexShrink: 0 }} />
                  <ItemText it={it} />
                </div>
              ))}
            </div>
          </>
        );
      case "steps":
        return (
          <>
            {kicker}
            {heading}
            {body}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 * fit, marginTop: 8 * fit }}>
              {items.map((it, i) => (
                <div key={i} style={{ ...cardBase(), display: "flex", gap: 26 * fit, alignItems: "center" }}>
                  {marker(i + 1)}
                  <ItemText it={it} />
                </div>
              ))}
            </div>
          </>
        );
      case "checklist":
        return (
          <>
            {kicker}
            {heading}
            {body}
            <div style={{ display: "grid", gridTemplateColumns: items.length > 4 ? "1fr 1fr" : "1fr", gap: 16 * fit, marginTop: 8 * fit }}>
              {items.map((it, i) => (
                <div key={i} style={{ ...cardBase(), display: "flex", gap: 20 * fit, alignItems: "flex-start" }}>
                  {marker(null, I.check)}
                  <ItemText it={it} />
                </div>
              ))}
            </div>
          </>
        );
      case "myth_fact": {
        const [myth, fact] = [items[0] ?? { title: "Myth", text: "" }, items[1] ?? { title: "Fact", text: "" }];
        return (
          <>
            {kicker}
            {heading}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 * fit, marginTop: 8 * fit }}>
              <div style={{ ...cardBase(), display: "flex", gap: 22 * fit, alignItems: "flex-start", opacity: 0.9 }}>
                {marker(null, I.cross, "muted")}
                <ItemText it={{ title: myth.title || "Myth", text: myth.text }} titleColor={muted} />
              </div>
              <div style={{ ...cardBase(true), display: "flex", gap: 22 * fit, alignItems: "flex-start" }}>
                {marker(null, I.check)}
                <ItemText it={{ title: fact.title || "Fact", text: fact.text }} titleColor={accent} />
              </div>
            </div>
          </>
        );
      }
      case "comparison": {
        const cols = items.slice(0, 2);
        const neg = (t: string) => /don'?t|avoid|wrong|myth|before|never|not/i.test(t);
        return (
          <>
            {kicker}
            {heading}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 * fit, marginTop: 8 * fit, alignItems: "stretch" }}>
              {cols.map((c, i) => {
                const bad = neg(c.title);
                return (
                  <div key={i} style={{ ...cardBase(!bad), display: "flex", flexDirection: "column", gap: 18 * fit }}>
                    <div style={{ fontFamily: headFont, fontWeight: headWeight, fontSize: 40 * fit * (headMeta.scale ?? 1), color: bad ? muted : accent, letterSpacing: headTracking }}>{c.title}</div>
                    {c.text.split("\n").filter(Boolean).map((line, j) => (
                      <div key={j} style={{ display: "flex", gap: 14 * fit, alignItems: "flex-start", fontFamily: bodyFont, fontSize: itemText, lineHeight: 1.35, color: ink }}>
                        <Icon d={bad ? I.cross : I.check} size={30 * fit} color={bad ? muted : accent} />
                        <span>{line.replace(/^[-•\s]+/, "")}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        );
      }
      case "cta":
        return (
          <>
            {kicker}
            {heading}
            {body}
            <div style={{ display: "flex", gap: 16 * fit, flexWrap: "wrap", marginTop: 14 * fit }}>
              {[
                [I.save, "Save"],
                [I.send, "Share"],
                [I.plus, design.handle ? `Follow ${design.handle}` : "Follow"],
              ].map(([icon, label], i) => (
                <div
                  key={label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 14,
                    padding: `${18 * fit}px ${30 * fit}px`,
                    borderRadius: 999,
                    fontFamily: bodyFont,
                    fontWeight: 650,
                    fontSize: 30 * fit,
                    background: i === 2 ? accent : "transparent",
                    color: i === 2 ? onAccent : ink,
                    border: i === 2 ? `2px solid ${accent}` : `2px solid ${alpha(ink, 0.25)}`,
                  }}
                >
                  <Icon d={icon} size={28 * fit} color={i === 2 ? onAccent : ink} />
                  {label}
                </div>
              ))}
            </div>
          </>
        );
      default:
        // hook, statement, highlight
        return (
          <>
            {kicker}
            {heading}
            {body}
          </>
        );
    }
  })();

  // ---------- background treatments ----------
  const backdrop = (() => {
    if (brandBg) return null; // imported branded background replaces template decoration
    if (highlightField) return null;
    if (look.bg === "mesh")
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(60% 50% at 85% 10%, ${alpha(accent, 0.38)} 0%, transparent 70%), radial-gradient(55% 45% at 0% 100%, ${alpha("#FF8FB1", 0.35)} 0%, transparent 70%), radial-gradient(40% 40% at 30% 30%, ${alpha("#7FE3FF", 0.3)} 0%, transparent 70%)`,
          }}
        />
      );
    if (look.bg === "glow")
      return <div style={{ position: "absolute", width: 900, height: 900, right: -380, top: -420, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(accent, 0.38)} 0%, transparent 65%)` }} />;
    if (kind === "hook" && !hasImg) {
      // typographic cover detail, specific to each template
      if (design.template === "counsel" || design.template === "editorial")
        return <div style={{ position: "absolute", left: P, right: P, top: h * 0.28, height: 3, background: accent }} />;
      if (design.template === "clinic")
        return <div style={{ position: "absolute", width: 760, height: 760, right: -300, bottom: -260, borderRadius: "46% 54% 42% 58%", background: alpha(accent, 0.12) }} />;
      if (design.template === "bold") return <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 24, background: accent }} />;
      return <div style={{ position: "absolute", width: 560, height: 560, right: -200, bottom: -200, borderRadius: "50%", background: accent }} />;
    }
    return null;
  })();

  const focus = `50% ${slide.style?.focusY ?? 45}%`;
  const img = (style: React.CSSProperties) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={bgUrl!} alt="" crossOrigin="anonymous" style={{ objectFit: "cover", objectPosition: focus, display: "block", ...style }} />;

  const headerInk = fullBleed ? "#FFFFFF" : highlightField ? onAccent : ink;
  const logoTop = logoUrl && design.logoPosition.startsWith("top");
  const logoBottom = logoUrl && design.logoPosition.startsWith("bottom");
  const logoEl = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl!} alt="" style={{ height: design.logoSize * 0.7, maxWidth: design.logoSize * 2.6, objectFit: "contain", display: "block" }} />
  );
  const identity = design.name || design.handle;

  const contentAlign: React.CSSProperties =
    kind === "highlight"
      ? { justifyContent: "center", alignItems: "center" }
      : fullBleed
      ? { justifyContent: "flex-end" }
      : { justifyContent: framed ? "flex-start" : "center" };

  return (
    <div
      ref={ref}
      data-slide-id={slide.id}
      style={{ width: w, height: h, position: "relative", overflow: "hidden", background: fieldBg, color: fieldInk, fontFamily: bodyFont }}
    >
      {brandBg && !highlightField && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brandBg} alt="" crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      {backdrop}

      {fullBleed && (
        <>
          {img({ position: "absolute", inset: 0, width: "100%", height: "100%" })}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, rgba(0,0,0,${0.15 * (slide.style?.overlay ?? 1)}) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,${Math.min(0.92, 0.82 * (slide.style?.overlay ?? 1))}) 88%)`,
            }}
          />
        </>
      )}

      {split && <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "44%" }}>{img({ width: "100%", height: "100%" })}</div>}

      {/* header */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: P,
          right: split ? "calc(44% + 40px)" : P,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexDirection: design.logoPosition === "top-right" ? "row-reverse" : "row",
          zIndex: 4,
          fontFamily: bodyFont,
          fontSize: 26,
          color: headerInk,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, minHeight: 40 }}>
          {logoTop ? logoEl : identity ? <span style={{ fontWeight: 650, opacity: 0.9 }}>{identity}</span> : null}
        </div>
        <span style={{ fontWeight: 600, opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
          {index + 1}/{total}
        </span>
      </div>

      {/* content */}
      <div
        style={{
          position: "absolute",
          top: 150,
          bottom: 150,
          left: P,
          right: split ? "calc(44% + 48px)" : P,
          display: "flex",
          flexDirection: framed && slide.layout === "bottom" ? "column-reverse" : "column",
          gap: 44 * fit,
          zIndex: 3,
        }}
      >
        <div ref={box} style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap, ...contentAlign }}>
          {content}
        </div>
        {framed && (
          <div style={{ height: Math.round(h * (size === "1080x1080" ? 0.36 : 0.4)), flexShrink: 0, borderRadius: Math.max(look.radius, 8), overflow: "hidden" }}>
            {img({ width: "100%", height: "100%" })}
          </div>
        )}
      </div>

      {/* footer */}
      <div
        style={{
          position: "absolute",
          left: P,
          right: split ? "calc(44% + 40px)" : P,
          bottom: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          zIndex: 4,
          fontFamily: bodyFont,
          fontSize: 24,
          color: headerInk,
        }}
      >
        {kind === "cta" && disclaimer ? (
          <span style={{ opacity: 0.6, fontSize: 22, maxWidth: 700, lineHeight: 1.3 }}>{disclaimer}</span>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} style={{ width: i === index ? 40 : 10, height: 10, borderRadius: 10, background: i === index ? (highlightField ? onAccent : accent) : headerInk, opacity: i === index ? 1 : 0.22 }} />
            ))}
          </div>
        )}
        {logoBottom ? logoEl : index < total - 1 ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 600, opacity: 0.75 }}>
            {index === 0 ? "Swipe" : ""}
            <Icon d={I.arrow} size={30} color={headerInk} stroke={2.6} />
          </span>
        ) : null}
      </div>
    </div>
  );
});

/** Scales a native-size slide down to a display width. */
export function ScaledSlide({ width, size, children }: { width: number; size: SlideSize; children: React.ReactNode }) {
  const { w, h } = dims(size);
  const s = width / w;
  return (
    <div style={{ width, height: h * s, position: "relative", overflow: "hidden" }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: "top left", width: w, height: h }}>{children}</div>
    </div>
  );
}
