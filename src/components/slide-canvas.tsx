"use client";
import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import type { Design, Slide } from "@/lib/types";
import { FONT_VARS, THEME_PRESETS } from "@/lib/themes";

export type SlideSize = "1080x1350" | "1080x1080";
export const dims = (size: SlideSize) => {
  const [w, h] = size.split("x").map(Number);
  return { w, h };
};

type Props = {
  slide: Pick<Slide, "id" | "kicker" | "heading" | "body" | "layout" | "style" | "background_path" | "role">;
  design: Design;
  size: SlideSize;
  index: number;
  total: number;
  bgUrl: string | null;
  logoUrl: string | null;
  onFit?: (info: { id: string; scale: number; overflow: boolean }) => void;
};

const PAD = 88;

/**
 * Renders one slide at its native pixel size. Text, logo and graphics are DOM/CSS —
 * the same node is rasterised for export, so downloads match the preview exactly.
 * Text is auto-fitted: font scale steps down until the copy fits its box (min 0.62).
 */
export const SlideCanvas = forwardRef<HTMLDivElement, Props>(function SlideCanvas(
  { slide, design, size, index, total, bgUrl, logoUrl, onFit },
  ref
) {
  const { w, h } = dims(size);
  const preset = THEME_PRESETS[design.theme];
  const bg = slide.style?.background ?? design.colors.background;
  const ink = slide.style?.text ?? design.colors.text;
  const accent = slide.style?.accent ?? design.colors.accent;
  const overlay = slide.style?.overlay ?? (slide.layout === "center" ? Math.max(0.55, preset.overlay) : preset.overlay);
  const headingScale = slide.style?.headingScale ?? 1;

  const textBox = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  const len = slide.heading.length;
  const baseHeading =
    (len <= 18 ? 112 : len <= 36 ? 96 : len <= 56 ? 80 : 68) * headingScale * (slide.layout === "split" && bgUrl ? 0.82 : 1) * (bgUrl ? 1 : 1.14);
  const baseBody = bgUrl ? 38 : 42;

  // Reset and refit whenever content or geometry changes.
  useLayoutEffect(() => setFit(1), [slide.heading, slide.body, slide.kicker, slide.layout, headingScale, size, design.fontHeading, design.fontBody]);
  useLayoutEffect(() => {
    const el = textBox.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    if (overflowing && fit > 0.62) setFit((f) => Math.round((f - 0.04) * 100) / 100);
    else onFit?.({ id: slide.id, scale: fit, overflow: overflowing });
  }, [fit, slide.id, onFit, slide.heading, slide.body]);

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const hasImg = !!bgUrl;
  const imgArea = slide.layout === "top" || slide.layout === "bottom" ? Math.round(h * (size === "1080x1080" ? 0.4 : 0.42)) : 0;

  const textBlock = (
    <div
      ref={textBox}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: slide.layout === "center" || (!bgUrl && slide.layout !== "bottom") ? "center" : slide.layout === "bottom" ? "flex-end" : "flex-start",
        alignItems: slide.layout === "center" ? "center" : "flex-start",
        textAlign: slide.layout === "center" ? "center" : "left",
        gap: 28 * fit,
      }}
    >
      {slide.kicker && (
        <div style={{ fontFamily: FONT_VARS[design.fontBody], fontSize: 30 * fit, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>
          {slide.kicker}
        </div>
      )}
      <div
        style={{
          fontFamily: FONT_VARS[design.fontHeading],
          fontSize: baseHeading * fit,
          lineHeight: 1.02,
          fontWeight: design.fontHeading === "serif" ? 600 : 800,
          letterSpacing: design.fontHeading === "serif" ? "-0.01em" : "-0.035em",
          color: ink,
          overflowWrap: "break-word",
          textWrap: "balance" as never,
          maxWidth: slide.layout === "center" ? 860 : undefined,
        }}
      >
        {slide.heading}
      </div>
      {slide.body && (
        <div style={{ fontFamily: FONT_VARS[design.fontBody], fontSize: baseBody * fit, lineHeight: 1.38, color: ink, opacity: 0.86, maxWidth: slide.layout === "center" ? 820 : 860, whiteSpace: "pre-line" }}>
          {slide.body}
        </div>
      )}
      {isLast && (
        <div style={{ marginTop: 12 * fit, display: "inline-flex", alignItems: "center", gap: 14, background: accent, color: bg, borderRadius: 999, padding: `${18 * fit}px ${34 * fit}px`, fontFamily: FONT_VARS[design.fontBody], fontWeight: 700, fontSize: 30 * fit }}>
          {design.handle ? `Follow ${design.handle}` : "Save & share"} →
        </div>
      )}
    </div>
  );

  const image = (style: React.CSSProperties) =>
    hasImg ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={bgUrl!} alt="" crossOrigin="anonymous" style={{ objectFit: "cover", display: "block", ...style }} />
    ) : null;

  const logo =
    logoUrl && design.logoPosition !== "none" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        style={{
          position: "absolute",
          zIndex: 5,
          height: design.logoSize,
          maxWidth: design.logoSize * 3,
          objectFit: "contain",
          top: design.logoPosition.startsWith("top") ? 56 : undefined,
          bottom: design.logoPosition.startsWith("bottom") ? 56 : undefined,
          left: design.logoPosition.endsWith("left") ? 56 : undefined,
          right: design.logoPosition.endsWith("right") ? 56 : undefined,
        }}
      />
    ) : null;

  const footerSide = design.logoPosition === "bottom-left" ? "right" : "left";

  return (
    <div
      ref={ref}
      data-slide-id={slide.id}
      style={{ width: w, height: h, position: "relative", overflow: "hidden", background: bg, color: ink, fontFamily: FONT_VARS[design.fontBody] }}
    >
      {/* full-bleed image for center layout */}
      {slide.layout === "center" && hasImg && (
        <>
          {image({ position: "absolute", inset: 0, width: "100%", height: "100%" })}
          <div style={{ position: "absolute", inset: 0, background: bg, opacity: overlay }} />
        </>
      )}

      {/* decorative accents when no image (keeps text-only slides designed) */}
      {!hasImg && (
        <>
          <div style={{ position: "absolute", right: -160, top: -160, width: 520, height: 520, borderRadius: "50%", background: accent, opacity: 0.16 }} />
          {slide.layout !== "bottom" && index !== total - 1 && (
            <div style={{ position: "absolute", left: PAD, bottom: 150, width: 120, height: 10, borderRadius: 10, background: accent }} />
          )}
        </>
      )}

      {/* big slide number watermark on non-cover slides */}
      {!isFirst && !(hasImg && (slide.layout === "bottom" || slide.layout === "split")) && (
        <div style={{ position: "absolute", right: PAD - 10, top: 40, fontFamily: FONT_VARS[design.fontHeading], fontWeight: 800, fontSize: 150, lineHeight: 1, color: accent, opacity: 0.18, zIndex: 1 }}>
          {String(index + 1).padStart(2, "0")}
        </div>
      )}

      {slide.layout === "split" ? (
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ width: hasImg ? "56%" : "100%", display: "flex", flexDirection: "column", padding: `${PAD + 40}px ${PAD - 20}px ${PAD + 90}px ${PAD}px`, position: "relative", zIndex: 2 }}>
            {textBlock}
          </div>
          {hasImg && <div style={{ width: "44%", position: "relative" }}>{image({ position: "absolute", inset: 0, width: "100%", height: "100%" })}</div>}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: slide.layout === "bottom" ? "column-reverse" : "column",
            padding: `${PAD + 40}px ${PAD}px ${PAD + 90}px`,
            gap: 56,
            zIndex: 2,
          }}
        >
          {textBlock}
          {imgArea > 0 && hasImg && (
            <div style={{ height: imgArea, flexShrink: 0, borderRadius: 36, overflow: "hidden" }}>{image({ width: "100%", height: "100%" })}</div>
          )}
        </div>
      )}

      {/* footer: progress + handle + swipe cue */}
      <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 64, display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: footerSide === "right" ? "row-reverse" : "row", zIndex: 4, fontFamily: FONT_VARS[design.fontBody], fontSize: 26, color: ink }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: 0.8 }}>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} style={{ width: i === index ? 34 : 10, height: 10, borderRadius: 10, background: i === index ? accent : ink, opacity: i === index ? 1 : 0.25 }} />
          ))}
          {design.handle && <span style={{ marginLeft: 18, fontWeight: 600 }}>{design.handle}</span>}
        </div>
        {!isLast && !(design.logoPosition === "bottom-right" && logoUrl) && (
          <span style={{ fontWeight: 700, opacity: 0.8 }}>{isFirst ? "Swipe →" : "→"}</span>
        )}
      </div>
      {logo}
    </div>
  );
});

/** Scales a native-size slide down to fit a given display width. */
export function ScaledSlide({ width, size, children }: { width: number; size: SlideSize; children: React.ReactNode }) {
  const { w, h } = dims(size);
  const s = width / w;
  return (
    <div style={{ width, height: h * s, position: "relative", overflow: "hidden" }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: "top left", width: w, height: h }}>{children}</div>
    </div>
  );
}
