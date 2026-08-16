import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { isAdmin } from "@/lib/admin";

const VALID_STATES = ["active", "restricted", "suspended", "banned"] as const;
type AccountState = (typeof VALID_STATES)[number];

const ACTION_FOR_STATE: Record<AccountState, string> = {
  active: "reactivate",
  restricted: "restrict",
  suspended: "suspend",
  banned: "ban",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { targetUserId, state, reason } = body as {
    targetUserId?: unknown;
    state?: unknown;
    reason?: unknown;
  };

  if (typeof targetUserId !== "string") {
    return NextResponse.json({ error: "Missing target user." }, { status: 400 });
  }
  if (typeof state !== "string" || !VALID_STATES.includes(state as AccountState)) {
    return NextResponse.json({ error: "Invalid account state." }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "You can't moderate your own account." }, { status: 400 });
  }

  const trusted = createTrustedClient();

  const { error: updateError } = await trusted
    .from("profiles")
    .update({ account_state: state })
    .eq("id", targetUserId);

  if (updateError) {
    return NextResponse.json({ error: "Could not update account state." }, { status: 500 });
  }

  await trusted.from("moderation_actions").insert({
    admin_id: user.id,
    target_user_id: targetUserId,
    action_type: ACTION_FOR_STATE[state as AccountState],
    reason: typeof reason === "string" ? reason.slice(0, 500) : null,
  });

  return NextResponse.json({ state });
}
