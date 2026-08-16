import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "@/styles/globals.css";

// Display face: condensed, bold, stencil-adjacent — evokes highway
// signage and licence plates rather than a generic gaming-app font.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "GTAHUB — clips, crews, live",
  description:
    "A fan-made community platform for GTA clips, crews, live streams and builds. Unofficial, not affiliated with Rockstar Games or Take-Two Interactive.",
  // Per BRAND_ARCHITECTURE.md Part B item 4 — identifies Vantra Studios
  // as the company behind the product in page metadata, without making
  // Vantra the visible/dominant brand inside the app itself.
  creator: "Vantra Studios",
  publisher: "Vantra Studios",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${oswald.variable} ${inter.variable}`}>
      <body>
        <div className="mx-auto max-w-lg pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
