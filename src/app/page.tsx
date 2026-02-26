"use client";

import { useProjects } from "@/lib/hooks/use-projects";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/project/create-dialog";
import { DiscoverReposDialog } from "@/components/ai/discover-repos-dialog";
import { MissionControl } from "@/components/dashboard/mission-control";
import { AccountabilityCard } from "@/components/dashboard/accountability-card";
import { OnboardingCard } from "@/components/dashboard/onboarding";
import {
  StaleDecisionCard,
  getStaleProjectsForDecision,
} from "@/components/dashboard/stale-decision";
import { ProjectQuickActions } from "@/components/dashboard/project-quick-actions";
import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { STAGE_COLORS, type ProjectStage } from "@/types";

export default function DashboardPage() {
  const { projects, isLoading, mutate } = useProjects();
  const { t, stageLabel, locale } = useLocale();
  const [decisionKey, setDecisionKey] = useState(0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.stage !== "archived");
  const staleProjects = getStaleProjectsForDecision(projects);

  // Recent projects — only the few that matter
  const recentProjects = [...activeProjects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t("card.justNow");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("card.minutesAgo", { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("card.hoursAgo", { n: hours });
    const days = Math.floor(hours / 24);
    return t("card.daysAgo", { n: days });
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      {/* Minimal header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {activeProjects.length}{" "}
            {locale === "zh" ? "个活跃项目" : "active"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DiscoverReposDialog
            onImport={async (data) => {
              await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              });
              mutate();
            }}
          />
          <CreateProjectDialog onCreated={() => mutate()} />
        </div>
      </div>

      {/* Onboarding */}
      {projects.length === 0 && (
        <OnboardingCard
          onCreateProject={() => {}}
          onDiscover={() => {}}
        />
      )}

      {/* === THE CORE: Mission Control === */}
      {projects.length > 0 && <MissionControl />}

      {/* === FORCED DECISIONS — stale projects === */}
      {staleProjects.length > 0 && (
        <div className="space-y-3" key={decisionKey}>
          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">
            {locale === "zh"
              ? "你需要做决定"
              : "YOU NEED TO DECIDE"}
          </p>
          {staleProjects.map((p) => (
            <StaleDecisionCard
              key={p.id}
              project={p}
              onDecided={() => {
                mutate();
                setDecisionKey((k) => k + 1);
              }}
            />
          ))}
        </div>
      )}

      {/* === Recent projects — compact, actionable === */}
      {recentProjects.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {locale === "zh" ? "你的项目" : "YOUR PROJECTS"}
          </p>
          <Card className="divide-y">
            {recentProjects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                    STAGE_COLORS[p.stage as ProjectStage]
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stageLabel(p.stage)} · {timeAgo(p.updatedAt)}
                  </p>
                </div>
                <ProjectQuickActions
                  projectId={p.id}
                  projectName={p.name}
                />
                {p.momentum < 30 && (
                  <Badge variant="destructive" className="text-xs">
                    {locale === "zh" ? "危险" : "Low"}
                  </Badge>
                )}
              </Link>
            ))}
          </Card>
          {activeProjects.length > 5 && (
            <Link
              href="/pipeline"
              className="block text-xs text-center text-primary hover:underline mt-2"
            >
              {locale === "zh"
                ? `查看全部 ${activeProjects.length} 个项目 →`
                : `View all ${activeProjects.length} projects →`}
            </Link>
          )}
        </div>
      )}

      {/* Accountability — compact, at bottom */}
      {projects.length > 0 && <AccountabilityCard />}
    </div>
  );
}
