"use client";

import type { RefObject } from "react";
import TouchJoystick, { type JoystickVector } from "@/components/world/TouchJoystick";
import { CONTROLLER_SCHEMES, type ControllerScheme } from "@/lib/world/controller";

// The touch control surface for The Block: a joystick on the left and
// a scheme-styled button diamond on the right. See lib/world/controller.ts
// for the IP reasoning behind the two "console-style" layouts being
// original geometry/letters rather than brand glyphs.
//
// Only "attack", "chat", and "interact" (get in/out of a vehicle) do
// anything today. "emote" is a no-op placeholder — flagged in
// ROUND10_CHANGELOG.md rather than shipping a dead button silently.
export default function VirtualController({
  scheme,
  vectorRef,
  onAttack,
  onChat,
  onInteract,
  attackDisabled,
}: {
  scheme: ControllerScheme;
  vectorRef: RefObject<JoystickVector>;
  onAttack: () => void;
  onChat: () => void;
  onInteract: () => void;
  attackDisabled: boolean;
}) {
  const def = CONTROLLER_SCHEMES[scheme];
  const [top, right, bottom, left] = def.buttons;

  function handlerFor(action: string) {
    if (action === "attack") return onAttack;
    if (action === "chat") return onChat;
    if (action === "interact") return onInteract;
    return () => {};
  }

  if (scheme === "minimal") {
    return (
      <>
        <div className="absolute bottom-4 left-4">
          <TouchJoystick vectorRef={vectorRef} />
        </div>
        <div className="absolute bottom-4 right-4 flex flex-col items-center gap-2">
          <FaceButton glyph="E" accent="#888" ariaLabel="Interact" onPress={onInteract} disabled={false} />
          <FaceButton
            glyph={bottom.glyph}
            accent={bottom.accent}
            ariaLabel={bottom.ariaLabel}
            onPress={onAttack}
            disabled={attackDisabled}
            size="lg"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="absolute bottom-4 left-4">
        <TouchJoystick vectorRef={vectorRef} />
      </div>
      <div className="absolute bottom-3 right-3 h-32 w-32">
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <FaceButton glyph={top.glyph} accent={top.accent} ariaLabel={top.ariaLabel} onPress={handlerFor(top.action)} disabled={false} />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <FaceButton glyph={right.glyph} accent={right.accent} ariaLabel={right.ariaLabel} onPress={handlerFor(right.action)} disabled={false} />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <FaceButton
            glyph={bottom.glyph}
            accent={bottom.accent}
            ariaLabel={bottom.ariaLabel}
            onPress={handlerFor(bottom.action)}
            disabled={bottom.action === "attack" ? attackDisabled : false}
          />
        </div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <FaceButton glyph={left.glyph} accent={left.accent} ariaLabel={left.ariaLabel} onPress={handlerFor(left.action)} disabled={false} />
        </div>
      </div>
    </>
  );
}

function FaceButton({
  glyph,
  accent,
  ariaLabel,
  onPress,
  disabled,
  size = "md",
}: {
  glyph: string;
  accent: string;
  ariaLabel: string;
  onPress: () => void;
  disabled: boolean;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "h-16 w-16 text-2xl" : "h-11 w-11 text-base";
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onPress();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${dim} select-none rounded-full border-2 bg-black/50 font-display font-bold text-frost shadow-lg backdrop-blur-sm active:scale-95 disabled:opacity-40`}
      style={{ borderColor: accent, color: accent, touchAction: "none" }}
    >
      {glyph}
    </button>
  );
}
