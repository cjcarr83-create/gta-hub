import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import type { ContentCategory, ContentSource } from "@/lib/database.types";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_UPLOADS = 10; // M6 — cheap DB-backed limit; swap for a
// durable rate limiter (Upstash/Redis) before real launch traffic.

// H1 fix (Round 2 audit): Round 1 created the Mux upload URL, let the
// browser upload the file, and only THEN had the browser insert the
// GTAHUB video row and self-report the mux_upload_id. That let the
// client control which upload ID got attached to which row and left a
// window where a file could finish uploading with no app-side record at
// all. Mux's own guidance is to create the application record first and
// use `passthrough` to bind the two robustly.
//
// Fixed sequence:
//   1. verify caller is signed in and active (was entirely missing)
//   2. apply a basic per-user rate limit before spending Mux quota
//   3. create the `videos` row via the TRUSTED client (not the caller's
//      row-owned insert) in an 'uploading' state
//   4. create the Mux upload with passthrough = video row id
//   5. return only { uploadUrl, videoId } — client never sees or sets
//      mux_upload_id directly
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
    return NextResponse.json(
      { error: "Your account can't upload right now." },
      { status: 403 }
    );
  }

  // C9 fix (Round 4 audit): this used to count `videos` rows, which a
  // user could reset by deleting their own uploads (before C9 also
  // closed that DELETE hole). Now reads from upload_attempts, an
  // insert-only log a video deletion can never affect.
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000
  ).toISOString();
  const { count } = await trusted
    .from("upload_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX_UPLOADS) {
    return NextResponse.json(
      { error: "Upload limit reached. Try again later." },
      { status: 429 }
    );
  }

  // Record the attempt before doing any real work — this is what makes
  // the limit durable. Recorded regardless of whether the upload below
  // ultimately succeeds, same as how a real rate limiter counts attempts
  // rather than only successes.
  await trusted.from("upload_attempts").insert({ user_id: user.id });

  const body = await req.json().catch(() => ({}));
  const { title, description, category, source } = body as {
    title?: string;
    description?: string;
    category?: ContentCategory;
    source?: ContentSource;
  };

  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  const validCategories: ContentCategory[] = [
    "stunts", "heists", "rp", "chaos", "races", "builds", "guides",
  ];
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  // Create the video row first — this is now the source of truth, not a
  // client-side insert after the fact.
  const { data: video, error: insertError } = await trusted
    .from("videos")
    .insert({
      user_id: user.id,
      title: title.trim().slice(0, 100),
      description: description?.trim().slice(0, 1000) || null,
      category,
      source: source ?? "vanilla",
      processing_status: "uploading",
    })
    .select("id")
    .single();

  if (insertError || !video) {
    return NextResponse.json({ error: "Could not create video record." }, { status: 500 });
  }

  // M11 fix (Round 3 audit): the video row is created before the Mux
  // upload — if Mux creation throws, the row was previously left
  // orphaned at 'uploading' forever, with no path to ever become
  // 'ready' or 'failed'. Now explicitly marked 'failed' so it shows up
  // correctly in the creator's own content list instead of hanging.
  let upload;
  try {
    upload = await mux.video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: video.id,
      },
    });
  } catch (muxError) {
    await trusted.from("videos").update({ processing_status: "failed" }).eq("id", video.id);
    console.error("Mux upload creation failed for video", video.id, muxError);
    return NextResponse.json({ error: "Could not start upload." }, { status: 500 });
  }

  // Now that we have the Mux upload id, attach it to the row we already
  // created (still trusted-only write).
  await trusted
    .from("videos")
    .update({ mux_upload_id: upload.id })
    .eq("id", video.id);

  return NextResponse.json({
    uploadUrl: upload.url,
    videoId: video.id,
  });
}
