import type { Metadata } from "next";
// Self-hosted fonts (bundled, same-origin) so slide exports embed them reliably.
import "./fonts";
import "./globals.css";
import { AuthLinkForwarder } from "@/components/auth-link-forwarder";

export const metadata: Metadata = {
  title: "EditSimple Studio",
  description: "Content studio for aesthetic-practice and law-firm clients.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthLinkForwarder />
        {children}
      </body>
    </html>
  );
}
