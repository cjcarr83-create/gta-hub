import "server-only";
import type { AvatarStyle, HairStyle, OutfitStyle, Accessory, Vibe } from "@/lib/avatarStyles";

export type { AvatarStyle } from "@/lib/avatarStyles";
export { isValidAvatarStyle } from "@/lib/avatarStyles";

// Human-readable trait phrases, kept deliberately generic/original —
// "hawaiian_shirt" and "gold_chain" describe clothing, not any
// copyrighted design. The overall direction ("sun-bleached open-world
// crime-drama city") matches GTAHUB's own established visual identity
// (see tailwind.config.ts) rather than referencing Rockstar's IP by
// name, on the same reasoning as the rest of this project's copyright
// posture (see README / ROUND6_CHANGELOG's YouTube-embed section).
const HAIR_STYLE_PHRASE: Record<HairStyle, string> = {
  buzzcut: "a short buzzcut",
  slicked_back: "slicked-back hair",
  curly: "curly hair",
  long_straight: "long straight hair",
  afro: "a rounded afro",
  mohawk: "a mohawk",
  bald: "a bald head",
  braids: "braided hair",
};

const OUTFIT_PHRASE: Record<OutfitStyle, string> = {
  tracksuit: "a colorful tracksuit",
  hawaiian_shirt: "an open hawaiian shirt over a tank top",
  leather_jacket: "a leather jacket",
  streetwear: "modern streetwear with a graphic hoodie",
  business_casual: "a linen blazer, open collar",
  biker: "a biker vest with patches",
};

const ACCESSORY_PHRASE: Record<Accessory, string> = {
  sunglasses: ", wearing reflective sunglasses",
  gold_chain: ", wearing a thick gold chain",
  bandana: ", wearing a bandana",
  cap: ", wearing a backwards cap",
  none: "",
};

const VIBE_PHRASE: Record<Vibe, string> = {
  chill: "a relaxed, easygoing expression",
  chaotic: "a mischievous grin",
  high_roller: "a confident, upscale demeanor",
  street_racer: "a focused, adrenaline-charged look",
  outlaw: "a hardened, wanted-poster stare",
  wholesome: "a warm, friendly smile",
};

// Deliberately NOT exported — the prompt string itself is an
// implementation detail of whichever provider is wired up below, not
// something any route should construct independently.
function buildPrompt(style: AvatarStyle): string {
  return [
    "Original stylized digital illustration of a fictional character portrait,",
    "bust-up, square composition, centered, plain gradient background.",
    `Skin tone: ${style.skinTone}.`,
    `${HAIR_STYLE_PHRASE[style.hairStyle]}, ${style.hairColor} hair color.`,
    `Wearing ${OUTFIT_PHRASE[style.outfit]}${ACCESSORY_PHRASE[style.accessory]}.`,
    `Expression: ${VIBE_PHRASE[style.vibe]}.`,
    "Art direction: sun-bleached open-world crime-drama city aesthetic —",
    "warm dusk color grade, amber-to-magenta gradient lighting, slightly",
    "graphic/poster-illustration rendering rather than photoreal.",
    "This is an original character design, not a depiction of any real",
    "person or any existing copyrighted character.",
  ].join(" ");
}

export interface AvatarGenerationResult {
  ok: true;
  imageUrl: string;
  provider: string;
}
export interface AvatarGenerationFailure {
  ok: false;
  error: string;
}

// ---------- PROVIDER ----------
// Deliberately left as a documented stub rather than hard-wiring a
// specific vendor: image-gen provider choice is a cost/speed/licensing
// decision (OpenAI's Images API, Replicate-hosted SDXL, Stability,
// etc.), not something to lock in silently. Whichever is chosen,
// implement it here — everything upstream (the route, the rate limit,
// the trait validation) is already provider-agnostic and won't need to
// change.
//
// Contract: given a validated AvatarStyle, return a hosted image URL
// (or throw/return a failure). Must resolve synchronously from the
// caller's perspective — app/api/profile/generate-avatar/route.ts
// awaits this directly rather than polling, same as any provider whose
// API returns the image inline. If the provider you wire up is
// webhook/async instead (submit job → webhook delivers result later,
// like Mux), don't force it synchronous here — instead give
// avatar_generations.status a 'pending' row immediately, return that
// to the client, add a webhook route under app/api/webhooks/, and
// have the client poll GET the generation row the same way
// app/upload/page.tsx doesn't wait on Mux processing today.
export async function generateAvatarImage(
  style: AvatarStyle
): Promise<AvatarGenerationResult | AvatarGenerationFailure> {
  const apiKey = process.env.AVATAR_PROVIDER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "No image generation provider configured. Set AVATAR_PROVIDER_API_KEY " +
        "and implement the call in lib/avatarGen.ts (generateAvatarImage).",
    };
  }

  const prompt = buildPrompt(style);

  try {
    // Example shape for a synchronous provider — replace with whichever
    // vendor you choose. Left unimplemented on purpose rather than
    // guessing at an API contract for a vendor you haven't picked yet.
    throw new Error(
      "generateAvatarImage() provider call not yet implemented — see the " +
        "comment above this function. Prompt was built successfully: " +
        JSON.stringify({ promptPreview: prompt.slice(0, 60) + "…" })
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
  }
}
