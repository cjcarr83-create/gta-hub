"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, Stars } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, N8AO } from "@react-three/postprocessing";
import * as THREE from "three";

// Phase 1 prototype of a real 3D version of The Block — see
// app/world/3d-preview/page.tsx. Deliberately built from primitive
// geometry (boxes, capsules, planes) rather than downloaded models:
// this sandbox's network policy blocks reaching external asset hosts,
// and more importantly this avoids any licensing ambiguity entirely —
// nothing here is copied or derived from any existing game's assets.
// The look is intentionally a stylized low-poly night city (think
// Crossy Road / early 3D indie GTA-likes), not an attempt at
// photorealism, which procedural primitives can't credibly fake anyway.
//
// Not yet wired to real movement input, multiplayer presence, combat,
// or missions — this is a visual-direction check before any of that
// gets rebuilt on top of a 3D engine.

const BLOCK = 10; // world units between building centers
const GRID = 6; // blocks per side

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function City() {
  const buildings = useMemo(() => {
    const rand = seededRandom(42);
    const items: { x: number; z: number; w: number; d: number; h: number; color: string }[] = [];
    for (let gx = -GRID; gx <= GRID; gx++) {
      for (let gz = -GRID; gz <= GRID; gz++) {
        // Leave cross-shaped roads clear down the middle, same layout
        // feel as the existing 2D map (a few through-streets).
        if (gx % 3 === 0 || gz % 3 === 0) continue;
        const h = 2 + rand() * 10;
        const w = 3 + rand() * 2.5;
        const d = 3 + rand() * 2.5;
        const hue = 0.62 + rand() * 0.08; // cool navy/violet range
        const lightness = 0.22 + rand() * 0.12;
        items.push({
          x: gx * BLOCK + (rand() - 0.5) * 1.5,
          z: gz * BLOCK + (rand() - 0.5) * 1.5,
          w,
          d,
          h,
          color: new THREE.Color().setHSL(hue, 0.35, lightness).getStyle(),
        });
      }
    }
    return items;
  }, []);

  const parkedCars = useMemo(() => {
    const rand = seededRandom(99);
    const items: { x: number; z: number; rotationY: number; color: string }[] = [];
    const palette = ["#2E2450", "#3A2E1F", "#1F3A3A", "#3A1F2E", "#22303A"];
    for (let gx = -GRID; gx <= GRID; gx += 3) {
      for (let gz = -GRID + 1; gz < GRID; gz++) {
        if (gz % 3 === 0) continue;
        if (rand() > 0.55) continue;
        const side = rand() > 0.5 ? 2.6 : -2.6;
        items.push({
          x: gx * BLOCK + side,
          z: gz * BLOCK + (rand() - 0.5) * 2,
          rotationY: side > 0 ? Math.PI / 2 : -Math.PI / 2,
          color: palette[Math.floor(rand() * palette.length)] ?? "#2E2450",
        });
      }
    }
    return items;
  }, []);

  const streetLights = useMemo(() => {
    const items: [number, number, number][] = [];
    for (let gx = -GRID; gx <= GRID; gx += 3) {
      for (let gz = -GRID; gz <= GRID; gz += 3) {
        items.push([gx * BLOCK + 1.8, 0, gz * BLOCK + 1.8]);
        items.push([gx * BLOCK - 1.8, 0, gz * BLOCK - 1.8]);
      }
    }
    return items;
  }, []);

  const palmTrees = useMemo(() => {
    const rand = seededRandom(7);
    const items: [number, number, number][] = [];
    // Line the outer edge of the grid — a Miami-strip silhouette rather
    // than scattered randomly through the city blocks.
    for (let g = -GRID; g <= GRID; g++) {
      if (rand() > 0.6) items.push([GRID * BLOCK + 3 + rand() * 2, 0, g * BLOCK]);
      if (rand() > 0.6) items.push([-GRID * BLOCK - 3 - rand() * 2, 0, g * BLOCK]);
    }
    return items;
  }, []);

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, b.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} roughness={0.85} />
          </mesh>
          <BuildingWindows w={b.w} h={b.h} d={b.d} seed={i} />
        </group>
      ))}
      {parkedCars.map((c, i) => (
        <Car key={i} position={[c.x, 0, c.z]} rotationY={c.rotationY} color={c.color} />
      ))}
      {streetLights.map((p, i) => (
        <StreetLight key={i} position={p} />
      ))}
      {palmTrees.map((p, i) => (
        <PalmTree key={i} position={p} seed={i} />
      ))}
    </group>
  );
}

