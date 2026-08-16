"use client";

import { useRef, type RefObject } from "react";

const BASE_RADIUS = 48; // px, matches the w-24/h-24 base below
const DEAD_ZONE = 0.12; // ignore tiny accidental drags near center

// Writes directly into a mutable ref rather than React state, same
// reasoning as keysRef in WorldCanvas: this updates continuously while
// dragging, and the game loop already polls input once per animation
// frame — routing it through setState would mean 60+ re-renders a
// second for a value nothing in the render tree actually needs to read.
export interface JoystickVector {
  dx: number;
  dy: number;
}

export default function TouchJoystick({
  vectorRef,
}: {
  vectorRef: RefObject<JoystickVector>;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);

  function updateFromPointer(clientX: number, clientY: number) {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = (clientX - centerX) / BASE_RADIUS;
    let dy = (clientY - centerY) / BASE_RADIUS;
    const mag = Math.hypot(dx, dy);

    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    if (mag < DEAD_ZONE) {
      dx = 0;
      dy = 0;
    }

    vectorRef.current.dx = dx;
    vectorRef.current.dy = dy;
    knob.style.transform = `translate(${dx * BASE_RADIUS}px, ${dy * BASE_RADIUS}px)`;
  }

  function reset() {
    activePointerId.current = null;
    vectorRef.current.dx = 0;
    vectorRef.current.dy = 0;
    const knob = knobRef.current;
    if (knob) knob.style.transform = "translate(0px, 0px)";
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    updateFromPointer(e.clientX, e.clientY);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== e.pointerId) return;
    updateFromPointer(e.clientX, e.clientY);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== e.pointerId) return;
    reset();
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative h-24 w-24 select-none rounded-full border border-asphalt-line bg-black/40 backdrop-blur-sm"
      style={{ touchAction: "none" }}
      aria-label="Move — drag to walk around The Block"
    >
      <div
        ref={knobRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2
                   rounded-full bg-gradient-to-br from-sunset-amber to-sunset-magenta shadow-lg"
      />
    </div>
  );
}
