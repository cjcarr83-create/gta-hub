"use client";

import { TURF_ZONES } from "@/lib/world/map";

export default function TurfStatus({
  turfOwners,
}: {
  turfOwners: Map<string, { crewId: string; crewName: string | null; color: string | null }>;
}) {
  return (
    <div className="card mt-4">
      <h2 className="mb-2 text-sm uppercase tracking-wide text-frost-muted">Turf</h2>
      <div className="space-y-1 text-sm">
        {TURF_ZONES.map((z) => {
          const owner = turfOwners.get(z.id);
          return (
            <div key={z.id} className="flex items-center justify-between">
              <span>{z.name}</span>
              {owner ? (
                <span style={{ color: owner.color ?? undefined }}>{owner.crewName ?? "Unclaimed crew"}</span>
              ) : (
                <span className="text-frost-muted">Unclaimed</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-frost-muted">
        Stand in a zone with your crew uncontested for 20s to capture it.
      </p>
    </div>
  );
}
