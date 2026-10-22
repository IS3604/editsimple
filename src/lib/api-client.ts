"use client";

/** Small fetch wrapper for the app's own API routes; throws readable errors. */
export async function api<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}
