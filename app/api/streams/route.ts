import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import type { ContentCategory } from "@/lib/database.types";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_STREAMS_CREATED = 5; // H13 fix
const MAX_ACTIVE_STREAMS_PER_CREATOR = 1; // H13 fix — no stacking idle/live resources

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const trusted = createTrustedClient();

  const { data: profile } = await trusted
    .from("profiles")
    .select("account_state")
    .eq("id", user.id)
    .single();

  if (!profile || profile.account_state !== "active") {
    return NextResponse.json({ error: "Your account can't go live right now." }, { status: 403 });
  }

  // H13 fix (Round 3 audit): Round 2 had no limit on how many times a
  // signed-in user could call this route, each creating a real Mux live
  // stream resource (a real cost, not a free operation).
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count: recentCount } = await trusted
    .from("streams")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  if ((recentCount ?? 0) >= RATE_LIMIT_MAX_STREAMS_CREATED) {
    return NextResponse.json({ error: "Too many streams created recently. Try again later." }, { status: 429 });
  }

  const { count: activeCount } = await trusted
    .from("streams")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["idle", "live"]);

  if ((activeCount ?? 0) >= MAX_ACTIVE_STREAMS_PER_CREATOR) {
    return NextResponse.json(
      { error: "You already have an active stream. End it before starting another." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { title, category } = body as { title?: string; category?: ContentCategory };

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  const validCategories: ContentCategory[] = [
    "stunts", "heists", "rp", "chaos", "races", "builds", "guides",
  ];
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const liveStream = await mux.video.liveStreams.create({
    playback_policy: ["public"],
    new_asset_settings: { playback_policy: ["public"] },
  });

  const { data: stream, error: insertError } = await trusted
    .from("streams")
    .insert({
      user_id: user.id,
      title: title.trim().slice(0, 100),
      category,
      mux_stream_id: liveStream.id,
      mux_playback_id: liveStream.playback_ids?.[0]?.id ?? null,
      status: "idle",
    })
    .select("id")
    .single();

  if (insertError || !stream) {
    // M11 fix (Round 3 audit): Round 2 created the Mux live stream
    // BEFORE the DB insert — if the insert failed, the Mux resource was
    // silently orphaned (existing, costing nothing until used, but
    // untracked and un-cleanable through the app). Now cleaned up
    // immediately on the failure path instead of left to accumulate.
    try {
      await mux.video.liveStreams.delete(liveStream.id);
    } catch (cleanupErr) {
      console.error("Failed to clean up orphaned Mux live stream", liveStream.id, cleanupErr);
    }
    return NextResponse.json({ error: "Could not create stream." }, { status: 500 });
  }

  return NextResponse.json({
    streamId: stream.id,
    streamKey: liveStream.stream_key,
  });
}
