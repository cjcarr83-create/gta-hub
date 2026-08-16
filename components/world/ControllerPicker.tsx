"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CONTROLLER_SCHEMES, type ControllerScheme } from "@/lib/world/controller";

export default function ControllerPicker({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: ControllerScheme;
  onChange: (s: ControllerScheme) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function pick(scheme: ControllerScheme) {
    onChange(scheme); // optimistic — pure UI preference, no harm if the save fails
    setSaving(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ controller_scheme: scheme }).eq("id", userId);
    setSaving(false);
  }

  return (
    <div className="mb-3 flex items-center gap-2 text-xs">
      <span className="text-sand-muted">Controls:</span>
      {(Object.keys(CONTROLLER_SCHEMES) as ControllerScheme[]).map((id) => (
        <button
          key={id}
          onClick={() => pick(id)}
          disabled={saving}
          title={CONTROLLER_SCHEMES[id].description}
          className={`rounded-sm border px-2 py-1 ${
            value === id ? "border-sunset-amber text-sunset-amber" : "border-asphalt-line text-sand-muted"
          }`}
        >
          {CONTROLLER_SCHEMES[id].label}
        </button>
      ))}
    </div>
  );
}
