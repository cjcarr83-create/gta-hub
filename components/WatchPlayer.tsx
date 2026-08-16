"use client";

import { useRef } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { getAnonSessionId } from "@/lib/anonSession";
import { createClient } from "@/lib/supabase/client";

export default function WatchPlayer({
  videoId,
  playbackId,
  thumbnailUrl,
}: {
  videoId: string;
  playbackId: string;
  thumbnailUrl: string | null;
}) {
  const hasCountedView = useRef(false);

  async function handlePlay() {
    if (hasCountedView.current) return;
    hasCountedView.current = true;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    fetch(`/api/videos/${videoId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: user ? undefined : getAnonSessionId() }),
    }).catch(() => {});
  }

  return (
    <MuxPlayer
      playbackId={playbackId}
      poster={thumbnailUrl ?? undefined}
      style={{ width: "100%", aspectRatio: "16/9" }}
      onPlay={handlePlay}
    />
  );
}
