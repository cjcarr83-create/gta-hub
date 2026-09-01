import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CategoryBadge from "@/components/CategoryBadge";
import ShareSheet from "@/components/ShareSheet";
import WatchPlayer from "@/components/WatchPlayer";

// A dedicated, public, single-video page exists specifically so a shared
// link has something worth unfurling. The feed itself isn't a good share
// target — there's no stable per-video URL there, and no way to attach
// Open Graph metadata to one card in an infinite-scroll feed.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("videos")
    .select("title, description, thumbnail_url, playback_id")
    .eq("id", id)
    .single();

  if (!video) return { title: "GTAHUB" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = `${appUrl}/watch/${id}`;

  return {
    title: `${video.title} — GTAHUB`,
    description: video.description ?? "Watch on GTAHUB",
    openGraph: {
      title: video.title,
      description: video.description ?? undefined,
      url: shareUrl,
      type: "video.other",
      images: video.thumbnail_url ? [{ url: video.thumbnail_url, width: 1200, height: 675 }] : [],
      // og:video is intentionally omitted here — it requires a direct
      // playable file URL (Mux's static MP4 renditions, which aren't
      // enabled by default and cost extra encoding time/storage) or a
      // player-embed URL Facebook's crawler accepts. Without one wired
      // up, og:image alone still gives a real thumbnail-card share
      // instead of a bare link. Add static renditions in Mux and an
      // og:video:url here once that's turned on.
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      images: video.thumbnail_url ? [video.thumbnail_url] : [],
    },
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: video } = await supabase
    .from("videos")
    .select(
      "id, user_id, title, description, category, playback_id, thumbnail_url, processing_status, view_count, profiles(username, avatar_url)"
    )
    .eq("id", id)
    .single();

  if (!video) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const shareUrl = `${appUrl}/watch/${id}`;

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 overflow-hidden rounded-lg bg-black">
        {video.processing_status === "ready" && video.playback_id ? (
          <WatchPlayer videoId={video.id} playbackId={video.playback_id} thumbnailUrl={video.thumbnail_url} />
        ) : (
          <div className="flex aspect-video items-center justify-center text-frost-muted">
            Processing…
          </div>
        )}
      </div>

      <div className="mb-2">
        <CategoryBadge category={video.category} />
      </div>
      <h1 className="mb-1 text-lg">{video.title}</h1>
      <p className="mb-4 text-sm text-frost-muted">
        @{(video.profiles as unknown as { username: string } | null)?.username ?? "unknown"} ·{" "}
        {video.view_count.toLocaleString()} views
      </p>

      <ShareSheet
        url={shareUrl}
        title={video.title}
        description={video.description ?? undefined}
      />
    </main>
  );
}
