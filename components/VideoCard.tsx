"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import MuxPlayer from "@mux/mux-player-react";
import { getAnonSessionId } from "@/lib/anonSession";
import type { Video } from "@/lib/database.types";
import CategoryBadge from "@/components/CategoryBadge";
import WantedStars from "@/components/WantedStars";
import VerifiedBadge from "@/components/VerifiedBadge";
import TipSheet from "@/components/TipSheet";

export default function VideoCard({ video }: { video: Video }) {
  const [showTip, setShowTip] = useState(false);
  const hasCountedView = useRef(false);

  // H12 fix: this is the real view-counting call — see
  // app/api/videos/[id]/view. Fires once per mount on first play, not on
  // every re-render, and the route itself dedupes per viewer/session.
  function handlePlay() {
    if (hasCountedView.current) return;
    hasCountedView.current = true;
    fetch(`/api/videos/${video.id}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: getAnonSessionId() }),
    }).catch(() => {}); // best-effort; a failed count isn't worth surfacing to the viewer
  }

  return (
    <article className="card">
      {/* H6 fix: Round 1 rendered only a static <img> thumbnail even
          though @mux/mux-player-react was installed — clips were never
          actually playable. Now renders the real Mux player once the
          asset is ready, falls back to the thumbnail/poster while
          processing. */}
      <div className="mb-3 overflow-hidden rounded bg-ink-line">
        {video.processing_status === "ready" && video.playback_id ? (
          <MuxPlayer
            playbackId={video.playback_id}
            poster={video.thumbnail_url ?? undefined}
            style={{ aspectRatio: "16/9", width: "100%" }}
            metadata={{ video_id: video.id, video_title: video.title }}
            onPlay={handlePlay}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-xs text-frost-muted">
            {video.processing_status === "failed" ? "Processing failed" : "Processing…"}
          </div>
        )}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <CategoryBadge category={video.category} />
        {video.source !== "vanilla" && (
          <span className="text-[11px] uppercase tracking-wide text-frost-muted">
            {video.source === "modded" ? "Modded" : "RP Server"}
          </span>
        )}
      </div>

      <h3 className="text-base leading-tight">{video.title}</h3>

      <div className="mt-2 flex items-center justify-between">
        <Link
          href={`/profile/${video.profiles?.username ?? ""}`}
          className="flex items-center gap-2 text-sm text-frost-muted hover:text-frost"
        >
          {/* M9 fix: avatar_url was fetched but never rendered — was
              always a blank div. */}
          {video.profiles?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.profiles.avatar_url}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-ink-line" />
          )}
          <span>@{video.profiles?.username ?? "unknown"}</span>
          {video.profiles?.is_verified && <VerifiedBadge />}
          {video.profiles?.wanted_level ? <WantedStars level={video.profiles.wanted_level} /> : null}
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-frost-muted">{video.view_count.toLocaleString()} views</span>
          <Link
            href={`/watch/${video.id}`}
            className="rounded border border-ink-line px-2 py-1 text-[11px] font-display uppercase text-frost-muted hover:text-frost"
          >
            Share
          </Link>
          <button
            onClick={() => setShowTip(true)}
            className="rounded bg-gradient-to-r from-neon-pink to-neon-violet px-2 py-1 text-[11px] font-display font-bold uppercase text-ink"
          >
            Tip
          </button>
        </div>
      </div>

      {showTip && (
        <TipSheet creatorId={video.user_id} videoId={video.id} onClose={() => setShowTip(false)} />
      )}
    </article>
  );
}
