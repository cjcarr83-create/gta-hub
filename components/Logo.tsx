// Brand wordmark: bold block "GTA" + a brush-script "HUB" in the
// signature pink -> violet gradient, matching the reference mockup's
// two-tone logotype. Kept as one component so the exact treatment
// (fonts, sizing, gradient) only lives in one place.
export default function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const gta = size === "lg" ? "text-4xl" : "text-2xl";
  const hub = size === "lg" ? "text-5xl" : "text-3xl";

  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`font-display font-bold uppercase text-frost ${gta}`}>GTA</span>
      <span
        className={`font-script bg-gradient-to-r from-neon-pink to-neon-violet bg-clip-text text-transparent ${hub}`}
      >
        Hub
      </span>
    </span>
  );
}
