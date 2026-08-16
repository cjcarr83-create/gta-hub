"use client";

import { useState } from "react";
import VerifiedBadge from "@/components/VerifiedBadge";

interface AdminUserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  account_state: "active" | "restricted" | "suspended" | "banned";
  is_verified: boolean;
  wanted_level: number;
  created_at: string;
}

export default function AdminConsole() {
  const [tab, setTab] = useState<"users" | "youtube">("users");

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-24">
      <h1 className="mb-1 text-2xl">Admin Console</h1>
      <p className="mb-6 text-sm text-sand-muted">
        Only visible to platform admins. Every action here is logged.
      </p>

      <div className="mb-6 flex gap-2 border-b border-asphalt-line">
        <button
          onClick={() => setTab("users")}
          className={`px-3 py-2 text-sm ${tab === "users" ? "border-b-2 border-sunset-amber text-sand" : "text-sand-muted"}`}
        >
          Users
        </button>
        <button
          onClick={() => setTab("youtube")}
          className={`px-3 py-2 text-sm ${tab === "youtube" ? "border-b-2 border-sunset-amber text-sand" : "text-sand-muted"}`}
        >
          YouTube
        </button>
      </div>

      {tab === "users" ? <UserModerationPanel /> : <YouTubePanel />}
    </main>
  );
}

function UserModerationPanel() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    if (query.trim().length < 2) return;
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  async function toggleVerified(u: AdminUserRow) {
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: u.id, verified: !u.is_verified }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_verified: !u.is_verified } : x)));
    }
  }

  async function setState(u: AdminUserRow, state: AdminUserRow["account_state"]) {
    const reason =
      state !== "active"
        ? window.prompt(`Reason for setting @${u.username} to "${state}" (optional):`) ?? undefined
        : undefined;
    const res = await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: u.id, state, reason }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, account_state: state } : x)));
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by username"
          className="flex-1 rounded border border-asphalt-line bg-asphalt px-3 py-2 text-sand"
        />
        <button onClick={handleSearch} className="btn-secondary">
          {loading ? "…" : "Search"}
        </button>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="card">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-semibold">@{u.username}</span>
              {u.is_verified && <VerifiedBadge />}
              <span
                className={`ml-auto rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  u.account_state === "active"
                    ? "text-palm-teal"
                    : u.account_state === "banned"
                    ? "bg-blood text-sand"
                    : "text-sunset-amber"
                }`}
              >
                {u.account_state}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggleVerified(u)} className="btn-secondary text-xs">
                {u.is_verified ? "Remove verification" : "Verify"}
              </button>
              {u.account_state !== "active" && (
                <button onClick={() => setState(u, "active")} className="btn-secondary text-xs">
                  Reactivate
                </button>
              )}
              {u.account_state !== "restricted" && (
                <button onClick={() => setState(u, "restricted")} className="btn-secondary text-xs">
                  Restrict
                </button>
              )}
              {u.account_state !== "suspended" && (
                <button onClick={() => setState(u, "suspended")} className="btn-secondary text-xs">
                  Suspend
                </button>
              )}
              {u.account_state !== "banned" && (
                <button
                  onClick={() => setState(u, "banned")}
                  className="rounded border border-blood px-3 py-1 text-xs text-blood"
                >
                  Ban
                </button>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && query.length >= 2 && !loading && (
          <p className="text-sm text-sand-muted">No users found.</p>
        )}
      </div>
    </div>
  );
}

function YouTubePanel() {
  const [status, setStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("GTA 6 trailer");

  async function handleSync() {
    setStatus("syncing");
    setMessage("");
    try {
      const res = await fetch("/api/admin/youtube-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchTerm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setMessage(`Added ${data.added} new video(s) from YouTube.`);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="card space-y-3">
      <p className="text-sm text-sand-muted">
        Pulls videos from YouTube via the official Data API and stores them
        as embeds (title, thumbnail, video id) — GTAHUB never downloads or
        re-hosts the actual video file. Playback stays on YouTube&apos;s
        player, respecting the original creator&apos;s ownership.
      </p>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full rounded border border-asphalt-line bg-asphalt px-3 py-2 text-sand"
        placeholder="Search term, e.g. 'GTA 6 trailer'"
      />
      <button onClick={handleSync} disabled={status === "syncing"} className="btn-primary w-full disabled:opacity-50">
        {status === "syncing" ? "Syncing…" : "Sync from YouTube"}
      </button>
      {message && <p className="text-sm text-sand-muted">{message}</p>}
    </div>
  );
}
