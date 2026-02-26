"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/lib/locale-context";
import { fetcher } from "@/lib/fetcher";

export function AccountabilityCard() {
  const { t } = useLocale();
  const { data } = useSWR("/api/accountability", fetcher, {
    refreshInterval: 300000,
  });

  if (!data) return null;

  const {
    score,
    ratingKey,
    streak,
    bestStreak,
    overdueCount,
    completionRate30,
    heatmap,
  } = data;

  // Score ring color
  const ringColor =
    score >= 85 ? "text-green-500" :
    score >= 70 ? "text-blue-500" :
    score >= 50 ? "text-yellow-500" :
    score >= 30 ? "text-orange-500" :
    "text-red-500";

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold mb-3">
        {t("accountability.title")}
      </h2>

      <div className="flex items-center gap-5">
        {/* Score circle */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r="36"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-muted/30"
            />
            <circle
              cx="40" cy="40" r="36"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className={ringColor}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{score}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          <p className={`text-sm font-semibold ${ringColor}`}>{t(ratingKey)}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-orange-500">🔥</span>
              <span className="text-muted-foreground">{t("accountability.streak")}</span>
              <span className="font-semibold">{t("accountability.days", { n: streak })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-500">⭐</span>
              <span className="text-muted-foreground">{t("accountability.best")}</span>
              <span className="font-semibold">{t("accountability.days", { n: bestStreak })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-500">✓</span>
              <span className="text-muted-foreground">{t("accountability.thirtyDay")}</span>
              <span className="font-semibold">{completionRate30}%</span>
            </div>
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-red-500">!</span>
                <span className="text-muted-foreground">{t("accountability.overdue")}</span>
                <span className="font-semibold text-red-500">{overdueCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 30-day heatmap */}
      {heatmap && heatmap.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            {t("accountability.last30")}
          </p>
          <div className="flex gap-0.5 flex-wrap">
            {heatmap.map((day: { date: string; total: number; completed: number; perfect: boolean }) => (
              <div
                key={day.date}
                className={`w-3.5 h-3.5 rounded-sm ${
                  day.total === 0
                    ? "bg-muted/40"
                    : day.perfect
                    ? "bg-green-500"
                    : day.completed > 0
                    ? "bg-yellow-400"
                    : "bg-red-400"
                }`}
                title={`${day.date}: ${day.completed}/${day.total}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted/40 inline-block" /> {t("accountability.none")}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> {t("accountability.miss")}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> {t("accountability.partial")}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> {t("accountability.perfect")}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
