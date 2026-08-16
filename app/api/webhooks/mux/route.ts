import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { claimEvent, markProcessed, markFailed } from "@/lib/webhookClaim";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function isValidMuxSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const parts = Object.fromEntries(signatureHeader.split(",").map((p) => p.split("=")));
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  const timestampSeconds = parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const computed = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  const computedBuf = Buffer.from(computed);
  const expectedBuf = Buffer.from(expectedSig);
  if (computedBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(computedBuf, expectedBuf);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("mux-signature");

  if (!isValidMuxSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const eventId = event.id ?? crypto.randomUUID();
  const trusted = createTrustedClient();

  const claim = await claimEvent(trusted, "mux", eventId, event.type);
  if (claim === "already_processed") {
    return NextResponse.json({ received: true, deduped: true });
  }
  if (claim === "held_by_other") {
    return NextResponse.json({ received: true, retry: true }, { status: 409 });
  }
  if (claim === "error") {
    return NextResponse.json({ error: "Could not claim event." }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "video.asset.ready": {
        const asset = event.data;
        const playbackId = asset.playback_ids?.[0]?.id;
        const videoId = asset.passthrough;
        const query = trusted.from("videos").update({
          mux_asset_id: asset.id,
          playback_id: playbackId ?? null,
          duration_seconds: Math.round(asset.duration ?? 0),
          thumbnail_url: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : null,
          processing_status: "ready",
        });
        const { error } = videoId
          ? await query.eq("id", videoId)
          : await query.eq("mux_upload_id", asset.upload_id);
        if (error) throw error;
        break;
      }
      case "video.asset.errored": {
        const asset = event.data;
        const videoId = asset.passthrough;
        const query = trusted.from("videos").update({ processing_status: "failed" });
        const { error } = videoId
          ? await query.eq("id", videoId)
          : await query.eq("mux_upload_id", asset.upload_id);
        if (error) throw error;
        break;
      }
      case "video.live_stream.active": {
        const stream = event.data;
        const { error } = await trusted
          .from("streams")
          .update({ status: "live", started_at: new Date().toISOString() })
          .eq("mux_stream_id", stream.id);
        if (error) throw error;
        break;
      }
      case "video.live_stream.idle": {
        const stream = event.data;
        const { error } = await trusted
          .from("streams")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("mux_stream_id", stream.id);
        if (error) throw error;
        break;
      }
      default:
        break;
    }

    await markProcessed(trusted, "mux", eventId);
    return NextResponse.json({ received: true });
  } catch (err) {
    await markFailed(trusted, "mux", eventId, err instanceof Error ? err.message : String(err));
    console.error("Mux webhook processing failed", err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
