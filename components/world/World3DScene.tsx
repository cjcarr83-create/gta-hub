"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// Phase 1 prototype of a real 3D version of The Block — see
// app/world/3d-preview/page.tsx. Deliberately built from primitive
// geometry (boxes, cylinders, capsules) rather than downloaded models:
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

  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.h / 2, b.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.color} roughness={0.85} />
          </mesh>
          {/* Neon "window" strips — a handful of small emissive planes
              per building rather than a texture, keeps the night-city
              feel with zero external assets. */}
          {Array.from({ length: 3 }).map((_, wi) => (
            <mesh
              key={wi}
              position={[b.w / 2 + 0.01, b.h / 2 - 1 - wi * 2, 0]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <planeGeometry args={[b.d * 0.6, 0.4]} />
              <meshStandardMaterial
                color={wi % 2 === 0 ? "#FF2E93" : "#22D3EE"}
                emissive={wi % 2 === 0 ? "#FF2E93" : "#22D3EE"}
                emissiveIntensity={1.4}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Ground() {
  const roadLines = useMemo(() => {
    const lines: { pos: [number, number, number]; size: [number, number] }[] = [];
    for (let g = -GRID; g <= GRID; g += 3) {
      lines.push({ pos: [g * BLOCK, 0.01, 0], size: [4, GRID * BLOCK * 2 + 8] });
      lines.push({ pos: [0, 0.01, g * BLOCK], size: [GRID * BLOCK * 2 + 8, 4] });
    }
    return lines;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GRID * BLOCK * 2 + 20, GRID * BLOCK * 2 + 20]} />
        <meshStandardMaterial color="#1C1430" roughness={1} />
      </mesh>
      {roadLines.map((r, i) => (
        <mesh key={i} position={r.pos} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={r.size} />
          <meshStandardMaterial color="#2E2450" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Owns the player's position and the chase camera entirely through its
// own local refs (never received as a prop to mutate) — keyboard input,
// the per-frame position update, the player mesh, and the camera follow
// all live in one component so nothing here mutates state it doesn't
// own.
function PlayerRig() {
  const playerGroup = useRef<THREE.Group>(null);
  const position = useRef(new THREE.Vector3(0, 0, 0));
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraLookAt = useRef(new THREE.Vector3());

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
    if (k["w"] || k["arrowup"]) position.current.z -= speed;
    if (k["s"] || k["arrowdown"]) position.current.z += speed;
    if (k["a"] || k["arrowleft"]) position.current.x -= speed;
    if (k["d"] || k["arrowright"]) position.current.x += speed;

    if (playerGroup.current) {
      playerGroup.current.position.copy(position.current);
    }

    cameraTarget.current.set(position.current.x, position.current.y + 6, position.current.z + 9);
    camera.position.lerp(cameraTarget.current, 0.08);
    cameraLookAt.current.lerp(position.current, 0.15);
    camera.lookAt(cameraLookAt.current.x, cameraLookAt.current.y + 1, cameraLookAt.current.z);
  });

  return (
    <group ref={playerGroup}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.4, 1.0, 4, 8]} />
        <meshStandardMaterial color="#FF2E93" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.75, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#F5F1FA" roughness={0.6} />
      </mesh>
      <pointLight position={[0, 2.2, 0]} color="#FF2E93" intensity={2} distance={4} />
    </group>
  );
}

export default function World3DScene() {
  return (
    <Canvas shadows camera={{ fov: 55 }} className="!h-full !w-full">
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
      <Ground />
      <City />
      <PlayerRig />
    </Canvas>
  );
}
