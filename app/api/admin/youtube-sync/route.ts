import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { isAdmin } from "@/lib/admin";

// This route stores ONLY metadata (video id, title, channel, thumbnail
// URL) — never the video file itself. Playback happens entirely through
// YouTube's own embedded player (see components/YouTubeEmbed.tsx),
// which is what makes this legally fine: it's the same mechanism as
// pasting a YouTube link into any website, not redistribution.
// Re-hosting the actual video files would be a real copyright problem;
// this deliberately isn't that.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API key not configured." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { searchTerm } = body as { searchTerm?: unknown };
  const query = typeof searchTerm === "string" && searchTerm.trim() ? searchTerm.trim() : "GTA 6";

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "10");
  searchUrl.searchParams.set("order", "date"); // recency matters most for launch-hype content
  searchUrl.searchParams.set("key", apiKey);

  let results: unknown[];
  try {
    const res = await fetch(searchUrl.toString());
    if (!res.ok) throw new Error(`YouTube API returned ${res.status}`);
    const data = await res.json();
    results = data.items ?? [];
  } catch (err) {
    console.error("YouTube search failed", err);
    return NextResponse.json({ error: "Could not reach YouTube API." }, { status: 502 });
  }

  const trusted = createTrustedClient();
  let added = 0;

  for (const item of results as Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
    };
  }>) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;

    const { error } = await trusted.from("youtube_embeds").insert({
      youtube_video_id: videoId,
      title: item.snippet?.title ?? "Untitled",
      channel_title: item.snippet?.channelTitle ?? null,
      thumbnail_url: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? null,
      added_by: user.id,
    });

    // Duplicate (already synced before) is expected and fine, not an error.
    if (!error) added++;
  }

  return NextResponse.json({ added, checked: results.length });
}
