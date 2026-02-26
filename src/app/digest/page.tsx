"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Digest page is deprecated — redirects to dashboard which now includes
// all commitment tracking and daily briefing via MissionControl.
export default function DigestPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
