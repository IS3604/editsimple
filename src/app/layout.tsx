import type { Metadata } from "next";
// Self-hosted fonts (bundled, same-origin) so slide exports embed them reliably.
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = { title: "EditSimple — Carousel Studio", description: "Research, write and render social carousels." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
