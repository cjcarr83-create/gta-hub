import type { Metadata } from "next";
import Link from "next/link";
import PoweredByVantra from "@/components/PoweredByVantra";
import { VANTRA_STUDIOS_URL } from "@/lib/vantra";

export const metadata: Metadata = {
  title: "About — GTAHUB",
  description:
    "GTAHUB is a fan-made gaming community platform for clips, live streams, crews, and creators — powered by Vantra Studios.",
  openGraph: {
    title: "About GTAHUB",
    description: "A gaming community platform powered by Vantra Studios.",
  },
};

export default function AboutPage() {
  return (
    <main className="px-4 pt-6">
      <h1 className="mb-6 text-2xl">About GTAHUB</h1>

      <div className="card mb-4 space-y-3">
        <p className="text-sm text-sand-muted">
          GTAHUB is a gaming community platform — clips, live streams,
          crews, profiles, and discovery, built around watching, sharing,
          connecting, and going live.
        </p>
        <p className="text-sm text-sand-muted">
          GTAHUB is an independent, fan-made platform. It is not affiliated
          with, endorsed by, or sponsored by Rockstar Games or Take-Two
          Interactive.
        </p>
      </div>

      <div className="card mb-4">
        <h2 className="mb-2 text-sm uppercase tracking-wide text-sand-muted">
          Built by
        </h2>
        <p className="mb-3 text-sm">
          GTAHUB is created and powered by{" "}
          <a
            href={VANTRA_STUDIOS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sunset-amber hover:underline"
          >
            Vantra Studios
          </a>
          , a technology and creative studio.
        </p>
        <PoweredByVantra />
      </div>

      <Link href="/" className="text-sm text-sand-muted hover:text-sand">
        ← Back to GTAHUB
      </Link>
    </main>
  );
}
