"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Ignore if command palette is open (Cmd+K handled there)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "g":
          // Go to dashboard
          e.preventDefault();
          router.push("/");
          break;
        case "p":
          // Go to pipeline
          e.preventDefault();
          router.push("/pipeline");
          break;
        case "d":
          // Go to digest
          e.preventDefault();
          router.push("/digest");
          break;
        case "r":
          // Go to report
          e.preventDefault();
          router.push("/report");
          break;
        case "s":
          // Go to settings
          e.preventDefault();
          router.push("/settings");
          break;
        case "?":
          // Show shortcut help - dispatch custom event
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("show-shortcuts-help"));
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return null;
}
