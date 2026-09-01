"use client";

import { useEffect, useState } from "react";

// Target date confirmed via web search at time of writing: Take-Two
// reaffirmed November 19, 2026 as GTA VI's release date as recently as
// July 2026 (CEO Strauss Zelnick, no further delays expected). Dates
// for unreleased games can still move — this is Rockstar/Take-Two's
// most recently confirmed date, not a guarantee. Update this constant
// if that changes.
const RELEASE_DATE = new Date("2026-11-19T00:00:00Z");

function getTimeParts(target: Date) {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const seconds = Math.floor((diffMs / 1000) % 60);
  return { days, hours, minutes, seconds };
}

export default function CountdownTimer() {
  const [parts, setParts] = useState(() => getTimeParts(RELEASE_DATE));

  useEffect(() => {
    const interval = setInterval(() => setParts(getTimeParts(RELEASE_DATE)), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!parts) {
    return <p className="text-lg text-neon-pink">It&apos;s launch day.</p>;
  }

  return (
    <div>
      <div className="flex gap-3">
        {[
          { label: "Days", value: parts.days },
          { label: "Hrs", value: parts.hours },
          { label: "Min", value: parts.minutes },
          { label: "Sec", value: parts.seconds },
        ].map((unit) => (
          <div key={unit.label} className="flex-1 rounded border border-ink-line bg-ink py-2 text-center">
            <div className="font-display text-2xl bg-gradient-to-r from-neon-pink to-neon-violet bg-clip-text text-transparent">
              {unit.value.toString().padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-frost-muted">{unit.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-frost-muted">
        Until GTA VI — November 19, 2026 (Rockstar/Take-Two&apos;s most recently confirmed date)
      </p>
    </div>
  );
}
