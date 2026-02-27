"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLocale } from "@/lib/locale-context";
import { getPriorityLabel } from "@/lib/i18n";
import type { Project } from "@/types";

interface ProjectCardProps {
  project: Project;
  isDragging?: boolean;
  onAdvance?: (projectId: string, nextStage: string) => void;
}

function getMomentumColor(momentum: number): string {
  if (momentum >= 70) return "text-green-600";
  if (momentum >= 40) return "text-yellow-600";
  return "text-red-500";
}

function getHealthDot(project: Project): { color: string; label: string } {
  const daysSinceUpdate = (Date.now() - project.updatedAt) / (1000 * 60 * 60 * 24);
  if (project.momentum >= 70 && daysSinceUpdate < 3)
    return { color: "bg-green-500", label: "Healthy" };
  if (project.momentum >= 40 && daysSinceUpdate < 7)
    return { color: "bg-yellow-400", label: "OK" };
  if (project.momentum < 30 || daysSinceUpdate >= 7)
    return { color: "bg-red-500", label: "At risk" };
  return { color: "bg-yellow-400", label: "OK" };
}

import type { ProjectStage } from "@/types";

const NEXT_STAGE: Partial<Record<ProjectStage, ProjectStage>> = {
  idea: "development",
  development: "launch",
  launch: "validation",
  validation: "data_collection",
};

export function ProjectCard({ project, isDragging, onAdvance }: ProjectCardProps) {
  const { t, stageLabel, locale } = useLocale();
  const isStale =
    project.stage !== "archived" &&
    Date.now() - project.updatedAt > 3 * 24 * 60 * 60 * 1000;

  const staleDays = Math.floor(
    (Date.now() - project.stageEnteredAt) / (1000 * 60 * 60 * 24)
  );

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
    <Link href={`/projects/${project.id}`}>
      <div
        className={`group rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-pointer ${
          isDragging ? "rotate-2 shadow-lg opacity-90" : ""
        } ${isStale ? "border-orange-300 dark:border-orange-700" : ""}`}
      >
        {/* Header: name + priority + stale */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getHealthDot(project).color}`} />
              <h3 className="font-medium text-sm leading-tight truncate">{project.name}</h3>
            </div>
            {project.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {project.priority >= 4 && (
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-orange-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t("priority.label")}: {getPriorityLabel(project.priority, locale)}
                </TooltipContent>
              </Tooltip>
            )}
            {isStale && (
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-orange-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                      <path d="M12 9v4" /><path d="M12 17h.01" />
                    </svg>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t("card.staleDays", { days: staleDays })}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Momentum bar */}
        <div className="mt-2 flex items-center gap-2">
          <Progress value={project.momentum} className="h-1.5 flex-1" />
          <span className={`text-xs font-medium ${getMomentumColor(project.momentum)}`}>
            {Math.round(project.momentum)}
          </span>
        </div>

        {/* Tags */}
        {project.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {project.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{project.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer: time + advance */}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("card.updatedAgo", { time: timeAgo(project.updatedAt) })}
          </p>
          {onAdvance && NEXT_STAGE[project.stage] && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAdvance(project.id, NEXT_STAGE[project.stage]!);
              }}
              className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline transition-opacity"
            >
              {stageLabel(NEXT_STAGE[project.stage]!)} →
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
