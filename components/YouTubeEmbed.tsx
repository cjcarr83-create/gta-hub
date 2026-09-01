"use client";

import { useState } from "react";

// "Lite" embed pattern: renders a thumbnail + play button instead of an
// eager iframe. YouTube's embedded player is heavy (loads its own JS,
// sets cookies, etc.) — deferring it until the person actually wants to
// watch keeps the feed fast. Once clicked, this becomes a real
// youtube-nocookie.com iframe — YouTube's own privacy-enhanced embed
// domain, which doesn't set tracking cookies until playback starts.
export default function YouTubeEmbed({
  videoId,
  title,
  thumbnailUrl,
}: {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative block aspect-video w-full overflow-hidden rounded bg-ink-line text-left"
      aria-label={`Play: ${title}`}
    >
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/60">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
        YouTube
      </span>
    </button>
  );
}
