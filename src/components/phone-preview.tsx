"use client";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { ScaledSlide, SlideCanvas, type CanvasSlide, type SlideSize } from "@/components/slide-canvas";
import type { Design } from "@/lib/types";
import { assetUrlClient } from "@/lib/asset-url";

/** An Instagram-style phone frame around a live slide. The hero of the create flow. */
export function PhonePreview({
  slide,
  design,
  size,
  total,
  index = 0,
  width = 300,
  disclaimer,
}: {
  slide: CanvasSlide;
  design: Design;
  size: SlideSize;
  total: number;
  index?: number;
  width?: number;
  disclaimer?: string;
}) {
  const inner = width - 24;
  const name = design.handle?.replace(/^@/, "") || design.name || "yourpractice";
  return (
    <div className="phone mx-auto" style={{ width }}>
      <div className="phone-screen">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
            <span className="h-full w-full rounded-full bg-white" />
          </span>
          <span className="truncate text-[12px] font-semibold text-neutral-900">{name}</span>
        </div>
        <div>
          <ScaledSlide width={inner} size={size}>
            <SlideCanvas slide={slide} design={design} size={size} index={index} total={total} bgUrl={assetUrlClient(slide.background_path)} logoUrl={assetUrlClient(design.logoPath)} disclaimer={disclaimer} />
          </ScaledSlide>
        </div>
        <div className="flex items-center gap-3.5 px-3 pb-1 pt-2.5 text-neutral-900">
          <Heart className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <Send className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <div className="mx-auto flex gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={i === index ? "h-1.5 w-1.5 rounded-full bg-sky-500" : "h-1.5 w-1.5 rounded-full bg-neutral-300"} />
            ))}
          </div>
          <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </div>
        <div className="px-3 pb-4 pt-1">
          <div className="h-2 w-3/4 rounded-full bg-neutral-100" />
          <div className="mt-1.5 h-2 w-1/2 rounded-full bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}
