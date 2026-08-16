// The Block — shared open-world real-time layer.
//
// Deliberately built on two DIFFERENT Supabase Realtime primitives for
// two different jobs, rather than one channel doing everything:
//
//   - Presence: "who's in the room right now" — roster, joins/leaves,
//     each player's static info (username, avatar). Supabase keeps this
//     in sync automatically and fires sync/join/leave events, so it's
//     the right tool for a roster, not for 10-times-a-second movement.
//   - Broadcast: high-frequency, fire-and-forget events — movement and
//     chat bubbles. Never persisted, never awaited, just relayed to
//     everyone else subscribed to the channel. This is what keeps
//     position updates cheap: they never touch Postgres at all (see the
//     comment on world_chat_log in 0002_avatars_and_world.sql for why
//     only chat gets a durable row and movement doesn't).
//
// A single global room ("world:global") is the whole MVP. The natural
// next step once this needs to hold more than a few dozen concurrent
// players in view of each other is sharding into districts (e.g.
// "world:vinewood", "world:docks") — noted here rather than built,
// since it's a real capacity/product decision (how do you group
// players, what happens when a district fills up) not a quick patch.

import type { WeaponId } from "@/lib/world/combat";
import type { VehicleId } from "@/lib/world/vehicles";

export const WORLD_CHANNEL = "world:global";

// Logical world size in pixels — the coordinate space players move
// around in, independent of the canvas's rendered/CSS size (WorldCanvas
// scales between the two so this works the same on phone and desktop).
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;
export const PLAYER_RADIUS = 22;
export const MOVE_SPEED = 220; // px/sec
export const PROXIMITY_CHAT_RADIUS = 220; // px — "nearby" chat range
export const BROADCAST_INTERVAL_MS = 80; // ~12.5 updates/sec while moving

export interface WorldPresenceMeta {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
  // Crews (built in earlier rounds) ARE the world's gang system —
  // rather than invent a separate "team" concept, a player's existing
  // crew membership drives their color ring in the world and blocks
  // friendly fire (see lib/world/combat.ts). No new schema needed.
  crewId: string | null;
  crewName: string | null;
  crewColorHex: string | null;
}

export interface WorldMovePayload {
  userId: string;
  x: number;
  y: number;
  weapon: WeaponId;
  // Set while driving: which car, and its heading. Remote clients draw
  // the car at this player's position and hide the on-foot avatar.
  vehicleId: VehicleId | null;
  angle: number;
  ts: number;
}

export interface WorldChatPayload {
  userId: string;
  username: string;
  text: string;
  scope: "district" | "nearby";
  ts: number;
}

export function clampToWorld(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH - PLAYER_RADIUS, x)),
    y: Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, y)),
  };
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function randomSpawnPoint(): { x: number; y: number } {
  return {
    x: PLAYER_RADIUS + Math.random() * (WORLD_WIDTH - PLAYER_RADIUS * 2),
    y: PLAYER_RADIUS + Math.random() * (WORLD_HEIGHT - PLAYER_RADIUS * 2),
  };
}
