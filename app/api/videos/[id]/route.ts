import { NextRequest, NextResponse } from "next/server";
import Mux from "@mux/mux-node";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// C11 fix (Round 5 audit): Round 4's version had two real bugs:
//
// 1. It caught ANY exception from mux.video.assets.delete() and then
//    deleted the GTAHUB row regardless — so a transient network blip or
//    a temporary Mux API issue produced exactly the orphaning condition
//    this route was supposed to prevent (DB row gone, Mux asset still
//    billing/existing, now untrackable).
// 2. It only ever looked at mux_asset_id. A video still mid-upload has
//    no asset yet — only a pending Direct Upload (mux_upload_id). That
//    upload was never cancelled, so it could complete AFTER the GTAHUB
//    row was deleted and create an asset whose `passthrough` pointed at
//    a row that no longer exists.
//
// Fixed: distinguish "not found" (already gone — fine, proceed) from
// "unknown/transient failure" (do NOT delete the DB row — this needs a
// retry, not data loss). Handles both the asset case and the pending-
// upload case.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: videoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const trusted = createTrustedClient();

  const { data: video } = await trusted
    .from("videos")
    .select("user_id, mux_asset_id, mux_upload_id")
    .eq("id", videoId)
    .single();

  if (!video) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (video.user_id !== user.id) {
    return NextResponse.json({ error: "Not your video." }, { status: 403 });
  }

  // Mark the row as pending deletion FIRST, before attempting any
  // provider cleanup. If a Mux webhook fires mid-deletion (e.g. an
  // in-flight upload completes right as this request runs), the
  // webhook handlers can check for this state and no-op instead of
  // reviving a row that's being torn down.
  await trusted.from("videos").update({ processing_status: "failed", is_public: false }).eq("id", videoId);

  if (video.mux_asset_id) {
    const cleanedUp = await tryDeleteAsset(video.mux_asset_id);
    if (!cleanedUp) {
      return NextResponse.json(
        { error: "Could not confirm the video was removed from processing. Try again shortly." },
        { status: 503 }
      );
    }
  } else if (video.mux_upload_id) {
    // No asset yet — this upload is still (or was) pending. Cancel it
    // so a late-arriving upload completion can't create an orphaned
    // asset after the DB row is gone.
    const cancelled = await tryCancelUpload(video.mux_upload_id);
    if (!cancelled) {
      return NextResponse.json(
        { error: "Could not cancel the pending upload. Try again shortly." },
        { status: 503 }
      );
    }
  }

  const { error: deleteError } = await trusted.from("videos").delete().eq("id", videoId);
  if (deleteError) {
    return NextResponse.json({ error: "Could not delete video." }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}

// Returns true if it's now safe to delete the GTAHUB row (asset is
// gone, or was already gone). Returns false for anything that should
// block deletion — a transient/unknown failure must NOT be treated as
// "proceed anyway," which was Round 4's actual bug.
async function tryDeleteAsset(assetId: string): Promise<boolean> {
  try {
    await mux.video.assets.delete(assetId);
    return true;
  } catch (err) {
    if (err instanceof Mux.NotFoundError) {
      // Already gone on Mux's side — that's a success state for us too.
      return true;
    }
    console.error("Mux asset deletion failed (not treating as success)", assetId, err);
    return false;
  }
}

async function tryCancelUpload(uploadId: string): Promise<boolean> {
  try {
    await mux.video.uploads.cancel(uploadId);
    return true;
  } catch (err) {
    if (err instanceof Mux.NotFoundError) {
      return true;
    }
    if (err instanceof Mux.ConflictError) {
      // Mux's cancel endpoint only succeeds while the upload is still
      // 'waiting' — a 409 here means it already transitioned (e.g. to
      // asset_created) between our SELECT and this call. That's a real
      // race: the asset may now exist with no mux_asset_id recorded on
      // our row yet. Treat as NOT safe to delete — the caller should
      // retry, by which point the Mux webhook should have populated
      // mux_asset_id and a retry will correctly go through the
      // asset-delete path instead.
      console.error("Upload already transitioned past 'waiting' — retry needed", uploadId);
      return false;
    }
    console.error("Mux upload cancellation failed (not treating as success)", uploadId, err);
    return false;
  }
}
