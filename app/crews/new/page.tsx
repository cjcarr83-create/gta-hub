"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCrewPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [colorHex, setColorHex] = useState("#F2A93B");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCreate() {
    if (name.trim().length < 3) {
      setErrorMsg("Crew name needs to be at least 3 characters.");
      return;
    }
    setStatus("submitting");
    setErrorMsg("");

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg("Sign in first.");
      setStatus("error");
      return;
    }

    const { data: crew, error } = await supabase
      .from("crews")
      .insert({
        name: name.trim(),
        motto: motto.trim() || null,
        color_hex: colorHex,
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (error || !crew) {
      setErrorMsg(error?.message ?? "Could not create crew.");
      setStatus("error");
      return;
    }

    // Join the crew you just founded.
    await supabase.from("profiles").update({ crew_id: crew.id }).eq("id", user.id);

    router.push(`/crews/${crew.id}`);
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-6 text-2xl">Start a crew</h1>
      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase text-sand-muted">Crew name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full rounded border border-asphalt-line bg-asphalt px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase text-sand-muted">Motto</label>
          <input
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            className="w-full rounded border border-asphalt-line bg-asphalt px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase text-sand-muted">Crew colour</label>
          <input
            type="color"
            value={colorHex}
            onChange={(e) => setColorHex(e.target.value)}
            className="h-10 w-16 rounded border border-asphalt-line bg-asphalt"
          />
        </div>
        {errorMsg && <p className="text-sm text-blood">{errorMsg}</p>}
        <button
          onClick={handleCreate}
          disabled={status === "submitting"}
          className="btn-primary w-full disabled:opacity-50"
        >
          {status === "submitting" ? "Creating…" : "Create crew"}
        </button>
      </div>
    </main>
  );
}
