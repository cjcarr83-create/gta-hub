// The signature reputation element (see 11_gta_identity §5): a 0–5 star
// "wanted level" that rises with community engagement. Purely cosmetic
// status, not gameplay-affecting. Deliberately not a generic follower count.

export default function WantedStars({
  level,
  size = "sm",
}: {
  level: number;
  size?: "sm" | "lg";
}) {
  const clamped = Math.max(0, Math.min(5, level));
  const starSize = size === "lg" ? "text-2xl" : "text-sm";

  return (
    <div
      className={`flex gap-0.5 ${starSize}`}
      role="img"
      aria-label={`Wanted level ${clamped} of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={
            i < clamped
              ? "bg-gradient-to-br from-neon-pink to-neon-violet bg-clip-text text-transparent"
              : "text-ink-line"
          }
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}
