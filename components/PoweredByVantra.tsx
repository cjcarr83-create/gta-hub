import { VANTRA_STUDIOS_URL } from "@/lib/vantra";

// Per BRAND_ARCHITECTURE.md: "Vantra Studios attribution is small and
// secondary" inside the GTAHUB app itself — this deliberately renders
// as a quiet text link, not a logo lockup or branded banner. Intended
// for footer/About/launch-surface placement only; do not drop this into
// feed, video, or live screens (also spec'd explicitly: "do not place
// large Vantra branding over feed/video/live screens").
export default function PoweredByVantra({
  className = "",
}: {
  className?: string;
}) {
  return (
    <a
      href={VANTRA_STUDIOS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs text-frost-muted hover:text-frost transition-colors ${className}`}
    >
      Powered by Vantra Studios
    </a>
  );
}
