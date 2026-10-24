"use client";
import { useEffect, useState } from "react";
import type { Niche } from "@/lib/niches";

const KEY = "es-niche";
const EVT = "es-niche-change";

function read(): Niche {
  try {
    return localStorage.getItem(KEY) === "legal" ? "legal" : "medical";
  } catch {
    return "medical";
  }
}

/** The workspace niche (doctors / lawyers). Remembered per browser; recolours the app. */
export function useNiche(): [Niche, (n: Niche) => void] {
  const [niche, setState] = useState<Niche>("medical");
  useEffect(() => {
    setState(read());
    const on = () => setState(read());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const set = (n: Niche) => {
    try {
      localStorage.setItem(KEY, n);
    } catch {
      /* private mode */
    }
    setState(n);
    window.dispatchEvent(new Event(EVT));
  };
  return [niche, set];
}
