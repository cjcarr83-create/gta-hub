// The Block — city map. Original layout and art (canvas primitives in
// GTAHUB's own palette); nothing here is traced from any existing
// game's map. Coordinates are in world px (see presence.ts).
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/lib/world/presence";

export const ROAD_W = 70;
export const ROADS_X = [400, 800, 1200]; // vertical road centerlines
export const ROADS_Y = [250, 500, 750]; // horizontal road centerlines

export interface District {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export const DISTRICTS: District[] = [
  { id: "northside", name: "Northside", x: 0, y: 0, w: 800, h: 500 },
  { id: "hills", name: "The Hills", x: 800, y: 0, w: 800, h: 500 },
  { id: "docks", name: "The Docks", x: 0, y: 500, w: 800, h: 500 },
  { id: "downtown", name: "Downtown", x: 800, y: 500, w: 800, h: 500 },
];

export function districtAt(x: number, y: number): District {
  return DISTRICTS.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) ?? DISTRICTS[0]!;
}

// Turf zones — one per district. Crews capture these (see turf logic
// in WorldCanvas and world_turf in migration 0005).
export interface TurfZone {
  id: string;
  name: string;
  x: number;
  y: number;
  r: number;
}
export const TURF_ZONES: TurfZone[] = [
  { id: "turf_north_lot", name: "North Lot", x: 200, y: 120, r: 70 },
  { id: "turf_hills_villa", name: "Hills Villa", x: 1400, y: 120, r: 70 },
  { id: "turf_dock_yard", name: "Dock Yard", x: 200, y: 880, r: 70 },
  { id: "turf_plaza", name: "Downtown Plaza", x: 1400, y: 880, r: 70 },
];
export const TURF_CAPTURE_MS = 20_000;

// Buildings fill the blocks between roads, leaving sidewalks.
export interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  shade: number; // 0..1 variation
}
function buildBuildings(): Building[] {
  const xs = [0, ...ROADS_X, WORLD_WIDTH];
  const ys = [0, ...ROADS_Y, WORLD_HEIGHT];
  const out: Building[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i]! + (i === 0 ? 0 : ROAD_W / 2) + 18;
      const bx1 = xs[i + 1]! - (i + 1 === xs.length - 1 ? 0 : ROAD_W / 2) - 18;
      const by0 = ys[j]! + (j === 0 ? 0 : ROAD_W / 2) + 18;
      const by1 = ys[j + 1]! - (j + 1 === ys.length - 1 ? 0 : ROAD_W / 2) - 18;
      // skip blocks that host a turf zone center (keep them open plazas)
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      if (TURF_ZONES.some((t) => Math.hypot(t.x - cx, t.y - cy) < 200)) continue;
      // two buildings per block with a gap
      const gap = 30;
      const w = bx1 - bx0, h = by1 - by0;
      if (rnd() > 0.5) {
        out.push({ x: bx0, y: by0, w: (w - gap) / 2, h, shade: rnd() });
        out.push({ x: bx0 + (w + gap) / 2, y: by0, w: (w - gap) / 2, h, shade: rnd() });
      } else {
        out.push({ x: bx0, y: by0, w, h: (h - gap) / 2, shade: rnd() });
        out.push({ x: bx0, y: by0 + (h + gap) / 2, w, h: (h - gap) / 2, shade: rnd() });
      }
    }
  }
  return out;
}
export const BUILDINGS: Building[] = buildBuildings();

export function isInsideBuilding(x: number, y: number, pad = 0): boolean {
  return BUILDINGS.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);
}

const C = {
  ground: "#1A1713",
  road: "#0F0E0C",
  lane: "rgba(237,230,214,0.18)",
  curb: "#2C2822",
  bldgA: "#221E19",
  bldgB: "#2A251F",
  sand: "#EDE6D6",
};

export function drawCity(ctx: CanvasRenderingContext2D, turfOwners: Map<string, string | null>) {
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // roads
  ctx.fillStyle = C.road;
  for (const x of ROADS_X) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_HEIGHT);
  for (const y of ROADS_Y) ctx.fillRect(0, y - ROAD_W / 2, WORLD_WIDTH, ROAD_W);
  // curbs
  ctx.strokeStyle = C.curb;
  ctx.lineWidth = 2;
  for (const x of ROADS_X) { ctx.strokeRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_HEIGHT); }
  for (const y of ROADS_Y) { ctx.strokeRect(0, y - ROAD_W / 2, WORLD_WIDTH, ROAD_W); }
  // lane markings
  ctx.strokeStyle = C.lane;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  for (const x of ROADS_X) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); }
  for (const y of ROADS_Y) { ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); }
  ctx.stroke();
  ctx.setLineDash([]);

  // turf zones (under buildings so pads read as ground)
  for (const t of TURF_ZONES) {
    const owner = turfOwners.get(t.id) ?? null;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fillStyle = owner ? hexToRgba(owner, 0.18) : "rgba(237,230,214,0.06)";
    ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = owner ?? "rgba(237,230,214,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(237,230,214,0.6)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t.name.toUpperCase(), t.x, t.y - t.r - 6);
  }

  // buildings
  for (const b of BUILDINGS) {
    ctx.fillStyle = b.shade > 0.5 ? C.bldgA : C.bldgB;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = C.curb;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // rooftop detail
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
  }

  // district labels
  ctx.fillStyle = "rgba(237,230,214,0.12)";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "left";
  for (const d of DISTRICTS) ctx.fillText(d.name.toUpperCase(), d.x + 24, d.y + 40);
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  self: { x: number; y: number },
  others: Array<{ x: number; y: number; color: string }>,
  turfOwners: Map<string, string | null>,
  marker: { x: number; y: number } | null
) {
  const sx = w / WORLD_WIDTH, sy = h / WORLD_HEIGHT;
  ctx.save();
  ctx.fillStyle = "rgba(15,14,12,0.85)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#2C2822";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#3a352d";
  for (const rx of ROADS_X) ctx.fillRect(x + (rx - ROAD_W / 2) * sx, y, ROAD_W * sx, h);
  for (const ry of ROADS_Y) ctx.fillRect(x, y + (ry - ROAD_W / 2) * sy, w, ROAD_W * sy);
  for (const t of TURF_ZONES) {
    ctx.fillStyle = turfOwners.get(t.id) ?? "rgba(237,230,214,0.25)";
    ctx.beginPath(); ctx.arc(x + t.x * sx, y + t.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const o of others) {
    ctx.fillStyle = o.color;
    ctx.fillRect(x + o.x * sx - 1.5, y + o.y * sy - 1.5, 3, 3);
  }
  if (marker) {
    ctx.strokeStyle = "#F2A93B"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + marker.x * sx, y + marker.y * sy, 4, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = "#F2A93B";
  ctx.beginPath(); ctx.arc(x + self.x * sx, y + self.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function hexToRgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(237,230,214,${a})`;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
