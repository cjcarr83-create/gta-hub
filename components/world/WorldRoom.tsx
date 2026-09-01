"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import WorldCanvas, { type WorldCanvasHandle } from "@/components/world/WorldCanvas";
import WorldChat, { type WorldChatHandle } from "@/components/world/WorldChat";
import ControllerPicker from "@/components/world/ControllerPicker";
import MissionBoard from "@/components/world/MissionBoard";
import TurfStatus from "@/components/world/TurfStatus";
import type { ControllerScheme } from "@/lib/world/controller";
import type { ActiveMission, MissionId } from "@/lib/world/missions";
import { TURF_ZONES } from "@/lib/world/map";

type TurfOwner = { crewId: string; crewName: string | null; color: string | null };

// Owns everything that needs to be shared between the canvas (which
// opens the Realtime channel) and the surrounding page UI (mission
// board, turf panel, controller picker, chat focus): the controller
// scheme preference, the active mission (so the board can show
// Start/Abandon correctly), and turf ownership (fetched once, then kept
// live via a postgres_changes subscription on world_turf — capture
// writes happen inside WorldCanvas's game loop, this just mirrors the
// result back out for the UI panels).
export default function WorldRoom({
  userId,
  username,
  avatarUrl,
  isVerified,
  crewId,
  crewName,
  crewColorHex,
  initialControllerScheme,
}: {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
  crewId: string | null;
  crewName: string | null;
  crewColorHex: string | null;
  initialControllerScheme: ControllerScheme;
}) {
  const canvasHandleRef = useRef<WorldCanvasHandle | null>(null);
  const chatHandleRef = useRef<WorldChatHandle | null>(null);
  const [scheme, setScheme] = useState<ControllerScheme>(initialControllerScheme);
  const [activeMission, setActiveMission] = useState<ActiveMission | null>(null);
  const [turfOwners, setTurfOwners] = useState<Map<string, TurfOwner>>(new Map());
  const [repGain, setRepGain] = useState<number | null>(null);

  const fetchTurf = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("world_turf")
      .select("zone_id, crew_id, crews(name, color_hex)");
    const next = new Map<string, TurfOwner>();
    if (data) {
      for (const row of data as unknown as Array<{
        zone_id: string;
        crew_id: string | null;
        crews: { name: string; color_hex: string | null } | null;
      }>) {
        if (row.crew_id) {
          next.set(row.zone_id, { crewId: row.crew_id, crewName: row.crews?.name ?? null, color: row.crews?.color_hex ?? null });
        }
      }
    }
    return next;
  }, []);

  // setState only ever happens inside a .then() callback here, never
  // synchronously in the effect body — fetchTurf itself has no side
  // effects, it just returns data. This is the pattern the
  // react-hooks/set-state-in-effect rule actually wants: "subscribe for
  // updates from an external system, calling setState in a callback
  // when it changes," not "call an async function that sets state" at
  // the top of the effect.
  const refreshTurf = useCallback(() => {
    fetchTurf().then(setTurfOwners);
  }, [fetchTurf]);

  useEffect(() => {
    let active = true;
    fetchTurf().then((next) => {
      if (active) setTurfOwners(next);
    });
    const supabase = createClient();
    const channel = supabase
      .channel("world_turf_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "world_turf" }, () => refreshTurf())
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTurf, refreshTurf]);

  useEffect(() => {
    if (repGain === null) return;
    const t = setTimeout(() => setRepGain(null), 2500);
    return () => clearTimeout(t);
  }, [repGain]);

  return (
    <>
      <ControllerPicker userId={userId} value={scheme} onChange={setScheme} />
      {repGain !== null && (
        <div className="mb-2 rounded-sm border border-neon-pink bg-black/40 px-3 py-1.5 text-center text-sm text-neon-pink">
          +{repGain} rep
        </div>
      )}
      <WorldCanvas
        ref={canvasHandleRef}
        userId={userId}
        username={username}
        avatarUrl={avatarUrl}
        isVerified={isVerified}
        crewId={crewId}
        crewName={crewName}
        crewColorHex={crewColorHex}
        controllerScheme={scheme}
        onChatRequested={() => chatHandleRef.current?.focusInput()}
        onMissionChange={setActiveMission}
        onMissionComplete={(_id, rep) => setRepGain(rep)}
        turfOwners={turfOwners}
        onTurfCaptured={refreshTurf}
      />
      <WorldChat ref={chatHandleRef} canvasRef={canvasHandleRef} />
      <MissionBoard
        activeMissionId={activeMission?.id as MissionId | null ?? null}
        onStart={(id) => canvasHandleRef.current?.startMission(id)}
        onAbandon={() => canvasHandleRef.current?.abandonMission()}
      />
      <TurfStatus turfOwners={turfOwners} />
      <p className="mt-2 text-[11px] text-frost-muted">
        {TURF_ZONES.length} turf zones on the map — check the minimap in the corner of The Block.
      </p>
    </>
  );
}
