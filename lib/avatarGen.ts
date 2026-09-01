import "server-only";
import { createTrustedClient } from "@/lib/supabase/trusted";
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
    "Art direction: neon Vice City open-world crime-drama aesthetic —",
    "moody night-time color grade, hot pink-to-electric-violet neon",
    "lighting accents, slightly graphic/poster-illustration rendering",
    "rather than photoreal.",
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

// ---------- PROVIDER: Google Gemini (free tier) ----------
// Chosen specifically because it's the only image-generation API with a
// genuine ongoing free tier (not just trial credits) suitable for a
// hobby-scale, rate-limited feature like this one (see
// RATE_LIMIT_MAX_GENERATIONS in the route — 5/user/hour). On the free
// tier, prompts/images may be used by Google to improve their products;
// that's an acceptable trade-off here since every prompt is built from
// a fixed, non-identifying trait list (see the copyright/injection note
// at the top of avatarStyles.ts) — never a user photo or real likeness.
//
// Gemini's generateContent endpoint returns image bytes inline (base64),
// not a hosted URL, so this uploads the result to a public Supabase
// Storage bucket ("avatars") and returns that public URL — keeping the
// contract below (a hosted image URL) the same as any other provider.
const GEMINI_MODEL = process.env.AVATAR_GEMINI_MODEL ?? "gemini-2.5-flash-image";

// Contract: given a validated AvatarStyle and the requesting user's id
// (used only to namespace the storage path), return a hosted image URL
// (or a failure). Must resolve synchronously from the caller's
// perspective — app/api/profile/generate-avatar/route.ts awaits this
// directly rather than polling. If a future provider is async/webhook-
// based instead, don't force it synchronous here — give
// avatar_generations.status a 'pending' row immediately, return that to
// the client, add a webhook route under app/api/webhooks/, and have the
// client poll the generation row the same way app/upload/page.tsx
// doesn't wait on Mux processing today.
export async function generateAvatarImage(
  style: AvatarStyle,
  userId: string
): Promise<AvatarGenerationResult | AvatarGenerationFailure> {
  const apiKey = process.env.AVATAR_PROVIDER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "No image generation provider configured. Set AVATAR_PROVIDER_API_KEY " +
        "to a Gemini API key from aistudio.google.com/apikey.",
    };
  }

  const prompt = buildPrompt(style);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> };
      }>;
    };
    const parts = data.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p) => p.inlineData?.data);

    if (!imagePart?.inlineData) {
      throw new Error("Gemini response did not include image data.");
    }

    const { mimeType, data: base64 } = imagePart.inlineData;
    const bytes = Buffer.from(base64, "base64");
    const ext = mimeType === "image/jpeg" ? "jpg" : "png";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const trusted = createTrustedClient();
    const { error: uploadError } = await trusted.storage
      .from("avatars")
      .upload(path, bytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      throw new Error(`Could not store generated avatar: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = trusted.storage.from("avatars").getPublicUrl(path);

    return { ok: true, imageUrl: publicUrl, provider: "gemini" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Generation failed." };
  }
}
