import type { ContentCategory } from "@/lib/database.types";

const LABELS: Record<ContentCategory, string> = {
  stunts: "Stunts",
  heists: "Heists",
  rp: "RP",
  chaos: "Chaos",
  races: "Races",
  builds: "Builds",
  guides: "Guides",
};

export default function CategoryBadge({
  category,
}: {
  category: ContentCategory;
}) {
  return (
    <span
      className="inline-block rounded-sm border border-asphalt-line bg-asphalt-panel
                 px-2 py-0.5 text-[11px] font-display uppercase tracking-wide text-sand-muted"
    >
      {LABELS[category]}
    </span>
  );
}
