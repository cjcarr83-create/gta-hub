"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { type JoystickVector } from "@/components/world/TouchJoystick";
import VirtualController from "@/components/world/VirtualController";
import type { ControllerScheme } from "@/lib/world/controller";
import {
  WORLD_CHANNEL,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PLAYER_RADIUS,
  MOVE_SPEED,
  PROXIMITY_CHAT_RADIUS,
  BROADCAST_INTERVAL_MS,
  clampToWorld,
  distance,
  randomSpawnPoint,
  type WorldPresenceMeta,
  type WorldMovePayload,
  type WorldChatPayload,
} from "@/lib/world/presence";
import {
  MAX_HP,
  RESPAWN_DELAY_MS,
  WEAPONS,
  WEAPON_PICKUPS,
  PICKUP_RESPAWN_MS,
  PICKUP_RADIUS,
  isPlausibleHit,
  type WeaponId,
  type WorldHitPayload,
  type WorldHpUpdatePayload,
  type WorldKoPayload,
  type WorldPickupTakenPayload,
} from "@/lib/world/combat";
import { drawCity, drawMinimap, districtAt, isInsideBuilding, TURF_ZONES, TURF_CAPTURE_MS } from "@/lib/world/map";
import {
  VEHICLES, VEHICLE_ENTER_RADIUS, VEHICLE_DRAG, VEHICLE_STEER_RATE, RUNOVER_MIN_SPEED, RUNOVER_RADIUS,
  initialVehicleStates, drawVehicle,
  type VehicleId, type VehicleState, type VehicleEnterPayload, type VehicleExitPayload,
} from "@/lib/world/vehicles";
import {
  MISSIONS, OBJECTIVE_RADIUS, missionMarker, missionProgressText,
  type ActiveMission, type MissionId,
} from "@/lib/world/missions";

interface DamagePopup {
  text: string;
  startedAt: number;
}

interface RemotePlayer {
  meta: WorldPresenceMeta;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lastUpdate: number;
  bubble: { text: string; expiresAt: number } | null;
  hp: number;
  downedUntil: number;
  popups: DamagePopup[];
  currentWeapon: WeaponId;
  vehicleId: VehicleId | null;
  angle: number;
}

const COLORS = {
  ink: "#0B0712",
  panel: "#170F26",
  line: "#2E2545",
  sand: "#F5F1FA",
  amber: "#FF2E93",
  magenta: "#7C4DFF",
  teal: "#22D3EE",
  blood: "#FF3B4E",
};

const avatarImageCache = new Map<string, HTMLImageElement>();

function getAvatarImage(url: string): HTMLImageElement {
  let img = avatarImageCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    avatarImageCache.set(url, img);
  }
  return img;
}

// Simple original glyphs — not traced from any real manufacturer's
// design or any existing game's weapon models. Abstract, generic
// silhouettes (a blade shape, a boxy grip-and-barrel shape) rather
// than a realistic rendering — same reasoning as the AI avatar prompts
// in lib/avatarGen.ts. See ROUND9_CHANGELOG.md.
function drawWeaponGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, weapon: WeaponId) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = COLORS.sand;
  ctx.fillStyle = COLORS.sand;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  if (weapon === "knife") {
    ctx.beginPath();
    ctx.moveTo(-8, 8);
    ctx.lineTo(6, -8);
    ctx.lineTo(9, -8);
    ctx.lineTo(-5, 11);
    ctx.closePath();
    ctx.fill();
  } else if (weapon === "pistol") {
    ctx.fillRect(-9, -3, 14, 6);
    ctx.fillRect(-4, 2, 5, 8);
  } else if (weapon === "shotgun") {
    ctx.fillRect(-12, -3, 22, 5);
    ctx.fillRect(-13, -6, 6, 10);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

interface BloodParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  startedAt: number;
}

interface BloodPool {
  x: number;
  y: number;
  radius: number;
  startedAt: number;
}

const BLOOD_PARTICLE_LIFETIME_MS = 550;
const BLOOD_POOL_LIFETIME_MS = 6000;

