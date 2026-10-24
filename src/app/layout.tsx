import type { Metadata } from "next";
// Self-hosted fonts (bundled, same-origin) so slide exports embed them reliably.
import "@fontsource-variable/geist";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/fraunces";
import "./globals.css";

export const metadata: Metadata = {
  title: "EditSimple Studio",
  description: "Content studio for doctor and law-firm clients.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
