"use client";

import { MISSIONS, type MissionId } from "@/lib/world/missions";

export default function MissionBoard({
  activeMissionId,
  onStart,
  onAbandon,
}: {
  activeMissionId: MissionId | null;
  onStart: (id: MissionId) => void;
  onAbandon: () => void;
}) {
  return (
    <div className="card mt-4">
      <h2 className="mb-2 text-sm uppercase tracking-wide text-frost-muted">Jobs board</h2>
      <div className="space-y-2">
        {Object.values(MISSIONS).map((m) => {
          const active = activeMissionId === m.id;
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-sm border border-ink-line p-2">
              <div>
                <p className="text-sm">
                  {m.title} <span className="text-neon-pink">+{m.rep} rep</span>
                </p>
                <p className="text-xs text-frost-muted">{m.brief}</p>
              </div>
              {active ? (
                <button onClick={onAbandon} className="shrink-0 rounded-sm border border-blood px-2 py-1 text-xs text-blood">
                  Abandon
                </button>
              ) : (
                <button
                  onClick={() => onStart(m.id)}
                  disabled={activeMissionId !== null}
                  className="btn-primary shrink-0 text-xs disabled:opacity-40"
                >
                  Start
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
