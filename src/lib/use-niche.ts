"use client";
import { useEffect, useState } from "react";
import { audienceTypeOf, type AudienceType, type Niche } from "@/lib/niches";
import { marketOf, type MarketCode } from "@/lib/markets";

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

const MKEY = "es-market";
const MEVT = "es-market-change";

/** Workspace market (where the client's audience is). Remembered per browser. */
export function useMarket(): [MarketCode, (m: MarketCode) => void] {
  const [market, setState] = useState<MarketCode>("US");
  useEffect(() => {
    const read = () => {
      try {
        return marketOf(localStorage.getItem(MKEY));
      } catch {
        return "US" as MarketCode;
      }
    };
    setState(read());
    const on = () => setState(read());
    window.addEventListener(MEVT, on);
    return () => window.removeEventListener(MEVT, on);
  }, []);
  const set = (m: MarketCode) => {
    try {
      localStorage.setItem(MKEY, m);
    } catch {
      /* private mode */
    }
    setState(m);
    window.dispatchEvent(new Event(MEVT));
  };
  return [market, set];
}

const AKEY = "es-audience";
const AEVT = "es-audience-change";

/** Who posts are for: the client's patients/clients ("public") or the professionals themselves ("pros"). Remembered per browser. */
export function useAudienceType(): [AudienceType, (a: AudienceType) => void] {
  const [type, setState] = useState<AudienceType>("public");
  useEffect(() => {
    const read = () => {
      try {
        return audienceTypeOf(localStorage.getItem(AKEY));
      } catch {
        return "public" as AudienceType;
      }
    };
    setState(read());
    const on = () => setState(read());
    window.addEventListener(AEVT, on);
    return () => window.removeEventListener(AEVT, on);
  }, []);
  const set = (a: AudienceType) => {
    try {
      localStorage.setItem(AKEY, a);
    } catch {
      /* private mode */
    }
    setState(a);
    window.dispatchEvent(new Event(AEVT));
  };
  return [type, set];
}
