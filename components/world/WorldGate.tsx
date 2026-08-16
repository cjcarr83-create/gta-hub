"use client";

import { useState } from "react";
import ContentWarningGate from "@/components/world/ContentWarningGate";
import WorldRoom from "@/components/world/WorldRoom";
import type { ControllerScheme } from "@/lib/world/controller";

export default function WorldGate({
  userId,
  username,
  avatarUrl,
  isVerified,
  crewId,
  crewName,
  crewColorHex,
  initiallyAcknowledged,
  initialControllerScheme,
}: {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
  crewId: string | null;
  crewName: string | null;
  crewColorHex: string | null;
  initiallyAcknowledged: boolean;
  initialControllerScheme: ControllerScheme;
}) {
  const [acknowledged, setAcknowledged] = useState(initiallyAcknowledged);

  if (!acknowledged) {
    return <ContentWarningGate userId={userId} onAcknowledged={() => setAcknowledged(true)} />;
  }

  return (
    <WorldRoom
      userId={userId}
      username={username}
      avatarUrl={avatarUrl}
      isVerified={isVerified}
      crewId={crewId}
      crewName={crewName}
      crewColorHex={crewColorHex}
      initialControllerScheme={initialControllerScheme}
    />
  );
}