function drawBloodParticles(ctx: CanvasRenderingContext2D, particles: BloodParticle[], now: number) {
  for (const p of particles) {
    const age = now - p.startedAt;
    if (age > BLOOD_PARTICLE_LIFETIME_MS) continue;
    const t = age / 1000;
    const px = p.x + p.vx * t;
    const py = p.y + p.vy * t + 60 * t * t; // slight gravity arc
    ctx.globalAlpha = Math.max(0, 1 - age / BLOOD_PARTICLE_LIFETIME_MS);
    ctx.fillStyle = COLORS.blood;
    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBloodPools(ctx: CanvasRenderingContext2D, pools: BloodPool[], now: number) {
  for (const pool of pools) {
    const age = now - pool.startedAt;
    if (age > BLOOD_POOL_LIFETIME_MS) continue;
    ctx.globalAlpha = Math.max(0, 0.5 * (1 - age / BLOOD_POOL_LIFETIME_MS));
    ctx.fillStyle = COLORS.blood;
    ctx.beginPath();
    ctx.ellipse(pool.x, pool.y + PLAYER_RADIUS - 4, pool.radius, pool.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number) {
  const width = 40;
  const height = 5;
  const pct = Math.max(0, Math.min(1, hp / MAX_HP));
  ctx.fillStyle = "rgba(20,18,15,0.8)";
  ctx.fillRect(x - width / 2, y, width, height);
  ctx.fillStyle = pct > 0.4 ? COLORS.teal : COLORS.blood;
  ctx.fillRect(x - width / 2, y, width * pct, height);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  username: string,
  avatarUrl: string | null,
  isSelf: boolean,
  ringColor: string,
  crewName: string | null,
  hp: number,
  weapon: WeaponId,
  downed: boolean,
  bubble: { text: string } | null,
  popups: DamagePopup[],
  now: number
) {
  ctx.save();
  ctx.globalAlpha = downed ? 0.35 : 1;

  if (isSelf) {
    // "This is you" halo, separate from crew color — previously self
    // always rendered amber outright, which silently discarded
    // crewColorHex for your own avatar even though it's shown
    // correctly for everyone else. Now the inner ring reflects your
    // actual crew color (or the teal default) like anyone else's, and
    // self-recognition comes from this halo instead.
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.closePath();
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 3;
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.stroke();

  if (avatarUrl) {
    const img = getAvatarImage(avatarUrl);
    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, PLAYER_RADIUS - 3, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - PLAYER_RADIUS, y - PLAYER_RADIUS, PLAYER_RADIUS * 2, PLAYER_RADIUS * 2);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = COLORS.sand;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(username.slice(0, 1).toUpperCase(), x, y);
  }
  ctx.restore();

  if (downed) {
    ctx.save();
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.blood;
    ctx.fillText("DEAD", x, y - PLAYER_RADIUS - 10);
    ctx.restore();
    return;
  }

  drawHealthBar(ctx, x, y - PLAYER_RADIUS - 10, hp);
  drawWeaponGlyph(ctx, x + PLAYER_RADIUS - 4, y + PLAYER_RADIUS - 4, weapon);

  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(20,18,15,0.85)";
  ctx.fillText(`@${username}`, x + 1, y + PLAYER_RADIUS + 15);
  ctx.fillStyle = COLORS.sand;
  ctx.fillText(`@${username}`, x, y + PLAYER_RADIUS + 14);

  if (crewName) {
    ctx.font = "10px sans-serif";
    ctx.fillStyle = ringColor;
    ctx.fillText(crewName, x, y + PLAYER_RADIUS + 26);
  }

  if (bubble) {
    const paddingX = 8;
    const textWidth = ctx.measureText(bubble.text).width;
    const bubbleWidth = textWidth + paddingX * 2;
    const bubbleY = y - PLAYER_RADIUS - 30;
    ctx.fillStyle = "rgba(30,27,23,0.95)";
    ctx.strokeStyle = COLORS.line;
    const bx = x - bubbleWidth / 2;
    const by = bubbleY - 14;
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.arcTo(bx + bubbleWidth, by, bx + bubbleWidth, by + 28, radius);
    ctx.arcTo(bx + bubbleWidth, by + 28, bx, by + 28, radius);
    ctx.arcTo(bx, by + 28, bx, by, radius);
    ctx.arcTo(bx, by, bx + bubbleWidth, by, radius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.sand;
    ctx.fillText(bubble.text, x, by + 14);
  }

  for (const popup of popups) {
    const age = now - popup.startedAt;
    if (age > 900) continue;
    const riseY = y - PLAYER_RADIUS - 40 - age / 20;
    ctx.globalAlpha = Math.max(0, 1 - age / 900);
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = COLORS.blood;
    ctx.fillText(popup.text, x, riseY);
    ctx.globalAlpha = 1;
  }
}

export interface WorldCanvasHandle {
  sendChat: (text: string, scope: "district" | "nearby") => void;
  startMission: (id: MissionId) => void;
  abandonMission: () => void;
}

interface WorldCanvasProps {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
  crewId: string | null;
  crewName: string | null;
  crewColorHex: string | null;
  controllerScheme: ControllerScheme;
  onChatRequested: () => void;
  onMissionChange: (m: ActiveMission | null) => void;
  onMissionComplete: (id: MissionId, rep: number) => void;
  turfOwners: Map<string, { crewId: string; crewName: string | null; color: string | null }>;
  onTurfCaptured: () => void;
}

const WorldCanvas = forwardRef<WorldCanvasHandle, WorldCanvasProps>(function WorldCanvas(
  {
    userId, username, avatarUrl, isVerified, crewId, crewName, crewColorHex,
    controllerScheme, onChatRequested, onMissionChange, onMissionComplete, turfOwners, onTurfCaptured,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfPosRef = useRef(safeSpawn());
  const remotePlayersRef = useRef<Map<string, RemotePlayer>>(new Map());
  const selfBubbleRef = useRef<{ text: string; expiresAt: number } | null>(null);
  const selfPopupsRef = useRef<DamagePopup[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const joystickVectorRef = useRef<JoystickVector>({ dx: 0, dy: 0 });
  const lastBroadcastRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);

  const selfHpRef = useRef(MAX_HP);
  const selfDownedUntilRef = useRef(0);
  const weaponRef = useRef<WeaponId>("fists");
  const lastAttackAtRef = useRef(0);
  const pickupsRef = useRef<Map<string, number>>(new Map());
  const attemptAttackRef = useRef<() => void>(() => {});
  const interactRef = useRef<() => void>(() => {});
  const bloodParticlesRef = useRef<BloodParticle[]>([]);
  const bloodPoolsRef = useRef<BloodPool[]>([]);

  function spawnBlood(x: number, y: number, count: number) {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      bloodParticlesRef.current.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40, startedAt: now,
      });
    }
  }

  // vehicles
  const vehiclesRef = useRef<Map<VehicleId, VehicleState>>(initialVehicleStates());
  const drivingRef = useRef<VehicleId | null>(null);
  const speedRef = useRef(0);
  const angleRef = useRef(0);
  const lastRunoverAtRef = useRef<Map<string, number>>(new Map());

  // missions & turf
  const missionRef = useRef<ActiveMission | null>(null);
  const turfHoldRef = useRef<{ zoneId: string; sinceMs: number } | null>(null);
  const turfOwnersRef = useRef(turfOwners);
  turfOwnersRef.current = turfOwners;
  const supabaseRef = useRef(createClient());

  const [onlineCount, setOnlineCount] = useState(1);
  const [weaponDisplay, setWeaponDisplay] = useState<WeaponId>("fists");
  const [attackOnCooldown, setAttackOnCooldown] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showTouchControls, setShowTouchControls] = useState(false);
  const [drivingName, setDrivingName] = useState<string | null>(null);
  const [nearVehicle, setNearVehicle] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setShowTouchControls(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  function safeSpawn() {
    for (let i = 0; i < 40; i++) {
      const p = randomSpawnPoint();
      if (!isInsideBuilding(p.x, p.y, PLAYER_RADIUS)) return p;
    }
    return { x: 800, y: 500 };
  }

  const broadcastMessage = useCallback(
    (text: string, scope: "district" | "nearby") => {
      const channel = channelRef.current;
      if (!channel) return;
      const payload: WorldChatPayload = { userId, username, text, scope, ts: Date.now() };
      channel.send({ type: "broadcast", event: "chat", payload });
      selfBubbleRef.current = { text, expiresAt: Date.now() + 4000 };
    },
    [userId, username]
  );

  const setMission = useCallback((m: ActiveMission | null) => {
    missionRef.current = m;
    onMissionChange(m);
  }, [onMissionChange]);

  useImperativeHandle(ref, () => ({
    sendChat: broadcastMessage,
    startMission: (id) => {
      setMission({ id, startedAt: Date.now(), hasPackage: false, kills: 0, holdAccumMs: 0, checkpointsHit: [] });
      setToast(`Mission started: ${MISSIONS[id].title}`);
    },
    abandonMission: () => setMission(null),
  }), [broadcastMessage, setMission]);

  async function completeMission(m: ActiveMission) {
    const def = MISSIONS[m.id];
    setMission(null);
    setToast(`Mission complete: ${def.title} (+${def.rep} rep)`);
    const { error } = await supabaseRef.current
      .from("world_mission_completions")
      .insert({ user_id: userId, mission_id: m.id, rep: def.rep });
    if (error) console.error("mission log failed", error);
    onMissionComplete(m.id, def.rep);
  }

  // ---- combat ----
  function attemptAttack() {
    const channel = channelRef.current;
    if (!channel) return;
    if (selfDownedUntilRef.current > Date.now()) return;
    if (drivingRef.current) return; // no shooting from cars (yet)

    const weaponId = weaponRef.current;
    const weapon = WEAPONS[weaponId];
    const now = Date.now();
    if (now - lastAttackAtRef.current < weapon.cooldownMs) return;

    const selfPos = selfPosRef.current;
    let target: RemotePlayer | null = null;
    let bestDist = Infinity;
    for (const player of remotePlayersRef.current.values()) {
      if (player.hp <= 0 || player.downedUntil > now) continue;
      if (crewId && player.meta.crewId === crewId) continue;
      const d = distance(selfPos.x, selfPos.y, player.x, player.y);
      if (d <= weapon.range && d < bestDist) { bestDist = d; target = player; }
    }
    lastAttackAtRef.current = now;
    setAttackOnCooldown(true);
    setTimeout(() => setAttackOnCooldown(false), weapon.cooldownMs);
    if (!target) return;
    sendHit(target.meta.userId, weaponId);
  }
  attemptAttackRef.current = attemptAttack;

  function sendHit(targetId: string, weapon: WeaponId) {
    const selfPos = selfPosRef.current;
    const hitPayload: WorldHitPayload = {
      attackerId: userId, attackerUsername: username, targetId, weapon,
      attackerX: selfPos.x, attackerY: selfPos.y, ts: Date.now(),
    };
    channelRef.current?.send({ type: "broadcast", event: "hit", payload: hitPayload });
  }

  // ---- vehicles ----
  function interact() {
    const channel = channelRef.current;
    if (!channel || selfDownedUntilRef.current > Date.now()) return;
    if (drivingRef.current) {
      // exit
      const vid = drivingRef.current;
      const v = vehiclesRef.current.get(vid)!;
      v.x = selfPosRef.current.x; v.y = selfPosRef.current.y; v.angle = angleRef.current; v.occupiedBy = null;
      drivingRef.current = null; speedRef.current = 0; setDrivingName(null);
      // step out beside the car
      selfPosRef.current = clampToWorld(v.x + Math.cos(v.angle + Math.PI / 2) * 40, v.y + Math.sin(v.angle + Math.PI / 2) * 40);
      channel.send({ type: "broadcast", event: "vehicle_exit",
        payload: { vehicleId: vid, by: userId, x: v.x, y: v.y, angle: v.angle, ts: Date.now() } satisfies VehicleExitPayload });
      return;
    }
    // enter nearest free vehicle
    let best: VehicleState | null = null, bd = Infinity;
    for (const v of vehiclesRef.current.values()) {
      if (v.occupiedBy) continue;
      const d = distance(selfPosRef.current.x, selfPosRef.current.y, v.x, v.y);
      if (d <= VEHICLE_ENTER_RADIUS && d < bd) { bd = d; best = v; }
    }
    if (!best) return;
    best.occupiedBy = userId;
    drivingRef.current = best.id;
    angleRef.current = best.angle;
    speedRef.current = 0;
    selfPosRef.current = { x: best.x, y: best.y };
    setDrivingName(VEHICLES[best.id].name);
    channel.send({ type: "broadcast", event: "vehicle_enter",
      payload: { vehicleId: best.id, by: userId, ts: Date.now() } satisfies VehicleEnterPayload });
  }
  interactRef.current = interact;

  // ---- realtime ----
  useEffect(() => {
    const supabase = supabaseRef.current;
    // private: true activates Realtime Authorization — Supabase only
    // consults the RLS policies on realtime.messages (see migration
    // 0006_world_realtime_authorization.sql) once a channel is marked
    // private; without it, this topic is open to anyone with the anon
    // key regardless of sign-in state or account standing.
    const channel = supabase.channel(WORLD_CHANNEL, {
      config: { presence: { key: userId }, private: true },
    });
    channelRef.current = channel;

    function sendMove(now: number) {
      channel.send({ type: "broadcast", event: "move", payload: {
        userId, x: selfPosRef.current.x, y: selfPosRef.current.y, weapon: weaponRef.current,
        vehicleId: drivingRef.current, angle: angleRef.current, ts: now,
      } satisfies WorldMovePayload });
    }

    function handleRespawn() {
      selfPosRef.current = safeSpawn();
      selfHpRef.current = MAX_HP;
      selfDownedUntilRef.current = 0;
      sendMove(Date.now());
      channel.send({ type: "broadcast", event: "hp_update",
        payload: { userId, hp: MAX_HP, ts: Date.now() } satisfies WorldHpUpdatePayload });
    }

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<WorldPresenceMeta>();
        const seen = new Set<string>();
        for (const key of Object.keys(state)) {
          const entries = state[key];
          if (!entries || entries.length === 0) continue;
          const meta = entries[0] as unknown as WorldPresenceMeta;
          if (!meta || meta.userId === userId) continue;
          seen.add(meta.userId);
          const existing = remotePlayersRef.current.get(meta.userId);
          if (!existing) {
            const spawn = randomSpawnPoint();
            remotePlayersRef.current.set(meta.userId, {
              meta, x: spawn.x, y: spawn.y, targetX: spawn.x, targetY: spawn.y, lastUpdate: Date.now(),
              bubble: null, hp: MAX_HP, downedUntil: 0, popups: [], currentWeapon: "fists", vehicleId: null, angle: 0,
            });
          } else existing.meta = meta;
        }
        for (const key of Array.from(remotePlayersRef.current.keys())) {
          if (!seen.has(key)) {
            const gone = remotePlayersRef.current.get(key)!;
            if (gone.vehicleId) { const v = vehiclesRef.current.get(gone.vehicleId); if (v) v.occupiedBy = null; }
            remotePlayersRef.current.delete(key);
          }
        }
        setOnlineCount(seen.size + 1);
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const move = payload as WorldMovePayload;
        if (move.userId === userId) return;
        const player = remotePlayersRef.current.get(move.userId);
        if (!player) return;
        player.targetX = move.x; player.targetY = move.y; player.currentWeapon = move.weapon;
        player.vehicleId = move.vehicleId ?? null; player.angle = move.angle ?? 0; player.lastUpdate = Date.now();
        if (player.vehicleId) {
          const v = vehiclesRef.current.get(player.vehicleId);
          if (v) { v.occupiedBy = move.userId; v.x = move.x; v.y = move.y; v.angle = move.angle; }
        }
      })
      .on("broadcast", { event: "vehicle_enter" }, ({ payload }) => {
        const p = payload as VehicleEnterPayload;
        if (p.by === userId) return;
        const v = vehiclesRef.current.get(p.vehicleId); if (v) v.occupiedBy = p.by;
      })
      .on("broadcast", { event: "vehicle_exit" }, ({ payload }) => {
        const p = payload as VehicleExitPayload;
        if (p.by === userId) return;
        const v = vehiclesRef.current.get(p.vehicleId);
        if (v) { v.occupiedBy = null; v.x = p.x; v.y = p.y; v.angle = p.angle; }
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const chat = payload as WorldChatPayload;
        if (chat.userId === userId) return;
        const player = remotePlayersRef.current.get(chat.userId);
        if (player) player.bubble = { text: chat.text, expiresAt: Date.now() + 4000 };
      })
      .on("broadcast", { event: "hit" }, async ({ payload }) => {
        const hit = payload as WorldHitPayload;
        if (hit.targetId !== userId) return;
        if (selfDownedUntilRef.current > Date.now()) return;
        if (!isPlausibleHit(hit, selfPosRef.current.x, selfPosRef.current.y)) return;
        if (drivingRef.current) return; // in a car you're shielded from on-foot weapons this round

        const weapon = WEAPONS[hit.weapon];
        selfHpRef.current = Math.max(0, selfHpRef.current - weapon.damage);
        selfPopupsRef.current.push({ text: `-${weapon.damage}`, startedAt: Date.now() });
        const hitX = selfPosRef.current.x, hitY = selfPosRef.current.y;
        spawnBlood(hitX, hitY, 8);
        channel.send({ type: "broadcast", event: "hp_update",
          payload: { userId, hp: selfHpRef.current, hitX, hitY, ts: Date.now() } satisfies WorldHpUpdatePayload });

        if (selfHpRef.current <= 0) {
          selfDownedUntilRef.current = Date.now() + RESPAWN_DELAY_MS;
          bloodPoolsRef.current.push({ x: hitX, y: hitY, radius: 26, startedAt: Date.now() });
          // dying fails hold missions
          const m = missionRef.current;
          if (m && MISSIONS[m.id].kind === "hold") { setMission(null); setToast("Mission failed — you died holding the zone."); }
          turfHoldRef.current = null;
          const koPayload: WorldKoPayload = {
            attackerId: hit.attackerId, attackerUsername: hit.attackerUsername, targetId: userId,
            targetUsername: username, weapon: hit.weapon, x: hitX, y: hitY, ts: Date.now(),
          };
          channel.send({ type: "broadcast", event: "ko", payload: koPayload });
          setToast(`${hit.attackerUsername} killed ${username} with the ${weapon.label}`);
          const { error } = await supabase.from("world_ko_log").insert({ attacker_id: hit.attackerId, target_id: userId, weapon: hit.weapon });
          if (error) console.error("Could not log KO", error);
          setTimeout(handleRespawn, RESPAWN_DELAY_MS);
        }
      })
      .on("broadcast", { event: "hp_update" }, ({ payload }) => {
        const upd = payload as WorldHpUpdatePayload;
        if (upd.userId === userId) return;
        const player = remotePlayersRef.current.get(upd.userId);
        if (!player) return;
        if (upd.hp < player.hp) {
          player.popups.push({ text: `-${player.hp - upd.hp}`, startedAt: Date.now() });
          if (upd.hitX !== undefined && upd.hitY !== undefined) spawnBlood(upd.hitX, upd.hitY, 8);
        }
        player.hp = upd.hp;
      })
      .on("broadcast", { event: "ko" }, ({ payload }) => {
        const ko = payload as WorldKoPayload;
        setToast(`${ko.attackerUsername} killed ${ko.targetUsername} with the ${WEAPONS[ko.weapon].label}`);
        const player = remotePlayersRef.current.get(ko.targetId);
        if (player) player.downedUntil = Date.now() + RESPAWN_DELAY_MS;
        if (ko.targetId !== userId) bloodPoolsRef.current.push({ x: ko.x, y: ko.y, radius: 26, startedAt: Date.now() });
        // hit list progress
        if (ko.attackerId === userId) {
          const m = missionRef.current;
          if (m && MISSIONS[m.id].kind === "hitlist") {
            const kills = (m.kills ?? 0) + 1;
            const next = { ...m, kills };
            if (kills >= (MISSIONS[m.id].kills ?? 0)) completeMission(next); else setMission(next);
          }
        }
      })
      .on("broadcast", { event: "pickup_taken" }, ({ payload }) => {
        const p = payload as WorldPickupTakenPayload;
        if (p.by === userId) return;
        pickupsRef.current.set(p.pickupId, Date.now() + PICKUP_RESPAWN_MS);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const meta: WorldPresenceMeta = { userId, username, avatarUrl, isVerified, crewId, crewName, crewColorHex };
          await channel.track(meta);
        }
      });

    return () => { channel.unsubscribe(); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username, avatarUrl, isVerified, crewId, crewName, crewColorHex]);

  // ---- keyboard ----
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === " ") { e.preventDefault(); attemptAttackRef.current(); }
      if (e.key.toLowerCase() === "e") { e.preventDefault(); interactRef.current(); }
    }
    function onKeyUp(e: KeyboardEvent) { keysRef.current.delete(e.key.toLowerCase()); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  // ---- game loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rawCtx = canvas.getContext("2d");
    if (!rawCtx) return;
    const ctx: CanvasRenderingContext2D = rawCtx;
    let raf = 0;
    let lastNearVehicle: string | null = null;

    function frame(now: number) {
      const last = lastFrameRef.current ?? now;
      const dt = Math.min((now - last) / 1000, 0.05);
      lastFrameRef.current = now;
      const nowMs = Date.now();
      const downed = selfDownedUntilRef.current > nowMs;

      const keys = keysRef.current;
      let ix = 0, iy = 0;
      if (keys.has("arrowup") || keys.has("w")) iy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) iy += 1;
      if (keys.has("arrowleft") || keys.has("a")) ix -= 1;
      if (keys.has("arrowright") || keys.has("d")) ix += 1;
      ix += joystickVectorRef.current.dx; iy += joystickVectorRef.current.dy;
      ix = Math.max(-1, Math.min(1, ix)); iy = Math.max(-1, Math.min(1, iy));

      if (!downed) {
        const driving = drivingRef.current;
        if (driving) {
          // car physics: iy<0 accelerate, iy>0 brake/reverse, ix steer
          const def = VEHICLES[driving];
          let speed = speedRef.current;
          if (iy < 0) speed += def.accel * -iy * dt;
          else if (iy > 0) speed -= def.accel * 1.4 * iy * dt;
          speed -= speed * VEHICLE_DRAG * dt;
          speed = Math.max(-def.maxSpeed * 0.4, Math.min(def.maxSpeed, speed));
          const steerFactor = Math.min(1, Math.abs(speed) / 180);
          angleRef.current += ix * VEHICLE_STEER_RATE * steerFactor * dt * (speed < 0 ? -1 : 1);
          const nx = selfPosRef.current.x + Math.cos(angleRef.current) * speed * dt;
          const ny = selfPosRef.current.y + Math.sin(angleRef.current) * speed * dt;
          if (isInsideBuilding(nx, ny, 14)) { speed *= -0.3; } // bounce
          else selfPosRef.current = clampToWorld(nx, ny);
          speedRef.current = speed;
          const v = vehiclesRef.current.get(driving)!;
          v.x = selfPosRef.current.x; v.y = selfPosRef.current.y; v.angle = angleRef.current;

          // run-over
          if (Math.abs(speed) >= RUNOVER_MIN_SPEED) {
            for (const p of remotePlayersRef.current.values()) {
              if (p.vehicleId || p.hp <= 0 || p.downedUntil > nowMs) continue;
              if (crewId && p.meta.crewId === crewId) continue;
              if (distance(selfPosRef.current.x, selfPosRef.current.y, p.x, p.y) > RUNOVER_RADIUS) continue;
              const lastAt = lastRunoverAtRef.current.get(p.meta.userId) ?? 0;
              if (nowMs - lastAt < WEAPONS.vehicle.cooldownMs) continue;
              lastRunoverAtRef.current.set(p.meta.userId, nowMs);
              sendHit(p.meta.userId, "vehicle");
            }
          }
        } else if (ix !== 0 || iy !== 0) {
          const len = Math.max(Math.hypot(ix, iy), 1);
          const pos = selfPosRef.current;
          const nx = pos.x + (ix / len) * MOVE_SPEED * dt, ny = pos.y + (iy / len) * MOVE_SPEED * dt;
          // slide along buildings
          const tryX = isInsideBuilding(nx, pos.y, PLAYER_RADIUS - 6) ? pos.x : nx;
          const tryY = isInsideBuilding(tryX, ny, PLAYER_RADIUS - 6) ? pos.y : ny;
          selfPosRef.current = clampToWorld(tryX, tryY);
        }

        // pickups (on foot only)
        if (!driving) for (const spawn of WEAPON_PICKUPS) {
          if ((pickupsRef.current.get(spawn.id) ?? 0) > nowMs) continue;
          if (distance(selfPosRef.current.x, selfPosRef.current.y, spawn.x, spawn.y) <= PICKUP_RADIUS + PLAYER_RADIUS) {
            weaponRef.current = spawn.weapon; setWeaponDisplay(spawn.weapon);
            pickupsRef.current.set(spawn.id, nowMs + PICKUP_RESPAWN_MS);
            channelRef.current?.send({ type: "broadcast", event: "pickup_taken",
              payload: { pickupId: spawn.id, by: userId, ts: nowMs } satisfies WorldPickupTakenPayload });
          }
        }

        // nearby vehicle prompt
        let nv: string | null = null;
        if (!driving) for (const v of vehiclesRef.current.values()) {
          if (!v.occupiedBy && distance(selfPosRef.current.x, selfPosRef.current.y, v.x, v.y) <= VEHICLE_ENTER_RADIUS) { nv = VEHICLES[v.id].name; break; }
        }
        if (nv !== lastNearVehicle) { lastNearVehicle = nv; setNearVehicle(nv); }

        // missions
        const m = missionRef.current;
        if (m) {
          const def = MISSIONS[m.id];
          const sx = selfPosRef.current.x, sy = selfPosRef.current.y;
          if (def.kind === "delivery") {
            if (!m.hasPackage && distance(sx, sy, def.pickup!.x, def.pickup!.y) <= OBJECTIVE_RADIUS) { setMission({ ...m, hasPackage: true }); setToast("Package picked up — deliver it."); }
            else if (m.hasPackage && distance(sx, sy, def.dropoff!.x, def.dropoff!.y) <= OBJECTIVE_RADIUS) completeMission(m);
          } else if (def.kind === "hold") {
            const z = TURF_ZONES.find((t) => t.id === def.turfId)!;
            if (distance(sx, sy, z.x, z.y) <= z.r) {
              const acc = (m.holdAccumMs ?? 0) + dt * 1000;
              if (acc >= def.holdMs!) completeMission({ ...m, holdAccumMs: acc });
              else { m.holdAccumMs = acc; if ((acc | 0) % 1000 < dt * 1000) onMissionChange({ ...m }); }
            }
          } else if (def.kind === "joyride" && driving) {
            const hit = new Set(m.checkpointsHit ?? []);
            def.checkpoints!.forEach((c, i) => { if (!hit.has(i) && distance(sx, sy, c.x, c.y) <= OBJECTIVE_RADIUS + 20) hit.add(i); });
            if (hit.size !== (m.checkpointsHit ?? []).length) {
              const next = { ...m, checkpointsHit: Array.from(hit) };
              if (hit.size >= def.checkpoints!.length) completeMission(next); else setMission(next);
            }
          }
        }

        // turf capture (needs a crew, on foot or driving, uncontested)
        if (crewId) {
          const sx = selfPosRef.current.x, sy = selfPosRef.current.y;
          const zone = TURF_ZONES.find((t) => distance(sx, sy, t.x, t.y) <= t.r) ?? null;
          const owned = zone ? turfOwnersRef.current.get(zone.id)?.crewId === crewId : false;
          if (zone && !owned) {
            const contested = Array.from(remotePlayersRef.current.values()).some(
              (p) => p.meta.crewId !== crewId && p.hp > 0 && p.downedUntil <= nowMs && distance(p.x, p.y, zone.x, zone.y) <= zone.r
            );
            if (contested) turfHoldRef.current = null;
            else if (!turfHoldRef.current || turfHoldRef.current.zoneId !== zone.id) turfHoldRef.current = { zoneId: zone.id, sinceMs: nowMs };
            else if (nowMs - turfHoldRef.current.sinceMs >= TURF_CAPTURE_MS) {
              turfHoldRef.current = null;
              supabaseRef.current.from("world_turf")
                .update({ crew_id: crewId, captured_by: userId, captured_at: new Date().toISOString() })
                .eq("zone_id", zone.id)
                .then(({ error }) => { if (!error) { setToast(`Your crew took ${zone.name}!`); onTurfCaptured(); } });
            }
          } else turfHoldRef.current = null;
        }
      }

      if (now - lastBroadcastRef.current > BROADCAST_INTERVAL_MS) {
        lastBroadcastRef.current = now;
        channelRef.current?.send({ type: "broadcast", event: "move", payload: {
          userId, x: selfPosRef.current.x, y: selfPosRef.current.y, weapon: weaponRef.current,
          vehicleId: drivingRef.current, angle: angleRef.current, ts: now,
        } satisfies WorldMovePayload });
      }

      for (const player of remotePlayersRef.current.values()) {
        player.x += (player.targetX - player.x) * Math.min(dt * 8, 1);
        player.y += (player.targetY - player.y) * Math.min(dt * 8, 1);
        if (player.bubble && player.bubble.expiresAt < nowMs) player.bubble = null;
        player.popups = player.popups.filter((p) => nowMs - p.startedAt < 900);
      }
      if (selfBubbleRef.current && selfBubbleRef.current.expiresAt < nowMs) selfBubbleRef.current = null;
      selfPopupsRef.current = selfPopupsRef.current.filter((p) => nowMs - p.startedAt < 900);
      bloodParticlesRef.current = bloodParticlesRef.current.filter((p) => nowMs - p.startedAt < BLOOD_PARTICLE_LIFETIME_MS);
      bloodPoolsRef.current = bloodPoolsRef.current.filter((p) => nowMs - p.startedAt < BLOOD_POOL_LIFETIME_MS);

      // ---- draw ----
      const turfColors = new Map<string, string | null>();
      for (const [k, v] of turfOwnersRef.current) turfColors.set(k, v.color ?? COLORS.teal);
      drawCity(ctx, turfColors);
      drawBloodPools(ctx, bloodPoolsRef.current, nowMs);

      // mission objectives
      const m = missionRef.current;
      if (m) {
        const marker = missionMarker(m);
        const def = MISSIONS[m.id];
        const pts = def.kind === "joyride" ? def.checkpoints!.filter((_, i) => !(m.checkpointsHit ?? []).includes(i)) : marker ? [marker] : [];
        for (const p of pts) {
          const pulse = 1 + 0.15 * Math.sin(nowMs / 200);
          ctx.beginPath(); ctx.arc(p.x, p.y, OBJECTIVE_RADIUS * pulse, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(242,169,59,0.18)"; ctx.fill();
          ctx.strokeStyle = COLORS.amber; ctx.lineWidth = 2; ctx.stroke();
        }
      }

      for (const spawn of WEAPON_PICKUPS) {
        if ((pickupsRef.current.get(spawn.id) ?? 0) > nowMs) continue;
        ctx.save(); ctx.beginPath(); ctx.arc(spawn.x, spawn.y, PICKUP_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(242,169,59,0.15)"; ctx.fill(); ctx.restore();
        drawWeaponGlyph(ctx, spawn.x, spawn.y, spawn.weapon);
      }

      // vehicles (unoccupied + remote-driven; own car drawn with self below)
      for (const v of vehiclesRef.current.values()) {
        if (v.occupiedBy === userId) continue;
        drawVehicle(ctx, v.x, v.y, v.angle, VEHICLES[v.id].color, !!v.occupiedBy);
      }

      for (const player of remotePlayersRef.current.values()) {
        const isDowned = player.downedUntil > nowMs;
        if (player.vehicleId && !isDowned) {
          // car already drawn; show name over it
          ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = COLORS.sand;
          ctx.fillText(`@${player.meta.username}`, player.x, player.y - 26);
          drawHealthBar(ctx, player.x, player.y - 40, player.hp);
          continue;
        }
        const near = distance(selfPosRef.current.x, selfPosRef.current.y, player.x, player.y) <= PROXIMITY_CHAT_RADIUS;
        ctx.globalAlpha = near || isDowned ? 1 : 0.6;
        drawPlayer(ctx, player.x, player.y, player.meta.username, player.meta.avatarUrl, false,
          player.meta.crewColorHex ?? COLORS.teal, player.meta.crewName, player.hp, player.currentWeapon,
          isDowned, player.bubble, player.popups, nowMs);
        ctx.globalAlpha = 1;
      }

      if (drivingRef.current && !downed) {
        drawVehicle(ctx, selfPosRef.current.x, selfPosRef.current.y, angleRef.current, VEHICLES[drivingRef.current].color, true);
        ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = COLORS.amber;
        ctx.fillText(`@${username}`, selfPosRef.current.x, selfPosRef.current.y - 26);
        drawHealthBar(ctx, selfPosRef.current.x, selfPosRef.current.y - 40, selfHpRef.current);
      } else {
        drawPlayer(ctx, selfPosRef.current.x, selfPosRef.current.y, username, avatarUrl, true,
          crewColorHex ?? COLORS.teal, crewName, selfHpRef.current, weaponRef.current, downed,
          selfBubbleRef.current, selfPopupsRef.current, nowMs);
      }

      drawBloodParticles(ctx, bloodParticlesRef.current, nowMs);

      // HUD: minimap + district
      const others = Array.from(remotePlayersRef.current.values()).map((p) => ({ x: p.x, y: p.y, color: p.meta.crewColorHex ?? COLORS.teal }));
      drawMinimap(ctx, WORLD_WIDTH - 200, WORLD_HEIGHT - 132, 184, 116, selfPosRef.current, others, turfColors, m ? missionMarker(m) : null);
      ctx.font = "bold 14px sans-serif"; ctx.textAlign = "right"; ctx.fillStyle = COLORS.sand;
      ctx.fillText(districtAt(selfPosRef.current.x, selfPosRef.current.y).name.toUpperCase(), WORLD_WIDTH - 16, WORLD_HEIGHT - 140);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, username, avatarUrl, crewColorHex, crewName, crewId]);

  const activeMission = missionRef.current;

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        className="w-full rounded-lg border border-ink-line bg-ink"
        style={{ aspectRatio: `${WORLD_WIDTH} / ${WORLD_HEIGHT}`, touchAction: "none" }}
        aria-label="The Block — live open world"
        role="img"
      />
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 text-[11px] text-frost-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-live-cyan animate-pulse" />
        {onlineCount} in The Block
      </div>
      <div className="absolute right-3 top-3 rounded-sm bg-black/60 px-2 py-1 text-[11px] text-frost-muted">
        {drivingName ? `Driving: ${drivingName}` : `Armed: ${WEAPONS[weaponDisplay].label}`}
      </div>
      {activeMission && (
        <div className="absolute left-3 top-9 rounded-sm bg-black/60 px-2 py-1 text-[11px] text-neon-pink">
          {MISSIONS[activeMission.id].title}: {missionProgressText(activeMission)}
        </div>
      )}
      {nearVehicle && !drivingName && (
        <div className="absolute left-1/2 bottom-24 -translate-x-1/2 rounded-sm bg-black/70 px-3 py-1 text-xs text-frost">
          {showTouchControls ? "Tap Interact" : "Press E"} to get in the {nearVehicle}
        </div>
      )}
      {toast && (
        <div className="absolute left-1/2 top-14 -translate-x-1/2 rounded-sm bg-blood/90 px-3 py-1.5 text-center text-xs text-frost shadow-lg">
          {toast}
        </div>
      )}
      {showTouchControls && (
        <VirtualController
          scheme={controllerScheme}
          vectorRef={joystickVectorRef}
          onAttack={() => attemptAttackRef.current()}
          onChat={onChatRequested}
          onInteract={() => interactRef.current()}
          attackDisabled={attackOnCooldown}
        />
      )}
      <p className="mt-2 text-center text-xs text-frost-muted">
        {showTouchControls
          ? "Stick to move (up = gas in a car). Attack to fight, Interact to get in/out of cars."
          : "WASD/arrows to move (W = gas, S = brake in a car), Space to fight, E to get in/out of cars."}
      </p>
    </div>
  );
});

export default WorldCanvas;
