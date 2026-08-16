import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { isAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.id))) {
    // Same response whether unauthenticated or just not an admin — an
    // admin-only endpoint shouldn't confirm to a prober "you're signed
    // in but not an admin" vs "you're not signed in at all."
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { targetUserId, verified } = body as { targetUserId?: unknown; verified?: unknown };

  if (typeof targetUserId !== "string" || typeof verified !== "boolean") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const trusted = createTrustedClient();

  const { error: updateError } = await trusted
    .from("profiles")
    .update({ is_verified: verified, verified_at: verified ? new Date().toISOString() : null })
    .eq("id", targetUserId);

  if (updateError) {
    return NextResponse.json({ error: "Could not update verification status." }, { status: 500 });
  }

  await trusted.from("moderation_actions").insert({
    admin_id: user.id,
    target_user_id: targetUserId,
    action_type: verified ? "verify" : "unverify",
  });

  return NextResponse.json({ verified });
}
