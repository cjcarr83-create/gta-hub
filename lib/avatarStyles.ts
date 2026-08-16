// Client-safe trait enums/types, split out of lib/avatarGen.ts.
//
// This file has NO "server-only" import and does NOT contain the
// prompt-building or provider-calling logic — those stay in
// avatarGen.ts, which the onboarding page (a Client Component) must
// never import directly, since server-only throws a build error the
// moment a client bundle pulls it in. This file is what the client
// picker (app/onboarding/avatar/page.tsx) imports; avatarGen.ts is
// what the trusted API route imports.
//
// Every option here is a fixed, allow-listed token — never freeform
// text. This is the actual mitigation (not prompt wording) against two
// real risks:
//   1. Copyright: nothing in this project ever asks an image model to
//      draw a specific copyrighted Rockstar character, a real person,
//      or any likeness. There's no code path where a client string
//      reaches a prompt at all.
//   2. Prompt injection: a client can't smuggle instructions to the
//      image model through a "custom description" field, because
//      there isn't one.
export const SKIN_TONES = ["fair", "tan", "olive", "brown", "deep"] as const;
export const HAIR_STYLES = [
  "buzzcut", "slicked_back", "curly", "long_straight", "afro", "mohawk", "bald", "braids",
] as const;
export const HAIR_COLORS = ["black", "brown", "blonde", "red", "silver", "dyed_pink", "dyed_blue"] as const;
export const OUTFIT_STYLES = [
  "tracksuit", "hawaiian_shirt", "leather_jacket", "streetwear", "business_casual", "biker",
] as const;
export const ACCESSORIES = ["sunglasses", "gold_chain", "bandana", "cap", "none"] as const;
export const VIBES = ["chill", "chaotic", "high_roller", "street_racer", "outlaw", "wholesome"] as const;

export type SkinTone = (typeof SKIN_TONES)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type HairColor = (typeof HAIR_COLORS)[number];
export type OutfitStyle = (typeof OUTFIT_STYLES)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type Vibe = (typeof VIBES)[number];

export interface AvatarStyle {
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  outfit: OutfitStyle;
  accessory: Accessory;
  vibe: Vibe;
}

export function isValidAvatarStyle(value: unknown): value is AvatarStyle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    SKIN_TONES.includes(v.skinTone as SkinTone) &&
    HAIR_STYLES.includes(v.hairStyle as HairStyle) &&
    HAIR_COLORS.includes(v.hairColor as HairColor) &&
    OUTFIT_STYLES.includes(v.outfit as OutfitStyle) &&
    ACCESSORIES.includes(v.accessory as Accessory) &&
    VIBES.includes(v.vibe as Vibe)
  );
}
