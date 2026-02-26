"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocale } from "@/lib/locale-context";
import type { Nudge } from "@/types";

import { fetcher } from "@/lib/fetcher";

export function NotificationCenter() {
  const { t } = useLocale();
  const { data: nudges = [], mutate } = useSWR<Nudge[]>("/api/nudges", fetcher, {
    refreshInterval: 60000,
  });
  const [open, setOpen] = useState(false);

  const unreadNudges = nudges.filter((n) => !n.dismissed);
  const unreadCount = unreadNudges.length;

  const dismissNudge = async (id: string) => {
    await fetch("/api/nudges", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    mutate();
  };

  const dismissAll = async () => {
    await fetch("/api/nudges", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismissAll: true }),
    });
    mutate();
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">{t("notification.title")}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={dismissAll}>
              {t("notification.clearAll")}
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {nudges.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t("notification.empty")}
            </div>
          ) : (
            <div className="divide-y">
              {nudges.slice(0, 20).map((nudge) => (
                <div
                  key={nudge.id}
                  className={`px-4 py-3 text-sm ${nudge.dismissed ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-snug flex-1">{nudge.message}</p>
                    {!nudge.dismissed && (
                      <button
                        onClick={() => dismissNudge(nudge.id)}
                        className="text-xs text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
                      >
                        {t("notification.markRead")}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatTime(nudge.sentAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
