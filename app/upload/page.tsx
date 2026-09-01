"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentCategory, ContentSource } from "@/lib/database.types";

const CATEGORIES: ContentCategory[] = [
  "stunts",
  "heists",
  "rp",
  "chaos",
  "races",
  "builds",
  "guides",
];

export default function UploadPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ContentCategory>("stunts");
  const [source, setSource] = useState<ContentSource>("vanilla");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // H1 fix: the video row is now created server-side, atomically with
  // the Mux upload, inside /api/videos/create-upload-url. This page just
  // supplies metadata and the file — it no longer inserts into `videos`
  // directly (that insert is what let a client set mux_upload_id itself).
  async function handleSubmit() {
    if (!title.trim() || !file) {
      setErrorMsg("Add a title and select a video file.");
      return;
    }
    setStatus("uploading");
    setErrorMsg("");

    try {
      const startRes = await fetch("/api/videos/create-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, source }),
      });

      if (!startRes.ok) {
        const body = await startRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start upload.");
      }

      const { uploadUrl } = await startRes.json();

      const putRes = await fetch(uploadUrl, { method: "PUT", body: file });
      if (!putRes.ok) throw new Error("Upload to Mux failed.");

      // The Mux webhook will flip processing_status to 'ready' once the
      // asset finishes transcoding — we don't wait for that here.
      router.push(`/profile`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-6 text-2xl">Post a clip</h1>

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
          <label className="mb-1 block text-xs uppercase text-frost-muted">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
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

        <div>
          <label className="mb-1 block text-xs uppercase text-frost-muted">Source</label>
          <div className="flex gap-2">
            {(["vanilla", "modded", "rp_server"] as ContentSource[]).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`rounded-sm border px-3 py-1 text-xs uppercase tracking-wide
                  ${source === s ? "border-neon-pink text-neon-pink" : "border-ink-line text-frost-muted"}`}
              >
                {s === "rp_server" ? "RP Server" : s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase text-frost-muted">Video file</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        {errorMsg && <p className="text-sm text-blood">{errorMsg}</p>}

        <button
          onClick={handleSubmit}
          disabled={status === "uploading"}
          className="btn-primary w-full disabled:opacity-50"
        >
          {status === "uploading" ? "Uploading…" : "Post"}
        </button>
      </div>
    </main>
  );
}