// A real grid of lit/unlit windows on one face per building, instead
// of a handful of flat strips — reads as an actual building facade
// rather than a decorated box. Kept to a single face and a capped row
// count for draw-call/perf sanity (this is still all procedural
// geometry, no textures).
function BuildingWindows({ w, h, d, seed }: { w: number; h: number; d: number; seed: number }) {
  const items = useMemo(() => {
    const rand = seededRandom(seed * 97 + 13);
    const rows = Math.min(6, Math.max(2, Math.floor(h / 1.4)));
    const cols = 3;
    const cellH = h / (rows + 1);
    const out: { x: number; y: number; lit: boolean; color: string }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({
          x: (c - (cols - 1) / 2) * (d * 0.3),
          y: -h / 2 + cellH * (r + 1),
          lit: rand() > 0.55,
          color: rand() > 0.5 ? "#FF2E93" : "#22D3EE",
        });
      }
    }
    return { rows, cellH, out };
  }, [h, d, seed]);

  return (
    <group position={[w / 2 + 0.01, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      {items.out.map((win, i) => (
        <mesh key={i} position={[win.x, win.y, 0]}>
          <planeGeometry args={[d * 0.18, items.cellH * 0.55]} />
          <meshStandardMaterial
            color={win.lit ? win.color : "#1A1428"}
            emissive={win.lit ? win.color : "#000000"}
            emissiveIntensity={win.lit ? 1.6 : 0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function PalmTree({ position, seed }: { position: [number, number, number]; seed: number }) {
  const rand = useMemo(() => seededRandom(seed * 13 + 5), [seed]);
  const height = 3 + rand() * 1.5;
  const lean = (rand() - 0.5) * 0.15;
  const fronds = useMemo(
    () => Array.from({ length: 6 }).map((_, i) => (i / 6) * Math.PI * 2 + rand()),
    [rand]
  );

  return (
    <group position={position} rotation={[0, rand() * Math.PI, 0]}>
      <mesh position={[0, height / 2, 0]} rotation={[0, 0, lean]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, height, 6]} />
        <meshStandardMaterial color="#3A2E22" roughness={0.9} />
      </mesh>
      {fronds.map((angle, i) => (
        <mesh
          key={i}
          position={[0, height, 0]}
          rotation={[Math.PI / 5, angle, 0]}
          castShadow
        >
          <coneGeometry args={[0.25, 1.6, 4]} />
          <meshStandardMaterial color="#1F4A3A" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Car({
  position,
  rotationY = 0,
  color = "#2E2450",
}: {
  position: [number, number, number];
  rotationY?: number;
  color?: string;
}) {
  const wheelPositions: [number, number, number][] = [
    [-0.55, 0.25, 0.8],
    [0.55, 0.25, 0.8],
    [-0.55, 0.25, -0.8],
    [0.55, 0.25, -0.8],
  ];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.5, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.75, -0.2]} castShadow>
        <boxGeometry args={[0.9, 0.4, 1.1]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </mesh>
      <mesh position={[0.35, 0.4, 1.19]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshStandardMaterial color="#FFF7D6" emissive="#FFF7D6" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <mesh position={[-0.35, 0.4, 1.19]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshStandardMaterial color="#FFF7D6" emissive="#FFF7D6" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <mesh position={[0.35, 0.4, -1.19]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshStandardMaterial color="#FF2E44" emissive="#FF2E44" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      <mesh position={[-0.35, 0.4, -1.19]}>
        <boxGeometry args={[0.2, 0.12, 0.05]} />
        <meshStandardMaterial color="#FF2E44" emissive="#FF2E44" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
      {wheelPositions.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
          <meshStandardMaterial color="#0B0712" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function StreetLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 3, 8]} />
        <meshStandardMaterial color="#170F26" roughness={0.7} />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#FFE9B0" emissive="#FFE9B0" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 3.05, 0]} color="#FFD98A" intensity={4} distance={10} decay={2} />
    </group>
  );
}

// Wet-asphalt look — a single reflective ground plane (one real-time
// planar reflection, not one per road strip, for performance) rather
// than a flat-colored surface. This is what actually gets the
// rain-slicked, neon-reflected street look from the reference mockups;
// flat color alone can't fake it. Lane markings are thin emissive
// planes laid on top.
function Ground() {
  const roadLines = useMemo(() => {
    const lines: { pos: [number, number, number]; size: [number, number]; vertical: boolean }[] = [];
    for (let g = -GRID; g <= GRID; g += 3) {
      lines.push({ pos: [g * BLOCK, 0.02, 0], size: [4, GRID * BLOCK * 2 + 8], vertical: true });
      lines.push({ pos: [0, 0.02, g * BLOCK], size: [GRID * BLOCK * 2 + 8, 4], vertical: false });
    }
    return lines;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GRID * BLOCK * 2 + 20, GRID * BLOCK * 2 + 20]} />
        <MeshReflectorMaterial
          blur={[80, 25]}
          resolution={768}
          mixBlur={1.2}
          mixStrength={6}
          roughness={0.25}
          depthScale={0.6}
          minDepthThreshold={0.6}
          maxDepthThreshold={1.4}
          color="#100C1C"
          metalness={0.5}
        />
      </mesh>
      {roadLines.map((r, i) => (
        <mesh key={i} position={[r.pos[0], 0.02, r.pos[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={r.vertical ? [0.25, r.size[1]] : [r.size[0], 0.25]} />
          <meshStandardMaterial color="#F2C744" emissive="#F2C744" emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// Owns the player's position, facing, walk-cycle animation, and the
// chase camera entirely through its own local refs (never received as
// a prop to mutate) — keyboard input, the per-frame position update,
// the articulated character, and the camera follow all live in one
// component so nothing here mutates state it doesn't own.
function PlayerRig() {
  const playerGroup = useRef<THREE.Group>(null);
  const position = useRef(new THREE.Vector3(0, 0, 0));
  const facing = useRef(0);
  const walkPhase = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraLookAt = useRef(new THREE.Vector3());

  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const speed = 6 * delta;
    const k = keys.current;
    let dx = 0;
    let dz = 0;
    if (k["w"] || k["arrowup"]) dz -= 1;
    if (k["s"] || k["arrowdown"]) dz += 1;
    if (k["a"] || k["arrowleft"]) dx -= 1;
    if (k["d"] || k["arrowright"]) dx += 1;
    const moving = dx !== 0 || dz !== 0;

    if (moving) {
      const len = Math.hypot(dx, dz) || 1;
      position.current.x += (dx / len) * speed;
      position.current.z += (dz / len) * speed;
      facing.current = Math.atan2(dx, dz);
      walkPhase.current += delta * 10;
    }

    if (playerGroup.current) {
      playerGroup.current.position.copy(position.current);
      playerGroup.current.rotation.y = facing.current;
    }

    const swing = moving ? Math.sin(walkPhase.current) * 0.7 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing;
    if (rightArm.current) rightArm.current.rotation.x = swing;

    // Chase camera stays behind the character relative to facing, not
    // a fixed world offset — turns with the player like a real
    // third-person camera.
    const fx = Math.sin(facing.current);
    const fz = Math.cos(facing.current);
    cameraTarget.current.set(
      position.current.x - fx * 8,
      position.current.y + 5.5,
      position.current.z - fz * 8
    );
    camera.position.lerp(cameraTarget.current, 0.08);
    cameraLookAt.current.lerp(position.current, 0.15);
    camera.lookAt(cameraLookAt.current.x, cameraLookAt.current.y + 1, cameraLookAt.current.z);
  });

  return (
    <group ref={playerGroup}>
      {/* torso */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.3]} />
        <meshStandardMaterial color="#FF2E93" roughness={0.5} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#F5F1FA" roughness={0.6} />
      </mesh>
      {/* legs — each a group pivoted at the hip so rotation swings
          like a real limb instead of spinning around its own middle */}
      <group ref={leftLeg} position={[-0.15, 0.65, 0]}>
        <mesh position={[0, -0.325, 0]} castShadow>
          <boxGeometry args={[0.18, 0.65, 0.18]} />
          <meshStandardMaterial color="#170F26" roughness={0.6} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.15, 0.65, 0]}>
        <mesh position={[0, -0.325, 0]} castShadow>
          <boxGeometry args={[0.18, 0.65, 0.18]} />
          <meshStandardMaterial color="#170F26" roughness={0.6} />
        </mesh>
      </group>
      {/* arms — pivoted at the shoulder */}
      <group ref={leftArm} position={[-0.35, 1.3, 0]}>
        <mesh position={[0, -0.275, 0]} castShadow>
          <boxGeometry args={[0.15, 0.55, 0.15]} />
          <meshStandardMaterial color="#FF2E93" roughness={0.5} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.35, 1.3, 0]}>
        <mesh position={[0, -0.275, 0]} castShadow>
          <boxGeometry args={[0.15, 0.55, 0.15]} />
          <meshStandardMaterial color="#FF2E93" roughness={0.5} />
        </mesh>
      </group>
      <pointLight position={[0, 2.0, 0]} color="#FF2E93" intensity={0.4} distance={3} decay={2} />
    </group>
  );
}

export default function World3DScene() {
  return (
    <Canvas shadows camera={{ fov: 55, position: [0, 5.5, -8] }} className="!h-full !w-full">
      <color attach="background" args={["#0B0712"]} />
      <fog attach="fog" args={["#150E24", 25, 80]} />
      <hemisphereLight args={["#6F7FE0", "#0B0712", 1.1]} />
      <ambientLight intensity={0.5} color="#6B5AA0" />
      <directionalLight
        position={[15, 25, 10]}
        intensity={2.8}
        color="#B7C4FF"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Stars radius={80} depth={30} count={2500} factor={3} saturation={0} fade speed={0.5} />
      <Ground />
      <City />
      <PlayerRig />
      <EffectComposer>
        <N8AO aoRadius={2.5} intensity={2.2} distanceFalloff={1} />
        <Bloom luminanceThreshold={0.45} luminanceSmoothing={0.9} intensity={0.6} mipmapBlur />
        <Vignette eskil={false} offset={0.3} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
