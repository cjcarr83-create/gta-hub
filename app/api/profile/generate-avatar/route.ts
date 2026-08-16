import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { generateAvatarImage, isValidAvatarStyle, type AvatarStyle } from "@/lib/avatarGen";

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_GENERATIONS = 5; // image generation costs real money per call

// Same shape as app/api/videos/create-upload-url/route.ts: verify
// caller is signed in and active, rate-limit before spending provider
// quota, validate the payload against a fixed allow-list (see
// lib/avatarGen.ts for why this never accepts freeform text), then
// write via the trusted client only. profiles.avatar_url is written
// here — not by the client directly — even though it happens to be
// client-grantable for manual URL entry (see 0001_init.sql), so a
// generation can't be raced or spoofed by a client-side write.
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
      { error: "Your account can't generate an avatar right now." },
      { status: 403 }
    );
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await trusted
    .from("avatar_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX_GENERATIONS) {
    return NextResponse.json(
      { error: "You've hit the avatar generation limit. Try again in a bit." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const style = body?.style as unknown;

  if (!isValidAvatarStyle(style)) {
    return NextResponse.json(
      { error: "Invalid style selection — pick from the provided options." },
      { status: 400 }
    );
  }

  const { data: generationRow, error: insertError } = await trusted
    .from("avatar_generations")
    .insert({
      user_id: user.id,
      style: style as AvatarStyle,
      provider: "unconfigured",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !generationRow) {
    return NextResponse.json({ error: "Could not start generation." }, { status: 500 });
  }

  await trusted
    .from("profiles")
    .update({ avatar_generation_status: "pending" })
    .eq("id", user.id);

  const result = await generateAvatarImage(style as AvatarStyle);

  if (!result.ok) {
    await trusted
      .from("avatar_generations")
      .update({ status: "failed", error: result.error.slice(0, 500) })
      .eq("id", generationRow.id);
    await trusted
      .from("profiles")
      .update({ avatar_generation_status: "failed" })
      .eq("id", user.id);

    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await trusted
    .from("avatar_generations")
    .update({ status: "succeeded", result_url: result.imageUrl, provider: result.provider })
    .eq("id", generationRow.id);

  await trusted
    .from("profiles")
    .update({ avatar_url: result.imageUrl, avatar_generation_status: "ready", avatar_style: style })
    .eq("id", user.id);

  return NextResponse.json({ imageUrl: result.imageUrl });
}
