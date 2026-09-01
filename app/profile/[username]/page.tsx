import { createClient } from "@/lib/supabase/server";
import { createTrustedClient } from "@/lib/supabase/trusted";
import { notFound } from "next/navigation";
import Link from "next/link";
import WantedStars from "@/components/WantedStars";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { GarageBuild } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, wanted_level, is_verified, radio_station, crew_id, crews(name, emblem_url)")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const isOwnProfile = currentUser?.id === profile.id;

  let payoutStatus: string | null = null;
  if (isOwnProfile) {
    const trusted = createTrustedClient();
    const { data: payoutAccount } = await trusted
      .from("creator_payout_accounts")
      .select("onboarding_status")
      .eq("user_id", profile.id)
      .single();
    payoutStatus = payoutAccount?.onboarding_status ?? null;
  }

  const { data: garageBuilds } = await supabase
    .from("garage_builds")
    .select("id, vehicle_name, livery_description, performance_class, photo_url, caption")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <main className="px-4 pt-6">
      {isOwnProfile && payoutStatus !== "complete" && (
        <div className="card mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-frost-muted">
            Set up payouts to start receiving tips on your clips and streams.
          </p>
          <Link href="/creator/onboarding" className="btn-primary shrink-0 text-sm">
            Set up
          </Link>
        </div>
      )}

      {isOwnProfile && (
        <div className="card mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-frost-muted">
            {profile.avatar_url
              ? "Not feeling your look? Rebuild your AI character."
              : "Build an AI character to use as your avatar in The Block."}
          </p>
          <Link href="/onboarding/avatar" className="btn-primary shrink-0 text-sm">
            {profile.avatar_url ? "Rebuild" : "Build"}
          </Link>
        </div>
      )}

      <header className="card mb-4">
        <div className="mb-3 flex items-center gap-3">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-ink-line" />
          )}
          <div>
            <h1 className="text-xl flex items-center gap-1.5">
              @{profile.username}
              {profile.is_verified && <VerifiedBadge size={16} />}
            </h1>
            <WantedStars level={profile.wanted_level} size="lg" />
          </div>
        </div>
        {profile.bio && <p className="text-sm text-frost-muted">{profile.bio}</p>}
        {profile.crews && (
          <p className="mt-2 text-xs text-neon-pink">
            Crew: {(profile.crews as unknown as { name: string }).name}
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-3 text-lg">Garage</h2>
        {!garageBuilds || garageBuilds.length === 0 ? (
          <div className="card text-center text-sm text-frost-muted">
            No builds posted yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(garageBuilds as unknown as GarageBuild[]).map((build) => (
              <div key={build.id} className="card">
                <div className="mb-2 aspect-video rounded bg-ink-line">
                  {build.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={build.photo_url}
                      alt={build.vehicle_name}
                      className="h-full w-full rounded object-cover"
                    />
                  )}
                </div>
                <h3 className="text-sm">{build.vehicle_name}</h3>
                {build.performance_class && (
                  <p className="text-xs text-frost-muted">{build.performance_class}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isOwnProfile && (
        <div className="mt-6 text-center">
          <Link href="/about" className="text-xs text-frost-muted hover:text-frost">
            About GTAHUB
          </Link>
        </div>
      )}
    </main>
  );
}
