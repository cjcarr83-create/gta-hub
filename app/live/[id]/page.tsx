"use client";

import { useEffect, useState, use } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { createClient } from "@/lib/supabase/client";
import { getAnonSessionId } from "@/lib/anonSession";
import CategoryBadge from "@/components/CategoryBadge";
import TipSheet from "@/components/TipSheet";
import type { Stream } from "@/lib/database.types";

export default function LiveStreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [stream, setStream] = useState<Stream | null>(null);
  const [showTip, setShowTip] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("streams")
        .select(
          "id, user_id, crew_id, title, category, status, viewer_count, mux_playback_id, mux_stream_id, started_at, ended_at, created_at, profiles(username, avatar_url)"
        )
        .eq("id", id)
        .single();
      if (active) {
        setStream(data as unknown as Stream | null);
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id, supabase]);

  // H12 fix: this is the real viewer-count mechanism — see
  // app/api/streams/[id]/ping. Round 2 only had the polling above, which
  // re-read a `viewer_count` column nothing ever wrote to.
  useEffect(() => {
    if (!stream || stream.status !== "live") return;

    async function ping() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const sessionId = getAnonSessionId();
      await fetch(`/api/streams/${id}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: user ? undefined : sessionId }),
      }).catch(() => {}); // best-effort; a missed heartbeat just ages out of the presence window
    }

    ping();
    const pingInterval = setInterval(ping, 20000);
    return () => clearInterval(pingInterval);
  }, [stream, id, supabase]);

  if (loading) {
    return <main className="px-4 pt-6 text-sand-muted">Loading…</main>;
  }

  if (!stream) {
    return <main className="px-4 pt-6 text-sand-muted">Stream not found.</main>;
  }

  return (
    <main className="px-4 pt-6">
      <div className="mb-4 overflow-hidden rounded-lg bg-black">
        {stream.status === "live" && stream.mux_playback_id ? (
          <MuxPlayer
            playbackId={stream.mux_playback_id}
            streamType="live"
            autoPlay
            muted
            style={{ width: "100%", aspectRatio: "16/9" }}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sand-muted">
            {stream.status === "ended" ? "This stream has ended." : "Waiting for the broadcast to start…"}
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        {stream.status === "live" && (
          <span className="flex items-center gap-1 rounded-sm bg-blood px-2 py-0.5 text-[11px] font-display uppercase text-sand">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sand" />
            Live
          </span>
        )}
        <CategoryBadge category={stream.category} />
        <span className="ml-auto text-xs text-sand-muted">
          {stream.viewer_count.toLocaleString()} watching
        </span>
      </div>

      <h1 className="mb-1 text-lg">{stream.title}</h1>
      <p className="mb-4 text-sm text-sand-muted">@{stream.profiles?.username ?? "unknown"}</p>

      <button onClick={() => setShowTip(true)} className="btn-primary w-full">
        Send a tip
      </button>

      {showTip && (
        <TipSheet creatorId={stream.user_id} streamId={stream.id} onClose={() => setShowTip(false)} />
      )}
    </main>
  );
}
