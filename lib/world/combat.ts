// The Block — combat layer.
//
// TRUST MODEL, stated plainly rather than implied: there is no
// authoritative game server here, same as movement (see presence.ts).
// Every client reports its own actions over Realtime Broadcast, and —
// critically — every client is the sole authority over its OWN health.
// An attacker broadcasts "I hit you," but the target's client decides
// whether to believe it: it checks the attacker was actually within
// weapon range of the target's own last-known position, and always
// uses THIS table's damage value for the claimed weapon (never a
// number the attacker's broadcast supplies). A modified client can
// still lie about its own position, or claim to be holding a weapon it
// never actually picked up (see ROUND9_CHANGELOG.md), but it can't
// one-shot someone from across the map or deal arbitrary damage. That
// ceiling is fine for a casual mode with a for-fun leaderboard; it
// would NOT be fine if anything with real stakes got attached to a win
// later (see the note on world_ko_log in the migrations).
//
// WEAPON DESIGN (Round 9): reskinned to realistic weapon names/roles
// per an explicit product decision to make The Block more intense, now
// gated behind ContentWarningGate.tsx before anyone enters. The visual
// designs drawn in WorldCanvas.tsx are still original abstract
// silhouettes — generic shapes, not traced from any real manufacturer's
// design or any existing game's specific weapon models — for the same
// copyright reasoning that governs the AI avatar prompts in
// lib/avatarGen.ts. Realistic in NAME and DAMAGE FEEL, not in visual
// fidelity or real-world operating instructions — nothing here teaches
// how a real weapon works.

export const MAX_HP = 100;
export const RESPAWN_DELAY_MS = 2500;
export const HIT_POSITION_TOLERANCE_PX = 40; // slack for network lag between move broadcasts

export type WeaponId = "fists" | "knife" | "pistol" | "shotgun" | "vehicle";

export interface WeaponDef {
  id: WeaponId;
  label: string;
  damage: number;
  range: number; // px
  cooldownMs: number;
  kind: "melee" | "ranged";
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fists: { id: "fists", label: "Fists", damage: 8, range: 46, cooldownMs: 700, kind: "melee" },
  knife: { id: "knife", label: "Knife", damage: 22, range: 56, cooldownMs: 850, kind: "melee" },
  pistol: { id: "pistol", label: "Pistol", damage: 16, range: 260, cooldownMs: 500, kind: "ranged" },
  shotgun: { id: "shotgun", label: "Shotgun", damage: 34, range: 150, cooldownMs: 1250, kind: "ranged" },
  // Not a pickup — assigned implicitly while driving (see vehicles.ts
  // RUNOVER_*). Range = runover radius; cooldown stops a car parked on
  // someone from ticking every frame.
  vehicle: { id: "vehicle", label: "Car", damage: 30, range: 40, cooldownMs: 800, kind: "melee" },
};

// Fixed pickup spawn points — simple and predictable rather than
// randomized, so the world feels learnable ("the shotgun is always by
// the docks") the way a small arcade map should. Purely visual/
// client-synced state (see WorldCanvas's pickup handling); nothing here
// is written to Postgres.
export interface WeaponPickupSpawn {
  id: string;
  x: number;
  y: number;
  weapon: WeaponId;
}

export const WEAPON_PICKUPS: WeaponPickupSpawn[] = [
  { id: "pickup-knife-1", x: 270, y: 210, weapon: "knife" },
  { id: "pickup-pistol-1", x: 1330, y: 280, weapon: "pistol" },
  { id: "pickup-pistol-2", x: 420, y: 830, weapon: "pistol" },
  { id: "pickup-shotgun-1", x: 1250, y: 800, weapon: "shotgun" },
  { id: "pickup-knife-2", x: 800, y: 500, weapon: "knife" },
];

export const PICKUP_RESPAWN_MS = 20_000;
export const PICKUP_RADIUS = 20;

export interface WorldHitPayload {
  attackerId: string;
  attackerUsername: string;
  targetId: string;
  weapon: WeaponId;
  attackerX: number;
  attackerY: number;
  ts: number;
}

export interface WorldHpUpdatePayload {
  userId: string;
  hp: number;
  // Where the hit that caused this update landed, so bystanders (and
  // the attacker, watching their own shot connect) can render the same
  // blood-splatter effect the target sees. Purely cosmetic — omitted
  // for a respawn's hp reset back to MAX_HP, where there's no hit to
  // render.
  hitX?: number;
  hitY?: number;
  ts: number;
}

export interface WorldKoPayload {
  attackerId: string;
  attackerUsername: string;
  targetId: string;
  targetUsername: string;
  weapon: WeaponId;
  x: number;
  y: number;
  ts: number;
}

export interface WorldPickupTakenPayload {
  pickupId: string;
  by: string;
  ts: number;
}

// Called ONLY by the target's own client, on receiving a WorldHitPayload
// addressed to them. This is the actual trust boundary described above
// — validates against the target's own knowledge of where the attacker
// last was, not anything the attacker's broadcast claims about itself
// beyond position and weapon id.
export function isPlausibleHit(
  hit: WorldHitPayload,
  targetX: number,
  targetY: number
): boolean {
  const weapon = WEAPONS[hit.weapon];
  if (!weapon) return false;
  const dist = Math.hypot(hit.attackerX - targetX, hit.attackerY - targetY);
  return dist <= weapon.range + HIT_POSITION_TOLERANCE_PX;
}
