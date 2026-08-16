import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorldGate from "@/components/world/WorldGate";
import WorldLeaderboard from "@/components/world/WorldLeaderboard";
import { isControllerScheme } from "@/lib/world/controller";

// Round 7 — The Block. Things this page enforces before handing off to
// the client-side canvas:
//   1. Signed in — the world identifies you by your real account, not
//      an anonymous session (unlike video/stream view counting, which
//      intentionally supports anonymous viewers).
//   2. Has an avatar — walking around as a blank circle undermines the
//      whole point of the AI character feature.
//   3. account_state is 'active' — a restricted/suspended account sees
//      a clear message here instead of a raw error inside the canvas.
//   4. (Round 9) Has acknowledged the content warning at least once —
//      see components/world/ContentWarningGate.tsx for what this is
//      and, importantly, what it isn't.
export default async function WorldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, is_verified, account_state, crew_id, violence_ack_at, controller_scheme, rep, crews(name, color_hex)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/sign-in");

  if (profile.account_state !== "active") {
    return (
      <main className="px-4 pt-6">
        <div className="card text-center text-sand-muted">
          Your account can&apos;t enter The Block right now.
        </div>
      </main>
    );
  }

  if (!profile.avatar_url) {
    return (
      <main className="px-4 pt-6">
        <div className="card text-center">
          <p className="mb-3 text-sand-muted">
            Build your character before entering The Block.
          </p>
          <Link href="/onboarding/avatar" className="btn-primary inline-block">
            Build my character
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-6 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">The Block</h1>
          <p className="text-sm text-sand-muted">
            Everyone online, one shared street. Fight, team up, run jobs, or just hang out.
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg text-sunset-amber">{profile.rep}</p>
          <p className="text-[11px] text-sand-muted">REP</p>
        </div>
      </header>

      <WorldGate
        userId={user.id}
        username={profile.username}
        avatarUrl={profile.avatar_url}
        isVerified={profile.is_verified}
        crewId={profile.crew_id}
        crewName={(profile.crews as unknown as { name: string } | null)?.name ?? null}
        crewColorHex={(profile.crews as unknown as { color_hex: string | null } | null)?.color_hex ?? null}
        initiallyAcknowledged={!!profile.violence_ack_at}
        initialControllerScheme={
          isControllerScheme(profile.controller_scheme) ? profile.controller_scheme : "shapes"
        }
      />

      {!profile.crew_id && (
        <div className="card mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-sand-muted">
            No crew yet — join one so teammates can&apos;t accidentally (or deliberately) fight you.
          </p>
          <Link href="/crews" className="btn-primary shrink-0 text-sm">
            Find a crew
          </Link>
        </div>
      )}

      <WorldLeaderboard />
    </main>
  );
}
