/** Same-site relative path only (prevents open redirects through ?next=). Client-safe. */
export function safeNext(v: string | null | undefined, fallback = "/dashboard") {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

/** Where invite and password-reset emails land: a page that signs the person in and lets them set a password. */
export const SET_PASSWORD_PATH = "/auth/set-password";
