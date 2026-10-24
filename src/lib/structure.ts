import type { SlideKind } from "@/lib/types";

/** Guarantees the opening/closing slide types for the chosen length (1 = single image, 2 = hook + payoff). */
export function enforceStructure<T extends { kind: SlideKind }>(slides: T[]): T[] {
  if (slides.length === 1) {
    if (slides[0].kind === "hook" || slides[0].kind === "cta") slides[0].kind = "statement";
    return slides;
  }
  slides[0].kind = "hook";
  if (slides.length >= 3) slides[slides.length - 1].kind = "cta";
  else if (slides[1].kind === "hook" || slides[1].kind === "cta") slides[1].kind = "statement";
  return slides;
}
