// The Block — missions. Definitions are static and shared; progress
// is tracked client-side and only the COMPLETION is written to the
// database (world_mission_completions), where a trigger sums rep onto
// the profile. Same self-reported trust model as combat — a modified
// client could claim a completion it didn't earn. RLS caps how often
// (see migration 0005), and rep is bragging rights, not currency.

export type MissionId =
  | "delivery_docks"
  | "delivery_hills"
  | "hitlist_3"
  | "hold_plaza"
  | "hold_north"
  | "joyride_loop";

export type MissionKind = "delivery" | "hitlist" | "hold" | "joyride";

export interface MissionDef {
  id: MissionId;
  kind: MissionKind;
  title: string;
  brief: string;
  rep: number;
  // kind-specific
  pickup?: { x: number; y: number };
  dropoff?: { x: number; y: number };
  kills?: number;
  turfId?: string;
  holdMs?: number;
  checkpoints?: Array<{ x: number; y: number }>;
}

export const MISSIONS: Record<MissionId, MissionDef> = {
  delivery_docks: {
    id: "delivery_docks", kind: "delivery", title: "Dock Run",
    brief: "Grab the package in Northside and get it to the Docks. On foot or wheels — your call.",
    rep: 50, pickup: { x: 600, y: 120 }, dropoff: { x: 200, y: 700 },
  },
  delivery_hills: {
    id: "delivery_hills", kind: "delivery", title: "Hills Drop",
    brief: "Package waiting Downtown. Deliver it up to the Hills Villa.",
    rep: 60, pickup: { x: 1000, y: 880 }, dropoff: { x: 1400, y: 300 },
  },
  hitlist_3: {
    id: "hitlist_3", kind: "hitlist", title: "Hit List",
    brief: "Take out three people. Anyone not in your crew counts.",
    rep: 120, kills: 3,
  },
  hold_plaza: {
    id: "hold_plaza", kind: "hold", title: "Hold the Plaza",
    brief: "Stay inside Downtown Plaza for 30 seconds without dying.",
    rep: 70, turfId: "turf_plaza", holdMs: 30_000,
  },
  hold_north: {
    id: "hold_north", kind: "hold", title: "Hold North Lot",
    brief: "Stay inside North Lot for 30 seconds without dying.",
    rep: 70, turfId: "turf_north_lot", holdMs: 30_000,
  },
  joyride_loop: {
    id: "joyride_loop", kind: "joyride", title: "Joyride",
    brief: "Get a car and hit all four checkpoints. Order doesn't matter.",
    rep: 90,
    checkpoints: [{ x: 400, y: 250 }, { x: 1200, y: 250 }, { x: 1200, y: 750 }, { x: 400, y: 750 }],
  },
};

export const MISSION_COOLDOWN_MS = 5 * 60_000; // must match RLS interval in 0005
export const OBJECTIVE_RADIUS = 46;

export interface ActiveMission {
  id: MissionId;
  startedAt: number;
  // progress
  hasPackage?: boolean;
  kills?: number;
  holdAccumMs?: number;
  checkpointsHit?: number[]; // indices
}

export function missionProgressText(m: ActiveMission): string {
  const def = MISSIONS[m.id];
  switch (def.kind) {
    case "delivery": return m.hasPackage ? "Deliver the package" : "Pick up the package";
    case "hitlist": return `Kills: ${m.kills ?? 0}/${def.kills}`;
    case "hold": return `Hold: ${Math.min(def.holdMs!, m.holdAccumMs ?? 0) / 1000 | 0}s / ${def.holdMs! / 1000}s`;
    case "joyride": return `Checkpoints: ${(m.checkpointsHit ?? []).length}/${def.checkpoints!.length}`;
  }
}

export function missionMarker(m: ActiveMission): { x: number; y: number } | null {
  const def = MISSIONS[m.id];
  switch (def.kind) {
    case "delivery": return m.hasPackage ? def.dropoff! : def.pickup!;
    case "hitlist": return null;
    case "hold": return null; // turf zone is already drawn
    case "joyride": {
      const hit = new Set(m.checkpointsHit ?? []);
      const idx = def.checkpoints!.findIndex((_, i) => !hit.has(i));
      return idx >= 0 ? def.checkpoints![idx]! : null;
    }
  }
}
