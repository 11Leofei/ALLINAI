"use client";

import { useProjects } from "@/lib/hooks/use-projects";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/project/create-dialog";
import { SearchFilterBar } from "@/components/search/search-filter-bar";
import { DiscoverReposDialog } from "@/components/ai/discover-repos-dialog";
import { MissionControl } from "@/components/dashboard/mission-control";
import { AccountabilityCard } from "@/components/dashboard/accountability-card";
import { OnboardingCard } from "@/components/dashboard/onboarding";
import { ProjectQuickActions } from "@/components/dashboard/project-quick-actions";
import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import {
  STAGE_ORDER,
  STAGE_COLORS,
  type Project,
  type ProjectStage,
} from "@/types";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";

const PIE_COLORS: Record<string, string> = {
  idea: "#a855f7",
  development: "#3b82f6",
  launch: "#f97316",
  validation: "#22c55e",
  data_collection: "#14b8a6",
  archived: "#9ca3af",
};

function getStaleProjects(projects: Project[]): Project[] {
  const thresholds: Record<string, number> = {
    idea: 3,
    development: 5,
    launch: 7,
    validation: 5,
    data_collection: 7,
  };
  return projects.filter((p) => {
    if (p.stage === "archived") return false;
    const threshold = thresholds[p.stage] || 5;
    const days = (Date.now() - p.stageEnteredAt) / (1000 * 60 * 60 * 24);
    return days >= threshold;
  });
}

// Stage-aware next action hints
function getNextActionHint(
  project: Project,
  locale: string
): string | null {
  const hints: Record<string, { zh: string; en: string }> = {
    idea: { zh: "定义验证标准，开始行动", en: "Define validation criteria" },
    development: { zh: "推进核心功能，别拖", en: "Ship the core feature" },
    launch: { zh: "发布出去，收集反馈", en: "Launch & gather feedback" },
    validation: { zh: "验证清单还没做完", en: "Complete validation items" },
    data_collection: { zh: "分析数据，做决策", en: "Analyze data & decide" },
  };
  const hint = hints[project.stage];
  if (!hint) return null;
  return locale === "zh" ? hint.zh : hint.en;
}

