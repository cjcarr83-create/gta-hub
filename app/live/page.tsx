import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CategoryBadge from "@/components/CategoryBadge";
import type { Stream } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const supabase = await createClient();

  const { data: streams } = await supabase
    .from("streams")
    .select("id, user_id, crew_id, title, category, status, viewer_count, mux_playback_id, profiles(username, avatar_url)")
    .eq("status", "live")
    .order("viewer_count", { ascending: false });

  return (
    <main className="px-4 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl">Live now</h1>
        <Link href="/live/start" className="btn-primary text-sm">
          Go Live
        </Link>
      </div>

      {!streams || streams.length === 0 ? (
        <div className="card text-center text-sand-muted">
          Nobody&apos;s live right now. Check back soon.
        </div>
      ) : (
        <div className="space-y-4">
          {(streams as unknown as Stream[]).map((stream) => (
            <Link key={stream.id} href={`/live/${stream.id}`} className="card block">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-sm bg-blood px-2 py-0.5 text-[11px] font-display uppercase text-sand">
                  <span className="h-1.5 w-1.5 rounded-full bg-sand animate-pulse" />
                  Live
                </span>
                <CategoryBadge category={stream.category} />
                <span className="ml-auto text-xs text-sand-muted">
                  {stream.viewer_count.toLocaleString()} watching
                </span>
              </div>
              <h3 className="text-base">{stream.title}</h3>
              <p className="mt-1 text-sm text-sand-muted">
                @{stream.profiles?.username ?? "unknown"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
