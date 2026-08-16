import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";

const PRESENCE_WINDOW_SECONDS = 60;

// H12 fix: streams.viewer_count was described as "webhook-updated" but
// the Mux webhook only ever touched status/timestamps — viewer_count
// was never written anywhere. Real implementation: the live page's
// player calls this route every ~20s while watching. Each ping recomputes
// viewer_count as "distinct viewer_keys seen in the last 60 seconds" —
// an honest approximation, not a reconciled/cron-audited count. See the
// schema comment on stream_viewer_pings for the same caveat.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: streamId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await req.json().catch(() => ({}));
  const anonSessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  const viewerKey = user?.id ?? anonSessionId;

  if (!viewerKey) {
    return NextResponse.json({ error: "Missing session identifier." }, { status: 400 });
  }

  const trusted = createTrustedClient();

  await trusted
    .from("stream_viewer_pings")
    .upsert({ stream_id: streamId, viewer_key: viewerKey, last_ping_at: new Date().toISOString() });

  const windowStart = new Date(Date.now() - PRESENCE_WINDOW_SECONDS * 1000).toISOString();
  const { count } = await trusted
    .from("stream_viewer_pings")
    .select("viewer_key", { count: "exact", head: true })
    .eq("stream_id", streamId)
    .gte("last_ping_at", windowStart);

  await trusted.from("streams").update({ viewer_count: count ?? 0 }).eq("id", streamId);

  return NextResponse.json({ viewerCount: count ?? 0 });
}
