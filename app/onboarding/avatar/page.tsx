"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SKIN_TONES,
  HAIR_STYLES,
  HAIR_COLORS,
  OUTFIT_STYLES,
  ACCESSORIES,
  VIBES,
  type AvatarStyle,
} from "@/lib/avatarStyles";

// Every field here maps directly to a fixed enum in lib/avatarGen.ts —
// there is deliberately no freeform "describe your character" field.
// See the comment at the top of that file for why.
const LABELS: Record<string, Record<string, string>> = {
  skinTone: { fair: "Fair", tan: "Tan", olive: "Olive", brown: "Brown", deep: "Deep" },
  hairStyle: {
    buzzcut: "Buzzcut",
    slicked_back: "Slicked back",
    curly: "Curly",
    long_straight: "Long & straight",
    afro: "Afro",
    mohawk: "Mohawk",
    bald: "Bald",
    braids: "Braids",
  },
  hairColor: {
    black: "Black",
    brown: "Brown",
    blonde: "Blonde",
    red: "Red",
    silver: "Silver",
    dyed_pink: "Pink",
    dyed_blue: "Blue",
  },
  outfit: {
    tracksuit: "Tracksuit",
    hawaiian_shirt: "Hawaiian shirt",
    leather_jacket: "Leather jacket",
    streetwear: "Streetwear",
    business_casual: "Business casual",
    biker: "Biker",
  },
  accessory: {
    sunglasses: "Sunglasses",
    gold_chain: "Gold chain",
    bandana: "Bandana",
    cap: "Cap",
    none: "None",
  },
  vibe: {
    chill: "Chill",
    chaotic: "Chaotic",
    high_roller: "High roller",
    street_racer: "Street racer",
    outlaw: "Outlaw",
    wholesome: "Wholesome",
  },
};

function TraitPicker<T extends string>({
  label,
  traitKey,
  options,
  value,
  onChange,
}: {
  label: string;
  traitKey: keyof AvatarStyle;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase text-sand-muted">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-sm border px-3 py-1 text-xs
              ${value === opt ? "border-sunset-amber text-sunset-amber" : "border-asphalt-line text-sand-muted"}`}
          >
            {LABELS[traitKey]?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AvatarOnboardingPage() {
  const router = useRouter();
  const [style, setStyle] = useState<AvatarStyle>({
    skinTone: "tan",
    hairStyle: "slicked_back",
    hairColor: "black",
    outfit: "hawaiian_shirt",
    accessory: "sunglasses",
    vibe: "chill",
  });
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  function set<K extends keyof AvatarStyle>(key: K, value: AvatarStyle[K]) {
    setStyle((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    setStatus("generating");
    setErrorMsg("");
    setResultUrl(null);
    try {
      const res = await fetch("/api/profile/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not generate an avatar.");
      setResultUrl(data.imageUrl);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <main className="px-4 pt-6 pb-24">
      <h1 className="mb-1 text-2xl">Build your character</h1>
      <p className="mb-6 text-sm text-sand-muted">
        Pick your look — this becomes your profile picture and your avatar
        in The Block.
      </p>

      {resultUrl && (
        <div className="card mb-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resultUrl}
            alt="Your generated character"
            className="mx-auto mb-3 h-32 w-32 rounded-full object-cover"
          />
          <button onClick={() => router.push("/profile")} className="btn-primary w-full">
            Looks good — continue
          </button>
        </div>
      )}

      <div className="card space-y-4">
        <TraitPicker label="Skin tone" traitKey="skinTone" options={SKIN_TONES} value={style.skinTone} onChange={(v) => set("skinTone", v)} />
        <TraitPicker label="Hair style" traitKey="hairStyle" options={HAIR_STYLES} value={style.hairStyle} onChange={(v) => set("hairStyle", v)} />
        <TraitPicker label="Hair color" traitKey="hairColor" options={HAIR_COLORS} value={style.hairColor} onChange={(v) => set("hairColor", v)} />
        <TraitPicker label="Outfit" traitKey="outfit" options={OUTFIT_STYLES} value={style.outfit} onChange={(v) => set("outfit", v)} />
        <TraitPicker label="Accessory" traitKey="accessory" options={ACCESSORIES} value={style.accessory} onChange={(v) => set("accessory", v)} />
        <TraitPicker label="Vibe" traitKey="vibe" options={VIBES} value={style.vibe} onChange={(v) => set("vibe", v)} />

        {errorMsg && <p className="text-sm text-blood">{errorMsg}</p>}

        <button
          onClick={handleGenerate}
          disabled={status === "generating"}
          className="btn-primary w-full disabled:opacity-50"
        >
          {status === "generating" ? "Generating…" : resultUrl ? "Regenerate" : "Generate my character"}
        </button>
      </div>
    </main>
  );
}
