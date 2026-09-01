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
//
// force-dynamic explicit for the same reason as app/profile/page.tsx —
// this page redirects based on a per-request auth check.
export const dynamic = "force-dynamic";

export default async function WorldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Round 11: previously hard-redirected straight to /sign-in. Product
  // direction is that The Block is pitched as a free side activity for
  // people waiting to watch or waiting to go live — that only works as
  // a hook if visitors can see what it is before being walled off, so
  // signed-out visitors now get a preview + sign-up CTA instead of an
  // immediate bounce. Actually playing still requires an account (rep,
  // turf, and crew standing are tied to a real profile row).
  if (!user) return <WorldPreview />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, is_verified, account_state, crew_id, violence_ack_at, controller_scheme, rep, crews(name, color_hex)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/sign-in");

  if (profile.account_state !== "active") {
    return (
      <main className="px-4 pt-6">
        <div className="card text-center text-frost-muted">
          Your account can&apos;t enter The Block right now.
        </div>
      </main>
    );
  }

  if (!profile.avatar_url) {
    return (
      <main className="px-4 pt-6">
        <div className="card text-center">
          <p className="mb-3 text-frost-muted">
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
          <p className="text-sm text-frost-muted">
            Everyone online, one shared street. Fight, team up, run jobs, or just hang out.
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg text-neon-pink">{profile.rep}</p>
          <p className="text-[11px] text-frost-muted">REP</p>
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
          <p className="text-sm text-frost-muted">
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

// Shown to signed-out visitors instead of a hard redirect. The Block is
// positioned as a free side activity — something to do while waiting
// for a stream to start or waiting to go live yourself — so it needs to
// sell itself before the sign-up wall, not hide behind it.
//
// The preview clip slot below is a placeholder: no recorded gameplay
// footage exists yet to embed here. Swap the placeholder block for a
// short muted video/gif once one exists.
function WorldPreview() {
  return (
    <main className="px-4 pt-6 pb-24">
      <header className="mb-4">
        <h1 className="text-2xl">The Block</h1>
        <p className="mt-1 text-sm text-frost-muted">
          A shared top-down street brawl, right in the app. Fight, team up, run jobs,
          capture turf — or just hang out while you wait for a stream to start.
        </p>
      </header>

      <div className="card mb-4 flex aspect-video items-center justify-center border-neon-violet/30 bg-gradient-to-br from-neon-pink/10 to-neon-violet/10">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-ink/60 text-2xl">
            ▶
          </div>
          <p className="text-xs uppercase tracking-widest text-frost-muted">
            Gameplay preview coming soon
          </p>
        </div>
      </div>

      <div className="card mb-4 space-y-2 text-sm text-frost-muted">
        <p>• Free-for-all or squad up with your crew</p>
        <p>• Capture and hold turf across four zones</p>
        <p>• Missions, jobs, and a live leaderboard</p>
        <p>• Built for quick sessions between streams</p>
      </div>

      <Link href="/sign-in" className="btn-primary block w-full text-center">
        Sign up free to play
      </Link>
    </main>
  );
}
