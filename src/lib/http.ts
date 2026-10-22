import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch with a hard timeout. */
export async function fetchT(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

export function handle<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 400 });
      const msg = e instanceof Error ? e.message : "Unexpected error";
      console.error("[api]", e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
