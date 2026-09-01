import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Crew } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function CrewsPage() {
  const supabase = await createClient();

  const { data: crews } = await supabase
    .from("crews")
    .select("id, name, motto, emblem_url, color_hex, recruitment_status")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <main className="px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl">Crews</h1>
        <Link href="/crews/new" className="btn-primary text-sm">
          Start a Crew
        </Link>
      </div>

      {!crews || crews.length === 0 ? (
        <div className="card text-center text-frost-muted">
          No crews yet. Start one and recruit your first members.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {(crews as unknown as Crew[]).map((crew) => (
            <Link key={crew.id} href={`/crews/${crew.id}`} className="card">
              <div
                className="mb-2 h-12 w-12 rounded-full border-2"
                style={{
                  borderColor: crew.color_hex ?? "#F2A93B",
                  background: crew.emblem_url ? `url(${crew.emblem_url}) center/cover` : "#2C2822",
                }}
              />
              <h3 className="text-sm leading-tight">{crew.name}</h3>
              {crew.motto && (
                <p className="mt-1 text-xs text-frost-muted line-clamp-2">{crew.motto}</p>
              )}
              <span
                className={`mt-2 inline-block text-[10px] uppercase tracking-wide ${
                  crew.recruitment_status === "open" ? "text-live-cyan" : "text-frost-muted"
                }`}
              >
                {crew.recruitment_status === "open" ? "Recruiting" : "Closed"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
