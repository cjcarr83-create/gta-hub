import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import CountdownTimer from "@/components/CountdownTimer";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import VideoCard from "@/components/VideoCard";
import type { Video } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function LaunchHubPage() {
  const supabase = await createClient();

  const { data: youtubeEmbeds } = await supabase
    .from("youtube_embeds")
    .select("id, youtube_video_id, title, channel_title, thumbnail_url, is_featured")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: hypeClips } = await supabase
    .from("videos")
    .select(
      "id, user_id, crew_id, title, description, category, source, location_tag, thumbnail_url, processing_status, view_count, is_public, moderation_status, created_at, mux_asset_id, mux_upload_id, playback_id, duration_seconds, profiles(username, avatar_url, wanted_level, is_verified)"
    )
    .eq("is_public", true)
    .eq("moderation_status", "visible")
    .order("view_count", { ascending: false })
    .limit(10);

  return (
    <main className="px-4 pt-6">
      <header className="mb-6 text-center">
        <p className="mb-1 text-xs uppercase tracking-widest text-sunset-amber">The big drop</p>
        <h1 className="text-3xl">GTA VI Launch Hub</h1>
      </header>

      <div className="card mb-6">
        <CountdownTimer />
      </div>

      {youtubeEmbeds && youtubeEmbeds.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg">Trailers &amp; News</h2>
          <div className="space-y-4">
            {youtubeEmbeds.map((v) => (
              <div key={v.id}>
                <YouTubeEmbed videoId={v.youtube_video_id} title={v.title} thumbnailUrl={v.thumbnail_url} />
                <p className="mt-2 text-sm">{v.title}</p>
                {v.channel_title && <p className="text-xs text-sand-muted">{v.channel_title}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {hypeClips && hypeClips.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg">Community Hype</h2>
          <div className="space-y-4">
            {(hypeClips as unknown as Video[]).map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </section>
      )}

      {(!youtubeEmbeds || youtubeEmbeds.length === 0) && (!hypeClips || hypeClips.length === 0) && (
        <div className="card text-center text-sand-muted">
          Nothing here yet — check back as launch gets closer.
        </div>
      )}

      <p className="mt-8 text-center text-xs text-sand-muted">
        GTAHUB is an independent, fan-made platform. Not affiliated with{" "}
        Rockstar Games or Take-Two Interactive.{" "}
        <Link href="/about" className="underline">
          About
        </Link>
      </p>
    </main>
  );
}
