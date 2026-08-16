// The Block — vehicles. Original top-down car shapes (canvas
// primitives), not any real make/model or another game's assets.
//
// Trust model: same as everything else in the world (see combat.ts).
// A driver's position/angle rides their own move broadcast; a parked
// car's last position is broadcast on exit and remembered by whoever
// was online to hear it. New joiners see cars at their spawn points
// until the next state event — accepted for a casual mode, noted in
// ROUND10_CHANGELOG.md.

export type VehicleId = "v1" | "v2" | "v3" | "v4" | "v5" | "v6";

export interface VehicleDef {
  id: VehicleId;
  name: string;
  color: string;
  spawnX: number;
  spawnY: number;
  spawnAngle: number; // radians, 0 = facing +x
  maxSpeed: number; // px/s
  accel: number; // px/s^2
}

// Spawns sit on road centerlines (see map.ts ROADS_X/Y).
export const VEHICLES: Record<VehicleId, VehicleDef> = {
  v1: { id: "v1", name: "Coupe", color: "#E14F63", spawnX: 400, spawnY: 120, spawnAngle: Math.PI / 2, maxSpeed: 520, accel: 380 },
  v2: { id: "v2", name: "Sedan", color: "#5B8FD9", spawnX: 1200, spawnY: 120, spawnAngle: Math.PI / 2, maxSpeed: 460, accel: 320 },
  v3: { id: "v3", name: "Muscle", color: "#F2A93B", spawnX: 150, spawnY: 500, spawnAngle: 0, maxSpeed: 560, accel: 420 },
  v4: { id: "v4", name: "Van", color: "#EDE6D6", spawnX: 1450, spawnY: 500, spawnAngle: Math.PI, maxSpeed: 400, accel: 260 },
  v5: { id: "v5", name: "Hatch", color: "#2FA89A", spawnX: 400, spawnY: 900, spawnAngle: -Math.PI / 2, maxSpeed: 480, accel: 340 },
  v6: { id: "v6", name: "Pickup", color: "#D97BC0", spawnX: 1200, spawnY: 900, spawnAngle: -Math.PI / 2, maxSpeed: 440, accel: 300 },
};

export const VEHICLE_LEN = 54;
export const VEHICLE_WID = 28;
export const VEHICLE_ENTER_RADIUS = 60;
export const VEHICLE_DRAG = 1.6; // per second (fraction of speed lost)
export const VEHICLE_STEER_RATE = 2.6; // rad/s at full speed factor
export const RUNOVER_MIN_SPEED = 220; // px/s
export const RUNOVER_RADIUS = 34;

export interface VehicleState {
  id: VehicleId;
  x: number;
  y: number;
  angle: number;
  occupiedBy: string | null;
}

export function initialVehicleStates(): Map<VehicleId, VehicleState> {
  const m = new Map<VehicleId, VehicleState>();
  for (const v of Object.values(VEHICLES)) {
    m.set(v.id, { id: v.id, x: v.spawnX, y: v.spawnY, angle: v.spawnAngle, occupiedBy: null });
  }
  return m;
}

export interface VehicleEnterPayload { vehicleId: VehicleId; by: string; ts: number }
export interface VehicleExitPayload { vehicleId: VehicleId; by: string; x: number; y: number; angle: number; ts: number }

export function drawVehicle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, angle: number,
  color: string,
  occupied: boolean
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-VEHICLE_LEN / 2 + 3, -VEHICLE_WID / 2 + 4, VEHICLE_LEN, VEHICLE_WID);
  // body
  ctx.fillStyle = color;
  ctx.fillRect(-VEHICLE_LEN / 2, -VEHICLE_WID / 2, VEHICLE_LEN, VEHICLE_WID);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-VEHICLE_LEN / 2, -VEHICLE_WID / 2, VEHICLE_LEN, VEHICLE_WID);
  // cabin / windshield
  ctx.fillStyle = "rgba(20,18,15,0.75)";
  ctx.fillRect(-VEHICLE_LEN / 2 + 14, -VEHICLE_WID / 2 + 4, 22, VEHICLE_WID - 8);
  // headlights (front = +x)
  ctx.fillStyle = occupied ? "#FFF3C4" : "rgba(255,243,196,0.35)";
  ctx.fillRect(VEHICLE_LEN / 2 - 4, -VEHICLE_WID / 2 + 3, 3, 6);
  ctx.fillRect(VEHICLE_LEN / 2 - 4, VEHICLE_WID / 2 - 9, 3, 6);
  // taillights
  ctx.fillStyle = "#C1373F";
  ctx.fillRect(-VEHICLE_LEN / 2 + 1, -VEHICLE_WID / 2 + 3, 3, 6);
  ctx.fillRect(-VEHICLE_LEN / 2 + 1, VEHICLE_WID / 2 - 9, 3, 6);
  ctx.restore();
}
