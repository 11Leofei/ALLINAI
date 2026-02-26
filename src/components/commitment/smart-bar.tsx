"use client";

import { usePathname } from "next/navigation";
import { DailyCommitmentBar } from "./daily-commitment";

/**
 * Only shows the commitment bar on non-dashboard pages.
 * The dashboard has MissionControl which handles commitments inline.
 */
export function SmartCommitmentBar() {
  const pathname = usePathname();

  // Dashboard has its own MissionControl with commitments
  if (pathname === "/") return null;

  return <DailyCommitmentBar />;
}
