"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { toast } from "sonner";
import type { Project, ProjectStage } from "@/types";

const STAGE_THRESHOLDS: Record<string, number> = {
  idea: 5,
  development: 7,
  launch: 10,
  validation: 7,
  data_collection: 10,
};

const NEXT_STAGE: Record<string, ProjectStage> = {
  idea: "development",
  development: "launch",
  launch: "validation",
  validation: "data_collection",
  data_collection: "archived",
};

interface StaleDecisionData {
  renewals: number;
  lastDecisionAt: number;
}

function getDecisionData(): Record<string, StaleDecisionData> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(
      localStorage.getItem("allinai-stale-decisions") || "{}"
    );
  } catch {
    return {};
  }
}

function saveDecisionData(data: Record<string, StaleDecisionData>) {
  localStorage.setItem("allinai-stale-decisions", JSON.stringify(data));
}

export function getStaleProjectsForDecision(projects: Project[]): Project[] {
  const decisions = getDecisionData();
  const now = Date.now();

  return projects.filter((p) => {
    if (p.stage === "archived") return false;
    const threshold = STAGE_THRESHOLDS[p.stage] || 7;
    const daysInStage =
      (now - p.stageEnteredAt) / (1000 * 60 * 60 * 24);
    if (daysInStage < threshold) return false;

    // Check if already decided recently (within the renewal period)
    const decision = decisions[p.id];
    if (decision) {
      const renewalDays = 3; // "3 more days" = 3 days grace
      const daysSinceDecision =
        (now - decision.lastDecisionAt) / (1000 * 60 * 60 * 24);
      if (daysSinceDecision < renewalDays) return false;
    }

    return true;
  });
}

export function StaleDecisionCard({
  project,
  onDecided,
}: {
  project: Project;
  onDecided: () => void;
}) {
  const { locale, stageLabel } = useLocale();
  const [loading, setLoading] = useState(false);

  const daysInStage = Math.floor(
    (Date.now() - project.stageEnteredAt) / (1000 * 60 * 60 * 24)
  );
  const decisions = getDecisionData();
  const renewals = decisions[project.id]?.renewals || 0;
  const maxRenewals = 3;
  const nextStage = NEXT_STAGE[project.stage];
  const gaveUp = renewals >= maxRenewals;

  const handleAdvance = async () => {
    if (!nextStage) return;
    setLoading(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      });
      // Clear decisions for this project
      const data = getDecisionData();
      delete data[project.id];
      saveDecisionData(data);
      toast.success(
        locale === "zh"
          ? `「${project.name}」推进到${stageLabel(nextStage)}`
          : `"${project.name}" advanced to ${stageLabel(nextStage)}`
      );
      onDecided();
    } finally {
      setLoading(false);
    }
  };

  const handleKill = async () => {
    setLoading(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "archived" }),
      });
      // Add a note explaining the kill
      await fetch(`/api/projects/${project.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            locale === "zh"
              ? `[决策] 主动放弃。在「${stageLabel(project.stage)}」阶段待了 ${daysInStage} 天后选择归档。放下也是进步。`
              : `[Decision] Abandoned. After ${daysInStage} days in ${stageLabel(project.stage)}. Letting go is progress too.`,
        }),
      });
      const data = getDecisionData();
      delete data[project.id];
      saveDecisionData(data);
      toast(
        locale === "zh" ? "放下也是进步。" : "Letting go is progress.",
        { duration: 4000 }
      );
      onDecided();
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = () => {
    const data = getDecisionData();
    data[project.id] = {
      renewals: (data[project.id]?.renewals || 0) + 1,
      lastDecisionAt: Date.now(),
    };
    saveDecisionData(data);

    const newRenewals = data[project.id].renewals;
    if (newRenewals >= maxRenewals) {
      toast(
        locale === "zh"
          ? `「${project.name}」已经续了 ${maxRenewals} 次了。你真的想做这个吗？`
          : `"${project.name}" extended ${maxRenewals} times. Do you really want this?`,
        { duration: 5000 }
      );
    } else {
      toast(
        locale === "zh"
          ? `再给 3 天。这是第 ${newRenewals} 次续期。`
          : `3 more days. This is extension #${newRenewals}.`,
        { duration: 3000 }
      );
    }
    onDecided();
  };

  return (
    <Card className="p-4 border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10">
      <div className="flex items-start gap-3">
        <span className="text-orange-500 mt-0.5 flex-shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
          <p className="text-sm font-bold">
            {locale === "zh"
              ? `「${project.name}」在「${stageLabel(project.stage)}」停了 ${daysInStage} 天`
              : `"${project.name}" stuck in ${stageLabel(project.stage)} for ${daysInStage} days`}
          </p>
          {gaveUp && (
            <p className="text-xs text-red-600 font-medium mt-0.5">
              {locale === "zh"
                ? `已续期 ${maxRenewals} 次。你真的想做这个吗？`
                : `Extended ${maxRenewals} times. Do you really want this?`}
            </p>
          )}
          {renewals > 0 && !gaveUp && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "zh"
                ? `已续期 ${renewals} 次`
                : `Extended ${renewals} time${renewals > 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {nextStage && (
          <Button
            size="sm"
            onClick={handleAdvance}
            disabled={loading}
            className="flex-1"
          >
            {locale === "zh"
              ? `推进到「${stageLabel(nextStage)}」`
              : `Advance to ${stageLabel(nextStage)}`}
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={handleKill}
          disabled={loading}
          className="flex-1"
        >
          {locale === "zh" ? "放弃这个项目" : "Kill it"}
        </Button>
        {!gaveUp && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRenew}
            disabled={loading}
            className="flex-shrink-0"
          >
            {locale === "zh"
              ? `再给 3 天 (${renewals + 1}/${maxRenewals})`
              : `3 more days (${renewals + 1}/${maxRenewals})`}
          </Button>
        )}
      </div>
    </Card>
  );
}
