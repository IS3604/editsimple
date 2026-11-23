"use client";
import { useEffect } from "react";
import { SET_PASSWORD_PATH } from "@/lib/auth-paths";

/**
 * Supabase email links (e.g. "Invite user" from the Supabase dashboard) can land on any page —
 * usually the Site URL — with the sign-in tokens in the #hash. Send them to the page that
 * finishes sign-in and asks for a password.
 */
export function AuthLinkForwarder() {
  useEffect(() => {
    const h = location.hash;
    if (location.pathname === SET_PASSWORD_PATH || !h) return;
    if (/[#&](access_token|error_description)=/.test(h)) location.replace(SET_PASSWORD_PATH + h);
  }, []);
  return null;
}
