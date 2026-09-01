"use client";

import dynamic from "next/dynamic";

// Prototype-only route, not linked from anywhere in the app: a visual
// direction check for a real 3D rebuild of The Block (see
// components/world/World3DScene.tsx for the "why primitives, not
// downloaded assets" reasoning). Not wired to auth, real movement
// syncing, combat, or missions yet — that's deliberate, this is step
// one of a much larger project.
const World3DScene = dynamic(() => import("@/components/world/World3DScene"), { ssr: false });

export default function World3DPreviewPage() {
  return (
    <div className="fixed inset-0 bg-ink">
      <World3DScene />
      <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-ink-line bg-ink/80 px-3 py-2 text-xs text-frost-muted">
        3D prototype — WASD to move · not the live game
      </div>
    </div>
  );
}
