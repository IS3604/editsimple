import type { Metadata } from "next";
// Self-hosted fonts (bundled, same-origin) so slide exports embed them reliably.
import "@fontsource-variable/geist";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/fraunces";
import "@fontsource/instrument-serif/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EditSimple — carousels for doctors & lawyers",
  description: "Research what's trending, write accurate carousels and export them in minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
