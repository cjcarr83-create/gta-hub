"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentCategory } from "@/lib/database.types";

const CATEGORIES: ContentCategory[] = [
  "stunts", "heists", "rp", "chaos", "races", "builds", "guides",
];

export default function StartLivePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ContentCategory>("heists");
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreate() {
    if (!title.trim()) {
      setErrorMsg("Add a title first.");
      return;
    }
    setStatus("creating");
    setErrorMsg("");

    try {
      const res = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start stream.");
      }
      const data = await res.json();
      setStreamKey(data.streamKey);
      setStreamId(data.streamId);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (streamKey && streamId) {
    return (
      <main className="px-4 pt-6">
        <h1 className="mb-4 text-2xl">You&apos;re set up</h1>
        <div className="card space-y-3">
          <p className="text-sm text-frost-muted">
            Paste this stream key into OBS (or your broadcast software) as
            the RTMP key. Your stream goes live on GTAHUB automatically
            once you start broadcasting.
          </p>
          <div className="rounded border border-ink-line bg-ink p-3 font-mono text-xs break-all">
            {streamKey}
          </div>
          <p className="text-xs text-blood">
            This key is shown once — copy it now. Don&apos;t share it publicly.
          </p>
          <button onClick={() => router.push(`/live/${streamId}`)} className="btn-primary w-full">
            Go to my stream page
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-6 text-2xl">Go live</h1>
      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase text-frost-muted">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full rounded border border-ink-line bg-ink px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase text-frost-muted">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-sm border px-3 py-1 text-xs uppercase tracking-wide
                  ${category === c ? "border-neon-pink text-neon-pink" : "border-ink-line text-frost-muted"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {errorMsg && <p className="text-sm text-blood">{errorMsg}</p>}
        <button
          onClick={handleCreate}
          disabled={status === "creating"}
          className="btn-primary w-full disabled:opacity-50"
        >
          {status === "creating" ? "Setting up…" : "Create stream"}
        </button>
      </div>
    </main>
  );
}
