"use client";

import { useProjects } from "@/lib/hooks/use-projects";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { type Project } from "@/types";

import { fetcher } from "@/lib/fetcher";

function getRecentWins(projects: Project[]): Project[] {
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  return projects.filter((p) => p.updatedAt >= twoDaysAgo && p.stage !== "archived");
}

export default function DigestPage() {
  const { projects, isLoading } = useProjects();
  const { t, stageLabel, locale } = useLocale();
  const { data: settings } = useSWR("/api/settings", fetcher);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  // Read thresholds from settings, falling back to defaults
  const staleThresholds: Record<string, number> = settings?.["nudge.staleThresholdDays"] ?? {
    idea: 3, development: 5, launch: 7, validation: 5, data_collection: 7,
  };

  const getStaleProjects = (projects: Project[]): (Project & { daysSinceStageEntry: number })[] => {
    return projects
      .filter((p) => {
        if (p.stage === "archived") return false;
        const threshold = staleThresholds[p.stage] || 5;
        const days = (Date.now() - p.stageEnteredAt) / (1000 * 60 * 60 * 24);
        return days >= threshold;
      })
      .map((p) => ({
        ...p,
        daysSinceStageEntry: Math.floor((Date.now() - p.stageEnteredAt) / (1000 * 60 * 60 * 24)),
      }))
      .sort((a, b) => b.daysSinceStageEntry - a.daysSinceStageEntry);
  };

  const today = new Date().toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const staleProjects = getStaleProjects(projects);
  const recentWins = getRecentWins(projects);
  const activeProjects = projects.filter((p) => p.stage !== "archived");
  const globalMomentum =
    activeProjects.length > 0
      ? Math.round(activeProjects.reduce((sum, p) => sum + p.momentum, 0) / activeProjects.length)
      : 0;

  const getActionSuggestion = () => {
    if (staleProjects.length > 0) {
      const top = staleProjects[0];
      return t("digest.focusOn", {
        name: top.name,
        stage: stageLabel(top.stage),
        days: top.daysSinceStageEntry,
      });
    }
    if (activeProjects.length === 0) {
      return t("digest.noSuggestion");
    }
    const lowestMomentum = [...activeProjects].sort((a, b) => a.momentum - b.momentum)[0];
    if (lowestMomentum && lowestMomentum.momentum < 50) {
      return t("digest.lowMomentum", {
        name: lowestMomentum.name,
        momentum: Math.round(lowestMomentum.momentum),
      });
    }
    return t("digest.allOnTrackKeepGoing");
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("digest.title")}</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Action Suggestion */}
      <Card className="p-6 border-primary/30 bg-primary/5">
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
          {t("digest.actionSuggestion")}
        </h2>
        <p className="text-sm">{getActionSuggestion()}</p>
      </Card>

      {/* Global Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">{t("digest.overallMomentum")}</h2>
          <span className="text-2xl font-bold">{globalMomentum}/100</span>
        </div>
        <Progress value={globalMomentum} className="h-3" />
        <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
          <span>{t("digest.activeCount", { count: activeProjects.length })}</span>
          <span>{t("digest.attentionCount", { count: staleProjects.length })}</span>
        </div>
      </Card>

      {/* Needs Attention */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          {t("digest.needsAttention")}
          {staleProjects.length > 0 && (
            <Badge variant="destructive">{staleProjects.length}</Badge>
          )}
        </h2>
        {staleProjects.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-green-500"><path d="M20 6 9 17l-5-5" /></svg>
            <p className="text-sm">{t("digest.allOnTrack")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {staleProjects.map((p, idx) => (
              <div key={p.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground mr-2">{idx + 1}.</span>
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  </div>
                  <Badge variant="outline">{stageLabel(p.stage)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("digest.stuckIn", { stage: stageLabel(p.stage), days: p.daysSinceStageEntry })}
                  {" "}
                  {p.stage === "idea" ? t("digest.ideaHint") : p.stage === "development" ? t("digest.devHint") : t("digest.defaultHint")}
                </p>
                <Link href={`/projects/${p.id}`}>
                  <Button size="sm" variant="outline">{t("digest.viewProject")}</Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Wins */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4">{t("digest.recentWins")}</h2>
        {recentWins.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("digest.noRecentWins")}</p>
        ) : (
          <div className="space-y-2">
            {recentWins.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M20 6 9 17l-5-5" /></svg>
                <Link href={`/projects/${p.id}`} className="text-sm hover:underline">{p.name}</Link>
                <span className="text-xs text-muted-foreground">
                  - {t("digest.activeIn", { stage: stageLabel(p.stage) })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
