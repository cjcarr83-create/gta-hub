import { createClient } from "@/lib/supabase/server";

// Server component — a simple aggregate read, no need for a client
// round trip. Refreshes on page load, which is fine for a for-fun
// leaderboard (see the trust-model note in lib/world/combat.ts for why
// "for fun" is the right expectation to set, not "verified results").
export default async function WorldLeaderboard() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("world_ko_log")
    .select("attacker_id, profiles!world_ko_log_attacker_id_fkey(username)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!rows || rows.length === 0) return null;

  const counts = new Map<string, { username: string; kos: number }>();
  for (const row of rows as unknown as Array<{
    attacker_id: string;
    profiles: { username: string } | null;
  }>) {
    const username = row.profiles?.username ?? "unknown";
    const existing = counts.get(row.attacker_id);
    if (existing) {
      existing.kos += 1;
    } else {
      counts.set(row.attacker_id, { username, kos: 1 });
    }
  }

  const top = Array.from(counts.values())
    .sort((a, b) => b.kos - a.kos)
    .slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div className="card mt-4">
      <h2 className="mb-2 text-sm uppercase tracking-wide text-sand-muted">
        Recent top scrappers
      </h2>
      <div className="space-y-1 text-sm">
        {top.map((row, i) => (
          <div key={row.username} className="flex items-center justify-between">
            <span>
              <span className="text-sand-muted">#{i + 1}</span> @{row.username}
            </span>
            <span className="text-sunset-amber">{row.kos} KO{row.kos === 1 ? "" : "s"}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-sand-muted">
        Based on the last 200 fights — for bragging rights, not an
        audited ranking.
      </p>
    </div>
  );
}