export default function DashboardPage() {
  const { projects, isLoading, mutate } = useProjects();
  const { t, stageLabel, locale } = useLocale();
  const [showCreate, setShowCreate] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (stageFilter !== "all") {
      result = result.filter((p) => p.stage === stageFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((p) => p.priority === parseInt(priorityFilter));
    }
    return result;
  }, [projects, searchQuery, stageFilter, priorityFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.stage !== "archived");
  const globalMomentum =
    activeProjects.length > 0
      ? Math.round(
          activeProjects.reduce((sum, p) => sum + p.momentum, 0) /
            activeProjects.length
        )
      : 0;

  const staleProjects = getStaleProjects(projects);
  const displayProjects = filteredProjects;
  const recentProjects = [...displayProjects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const topMomentumProjects = [...activeProjects]
    .sort((a, b) => b.momentum - a.momentum)
    .slice(0, 5);

  const stageCounts: Record<string, number> = {};
  for (const stage of STAGE_ORDER) {
    stageCounts[stage] = projects.filter((p) => p.stage === stage).length;
  }

  const pieData = STAGE_ORDER.filter(
    (s) => s !== "archived" && stageCounts[s] > 0
  ).map((stage) => ({
    name: stageLabel(stage),
    value: stageCounts[stage],
    stage,
  }));

  const getMomentumStatus = (
    momentum: number
  ): { label: string; color: string } => {
    if (momentum >= 80)
      return { label: t("dashboard.momentumStrong"), color: "text-green-600" };
    if (momentum >= 60)
      return { label: t("dashboard.momentumGood"), color: "text-blue-600" };
    if (momentum >= 40)
      return {
        label: t("dashboard.momentumNeedsPush"),
        color: "text-yellow-600",
      };
    return { label: t("dashboard.momentumLow"), color: "text-red-500" };
  };

  const momentumStatus = getMomentumStatus(globalMomentum);

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
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

      {/* Onboarding — first time empty */}
      {projects.length === 0 && (
        <OnboardingCard
          onCreateProject={() => setShowCreate(true)}
          onDiscover={() => {}}
        />
      )}

      {/* === MISSION CONTROL — the action center === */}
      {projects.length > 0 && <MissionControl />}

      {/* Compact stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Global Momentum */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t("dashboard.globalMomentum")}
            </p>
            <span className={`text-xs font-medium ${momentumStatus.color}`}>
              {momentumStatus.label}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold">{globalMomentum}</span>
            <span className="text-sm text-muted-foreground mb-0.5">/100</span>
          </div>
          <Progress value={globalMomentum} className="h-1.5 mt-2" />
        </Card>

        {/* Total projects */}
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {t("dashboard.totalProjects")}
          </p>
          <p className="text-3xl font-bold">{projects.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("dashboard.activeCount", {
              active: activeProjects.length,
              archived: projects.length - activeProjects.length,
            })}
          </p>
        </Card>

        {/* Needs Attention */}
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {t("dashboard.needsAttention")}
          </p>
          <p
            className={`text-3xl font-bold ${
              staleProjects.length > 0 ? "text-orange-500" : "text-green-600"
            }`}
          >
            {staleProjects.length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {staleProjects.length === 0
              ? t("dashboard.allGood")
              : t("dashboard.projectsNeedAction")}
          </p>
        </Card>

        {/* Stage mini chart */}
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t("dashboard.stageDistribution")}
          </p>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-2">
              <ResponsiveContainer width={60} height={60}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={16}
                    outerRadius={28}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.stage}
                        fill={PIE_COLORS[entry.stage]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-0.5 flex-1 min-w-0">
                {pieData.slice(0, 3).map((entry) => (
                  <div key={entry.stage} className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[entry.stage] }}
                    />
                    <span className="text-xs truncate">{entry.name}</span>
                    <span className="text-xs font-medium ml-auto">
                      {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noProjects")}
            </p>
          )}
        </Card>
      </div>

      {/* Search & Filter */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
      />

      {/* Project lists — with inline quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention — actionable */}
        <Card className="p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            {t("dashboard.needsAttention")}
            {staleProjects.length > 0 && (
              <Badge variant="destructive">{staleProjects.length}</Badge>
            )}
          </h2>
          {staleProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mb-1.5 text-green-500"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <p className="text-sm">{t("dashboard.allOnTrack")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {staleProjects.map((p) => {
                const days = Math.floor(
                  (Date.now() - p.stageEnteredAt) / (1000 * 60 * 60 * 24)
                );
                const hint = getNextActionHint(p, locale);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <span className="text-orange-500 flex-shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                      </svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {t("dashboard.daysInStage", {
                            days,
                            stage: stageLabel(p.stage),
                          })}
                        </p>
                        {hint && (
                          <span className="text-xs text-primary">
                            → {hint}
                          </span>
                        )}
                      </div>
                    </div>
                    <ProjectQuickActions
                      projectId={p.id}
                      projectName={p.name}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Momentum Ranking — actionable */}
        <Card className="p-5">
          <h2 className="font-semibold mb-3">{t("dashboard.topMomentum")}</h2>
          {topMomentumProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noProjects")}
            </p>
          ) : (
            <div className="space-y-1">
              {topMomentumProjects.map((p, idx) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group flex items-center gap-2.5 hover:bg-accent p-2 rounded-lg transition-colors"
                >
                  <span
                    className={`w-5 text-center text-xs font-bold ${
                      idx === 0
                        ? "text-yellow-500"
                        : idx === 1
                        ? "text-gray-400"
                        : idx === 2
                        ? "text-orange-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm flex-1 truncate">{p.name}</span>
                  <ProjectQuickActions
                    projectId={p.id}
                    projectName={p.name}
                  />
                  <Progress value={p.momentum} className="h-1.5 w-16" />
                  <span
                    className={`text-xs font-medium w-7 text-right ${
                      getMomentumStatus(p.momentum).color
                    }`}
                  >
                    {Math.round(p.momentum)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activity + Accountability */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity — 2 cols */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-3">{t("dashboard.recentActivity")}</h2>
          {recentProjects.length === 0 ? (
            <div className="flex flex-col items-center py-6">
              <p className="text-sm text-muted-foreground">
                {t("dashboard.noProjects")}
              </p>
              <CreateProjectDialog onCreated={() => mutate()}>
                <Button variant="link" className="mt-2">
                  {t("pipeline.createFirst")}
                </Button>
              </CreateProjectDialog>
            </div>
          ) : (
            <div className="space-y-1">
              {recentProjects.map((p) => {
                const hint = getNextActionHint(p, locale);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="group flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div
                      className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                        STAGE_COLORS[p.stage]
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {p.name}
                      </span>
                      {hint && (
                        <span className="text-xs text-muted-foreground">
                          {hint}
                        </span>
                      )}
                    </div>
                    <ProjectQuickActions
                      projectId={p.id}
                      projectName={p.name}
                    />
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {stageLabel(p.stage)}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {timeAgo(p.updatedAt)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Accountability card — 1 col */}
        <AccountabilityCard />
      </div>
    </div>
  );
}
