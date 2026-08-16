// Virtual controller schemes for The Block's touch controls.
//
// IP note, up front: these are ORIGINAL layouts inspired by the two
// familiar console button-diamond conventions — one using shape
// symbols, one using letters — not reproductions of Sony's or
// Microsoft's actual trademarked button glyphs, colorways, or
// controller silhouettes. The shapes below (triangle/circle/x/square as
// abstract geometry, or A/B/X/Y as plain letters) are generic enough to
// be common gaming vocabulary; the exact brand rendering, colors, and
// controller body are not reproduced. Same reasoning as everything else
// in this project's copyright posture. Names shown to users are
// "Shapes" and "Letters", not brand names.

export type ControllerScheme = "shapes" | "letters" | "minimal";


export interface ControllerButtonDef {
  action: "attack" | "interact" | "chat" | "emote";
  glyph: string; // rendered as text/unicode geometry, not an image asset
  ariaLabel: string;
  accent: string; // hex — original palette, not a brand colorway
}

export interface ControllerSchemeDef {
  id: ControllerScheme;
  label: string;
  description: string;
  // Diamond positions: top, right, bottom, left
  buttons: [ControllerButtonDef, ControllerButtonDef, ControllerButtonDef, ControllerButtonDef];
}

export const CONTROLLER_SCHEMES: Record<ControllerScheme, ControllerSchemeDef> = {
  shapes: {
    id: "shapes",
    label: "Shapes",
    description: "Four geometric buttons — triangle on top, X on the bottom.",
    buttons: [
      { action: "emote", glyph: "△", ariaLabel: "Emote", accent: "#3FA47A" },
      { action: "interact", glyph: "○", ariaLabel: "Interact", accent: "#E14F63" },
      { action: "attack", glyph: "✕", ariaLabel: "Attack", accent: "#5B8FD9" },
      { action: "chat", glyph: "□", ariaLabel: "Chat", accent: "#D97BC0" },
    ],
  },
  letters: {
    id: "letters",
    label: "Letters",
    description: "Four lettered buttons — Y on top, A on the bottom.",
    buttons: [
      { action: "emote", glyph: "Y", ariaLabel: "Emote", accent: "#E8C33B" },
      { action: "interact", glyph: "B", ariaLabel: "Interact", accent: "#D9503F" },
      { action: "attack", glyph: "A", ariaLabel: "Attack", accent: "#5CB85C" },
      { action: "chat", glyph: "X", ariaLabel: "Chat", accent: "#4A90D9" },
    ],
  },
  minimal: {
    id: "minimal",
    label: "Minimal",
    description: "Just a stick and one attack button.",
    buttons: [
      { action: "emote", glyph: "", ariaLabel: "Emote", accent: "#888" },
      { action: "interact", glyph: "", ariaLabel: "Interact", accent: "#888" },
      { action: "attack", glyph: "!", ariaLabel: "Attack", accent: "#C1373F" },
      { action: "chat", glyph: "", ariaLabel: "Chat", accent: "#888" },
    ],
  },
};

export function isControllerScheme(v: unknown): v is ControllerScheme {
  return v === "shapes" || v === "letters" || v === "minimal";
}
