import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";

const DEDUP_WINDOW_MINUTES = 30;

// H12 fix: view_count was displayed everywhere but nothing in Round 1/2
// actually incremented it. This route is the real counting path — call
// it once when a video starts playing (client-side, from the player's
// onPlay). Dedup means the same viewer re-watching or refreshing within
// the window doesn't inflate the count.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous viewers still count, keyed by a client-supplied session id
  // (a random id the frontend generates once per browser session and
  // sends along) rather than IP, which is unreliable behind shared NAT/
  // mobile carriers and also more privacy-sensitive to store.
  const body = await req.json().catch(() => ({}));
  const anonSessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const viewerKey = user?.id ?? anonSessionId;

  if (!viewerKey) {
    return NextResponse.json({ error: "Missing session identifier." }, { status: 400 });
  }

  const trusted = createTrustedClient();

  const { data: existing } = await trusted
    .from("video_view_dedup")
    .select("last_viewed_at")
    .eq("video_id", videoId)
    .eq("viewer_key", viewerKey)
    .single();

  const dedupWindowStart = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60_000);

  if (existing && new Date(existing.last_viewed_at) > dedupWindowStart) {
    return NextResponse.json({ counted: false }); // already counted recently
  }

  await trusted
    .from("video_view_dedup")
    .upsert({ video_id: videoId, viewer_key: viewerKey, last_viewed_at: new Date().toISOString() });

  // Atomic increment via RPC would be ideal; Supabase's JS client doesn't
  // expose a plain `increment` without an RPC function, so this does a
  // read-then-write. Under concurrent views on the same video this can
  // lose an increment on rare overlap — acceptable for a view counter
  // (not a financial figure), but note it rather than pretend it's
  // perfectly atomic. A `increment_view_count(video_id)` SQL function
  // callable via `.rpc()` would close this gap if exact counts matter.
  const { data: video } = await trusted.from("videos").select("view_count").eq("id", videoId).single();
  if (video) {
    await trusted.from("videos").update({ view_count: video.view_count + 1 }).eq("id", videoId);
  }

  return NextResponse.json({ counted: true });
}
