import type { Metadata } from "next";
import { Oswald, Inter, Permanent_Marker } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import "@/styles/globals.css";

// Display face: condensed, bold — headers and nav labels.
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

// Brush-marker script — reserved for the "HUB" half of the brand
// wordmark only (see components/Logo.tsx). Not a general display face;
// mixing it into body headers would fight with `display` everywhere
// else, so it's scoped to the literal logotype.
const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
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
    <html lang="en" className={`${oswald.variable} ${inter.variable} ${permanentMarker.variable}`}>
      <body>
        <div className="mx-auto max-w-lg pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
