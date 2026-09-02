import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import VideoCard from "@/components/VideoCard";
import Logo from "@/components/Logo";
import type { Video } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createClient();

  const { data: videos } = await supabase
    .from("videos")
    .select(
      "id, user_id, crew_id, title, description, category, source, location_tag, thumbnail_url, processing_status, view_count, is_public, moderation_status, created_at, mux_asset_id, mux_upload_id, playback_id, duration_seconds, profiles(username, avatar_url, wanted_level, is_verified)"
    )
    .eq("is_public", true)
    .eq("moderation_status", "visible")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <main className="px-4 pt-6">
      <header className="mb-6">
        <Logo />
        <p className="mt-1 text-sm text-frost-muted">Clips, crews, live — Los Santos and beyond.</p>
      </header>

      <Link
        href="/launch-hub"
        className="mb-3 block rounded-lg border border-neon-pink/40 bg-gradient-to-r from-neon-pink/10 to-neon-violet/10 p-4"
      >
        <p className="text-xs uppercase tracking-widest text-neon-pink">The big drop</p>
        <p className="mt-1 font-display text-lg">GTA VI Launch Hub →</p>
      </Link>

      <Link
        href="/characters"
        className="mb-6 block rounded-lg border border-neon-violet/40 bg-gradient-to-r from-neon-violet/10 to-neon-pink/10 p-4"
      >
        <p className="text-xs uppercase tracking-widest text-neon-violet">Meet the cast</p>
        <p className="mt-1 font-display text-lg">Characters →</p>
      </Link>

      {!videos || videos.length === 0 ? (
        <div className="card text-center text-frost-muted">
          Nothing here yet. Be the first to post a clip.
        </div>
      ) : (
        <div className="space-y-4">
          {(videos as unknown as Video[]).map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </main>
  );
}
