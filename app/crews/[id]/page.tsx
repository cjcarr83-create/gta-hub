"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Crew, Profile } from "@/lib/database.types";

export default function CrewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipError, setMembershipError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: crewData } = await supabase
        .from("crews")
        .select("id, name, motto, emblem_url, color_hex, owner_id, recruitment_status, created_at")
        .eq("id", id)
        .single();
      setCrew(crewData as unknown as Crew | null);

      const { data: memberData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, wanted_level")
        .eq("crew_id", id);
      setMembers((memberData as unknown as Profile[]) ?? []);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      setLoading(false);
    }
    load();
  }, [id, supabase]);

  // Bug fix: this used to fire the update and optimistically patch local
  // state regardless of whether it actually succeeded — a blocked write
  // (e.g. a restricted account, or a closed crew bypassed via direct
  // client call) still showed the person as joined in the UI. Now checks
  // the returned error first, and re-fetches the real profile row rather
  // than fabricating a partial one (which previously rendered "@unknown"
  // in the member list until the next reload).
  async function handleJoin() {
    if (!currentUserId) return;
    setMembershipError("");
    const { error } = await supabase
      .from("profiles")
      .update({ crew_id: id })
      .eq("id", currentUserId);

    if (error) {
      setMembershipError("Could not join this crew. Try again.");
      return;
    }

    const { data: ownProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, wanted_level")
      .eq("id", currentUserId)
      .single();

    if (ownProfile) {
      setMembers((prev) => [...prev, ownProfile as unknown as Profile]);
    }
  }

  async function handleLeave() {
    if (!currentUserId) return;
    setMembershipError("");
    const { error } = await supabase
      .from("profiles")
      .update({ crew_id: null })
      .eq("id", currentUserId);

    if (error) {
      setMembershipError("Could not leave this crew. Try again.");
      return;
    }

    setMembers((prev) => prev.filter((m) => m.id !== currentUserId));
  }

  if (loading) return <main className="px-4 pt-6 text-frost-muted">Loading…</main>;
  if (!crew) return <main className="px-4 pt-6 text-frost-muted">Crew not found.</main>;

  const isMember = members.some((m) => m.id === currentUserId);

  return (
    <main className="px-4 pt-6">
      <div className="card mb-4">
        <div
          className="mb-3 h-16 w-16 rounded-full border-2"
          style={{ borderColor: crew.color_hex ?? "#F2A93B" }}
        />
        <h1 className="text-xl">{crew.name}</h1>
        {crew.motto && <p className="mt-1 text-sm text-frost-muted">{crew.motto}</p>}
        <p className="mt-2 text-xs text-frost-muted">{members.length} members</p>

        {currentUserId && crew.recruitment_status === "open" && (
          <button onClick={isMember ? handleLeave : handleJoin} className="btn-primary mt-3 w-full">
            {isMember ? "Leave crew" : "Join crew"}
          </button>
        )}
        {membershipError && (
          <p className="mt-2 text-sm text-blood">{membershipError}</p>
        )}
      </div>

      <h2 className="mb-3 text-lg">Members</h2>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.id} className="card flex items-center gap-3 py-2">
            <div className="h-9 w-9 rounded-full bg-ink-line" />
            <span className="text-sm">@{m.username ?? "unknown"}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
