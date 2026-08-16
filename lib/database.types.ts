// Hand-written to match supabase/migrations/0001_init.sql.
// Once the project is running against a real Supabase instance, regenerate
// with: npx supabase gen types typescript --project-id <id> > lib/database.types.ts

export type ContentCategory =
  | "stunts"
  | "heists"
  | "rp"
  | "chaos"
  | "races"
  | "builds"
  | "guides";

export type ContentSource = "vanilla" | "modded" | "rp_server";
export type AccountState = "active" | "restricted" | "suspended" | "banned";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  account_state: AccountState;
  crew_id: string | null;
  wanted_level: number;
  radio_station: string | null;
  is_verified: boolean;
  verified_at: string | null;
  // Round 7 — AI character avatars. avatar_style holds the trait-picker
  // choices (see lib/avatarGen.ts); avatar_generation_status mirrors
  // real provider state and is trusted-only, same REVOKE/GRANT pattern
  // as is_verified/account_state above.
  avatar_style: Record<string, string> | null;
  avatar_generation_status: "none" | "pending" | "ready" | "failed";
  // Round 9 — self-attested acknowledgment of The Block's graphic
  // content warning (see components/world/ContentWarningGate.tsx).
  // null until the person has clicked through it once.
  violence_ack_at: string | null;
  // Round 9 — virtual controller layout preference for The Block.
  controller_scheme: "shapes" | "letters" | "minimal";
  // Round 10 — trusted-only, summed by DB triggers from mission
  // completions and KOs.
  rep: number;
  created_at: string;
}

export interface Crew {
  id: string;
  name: string;
  motto: string | null;
  emblem_url: string | null;
  color_hex: string | null;
  owner_id: string;
  recruitment_status: "open" | "closed";
  created_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  crew_id: string | null;
  title: string;
  description: string | null;
  category: ContentCategory;
  source: ContentSource;
  location_tag: string | null;
  mux_asset_id: string | null;
  mux_upload_id: string | null;
  playback_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  processing_status: "uploading" | "processing" | "ready" | "failed";
  view_count: number;
  is_public: boolean;
  moderation_status: "visible" | "flagged" | "removed";
  created_at: string;
  // Joined
  profiles?: Pick<Profile, "username" | "avatar_url" | "wanted_level" | "is_verified">;
}

export interface Stream {
  id: string;
  user_id: string;
  crew_id: string | null;
  title: string;
  category: ContentCategory;
  mux_stream_id: string | null;
  mux_playback_id: string | null;
  status: "idle" | "live" | "ended";
  viewer_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, "username" | "avatar_url">;
}

export interface GarageBuild {
  id: string;
  user_id: string;
  vehicle_name: string;
  livery_description: string | null;
  performance_class: string | null;
  photo_url: string | null;
  video_id: string | null;
  caption: string | null;
  created_at: string;
}

export interface Tip {
  id: string;
  tipper_id: string | null;
  creator_id: string;
  video_id: string | null;
  stream_id: string | null;
  amount_cents: number;
  currency: string;
  message: string | null;
  // Kept in sync with the `tips.status` check constraint in
  // supabase/migrations/0001_init.sql — 'partially_refunded' was
  // previously missing here even though the Stripe webhook
  // (app/api/webhooks/stripe/route.ts) actively sets it.
  status: "pending" | "succeeded" | "failed" | "partially_refunded" | "refunded" | "disputed";
  created_at: string;
}

// Minimal Supabase generic Database shape — expand as needed with the
// generated types once a live project exists.
export type Database = Record<string, unknown>;
