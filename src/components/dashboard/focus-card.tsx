"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/lib/locale-context";
import { fetcher } from "@/lib/fetcher";
import Link from "next/link";

interface FocusProject {
  id: string;
  name: string;
  stage: string;
  priority: number;
  momentum: number;
  score: number;
  reasons: string[];
  daysInStage: number;
  pendingCommitments: number;
  validationProgress: number;
}

export function FocusCard() {
  const { locale, stageLabel } = useLocale();
  const { data } = useSWR("/api/focus", fetcher, { refreshInterval: 120000 });

  if (!data?.focus) {
    return (
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-2">
          {locale === "zh" ? "现在该做什么" : "What to do now"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {locale === "zh" ? "创建项目开始追踪" : "Create a project to get started"}
        </p>
      </Card>
    );
  }

  const focus: FocusProject = data.focus;
  const alternatives: FocusProject[] = data.alternatives || [];
  const isUrgent = data.message === "urgent";

  return (
    <Card
      className={`p-5 ${
        isUrgent
          ? "border-red-300 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20"
          : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">
          {isUrgent
            ? locale === "zh" ? "现在必须做" : "Do this NOW"
            : locale === "zh" ? "建议专注" : "Focus on"}
        </h2>
        {isUrgent && (
          <Badge variant="destructive" className="text-xs animate-pulse">
            {locale === "zh" ? "紧急" : "URGENT"}
          </Badge>
        )}
      </div>

      {/* Main focus project */}
      <Link href={`/projects/${focus.id}`} className="block group">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            <p className="text-lg font-bold group-hover:text-primary transition-colors">
              {focus.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs">{stageLabel(focus.stage)}</Badge>
              <span className="text-xs text-muted-foreground">P{focus.priority}</span>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${focus.momentum >= 60 ? "text-green-600" : focus.momentum >= 30 ? "text-yellow-600" : "text-red-500"}`}>
              {Math.round(focus.momentum)}
            </p>
            <p className="text-xs text-muted-foreground">{locale === "zh" ? "动量" : "momentum"}</p>
          </div>
        </div>

        {/* Reasons */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {focus.reasons.map((r, i) => (
            <span
              key={i}
              className={`text-xs px-2 py-0.5 rounded-full ${
                r.includes("拖延") || r.includes("停滞") || r.includes("overdue") || r.includes("stale")
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : r.includes("承诺") || r.includes("commitment")
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              }`}
            >
              {r}
            </span>
          ))}
        </div>

        {focus.validationProgress > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{locale === "zh" ? "验证进度" : "Validation"}</span>
              <span>{focus.validationProgress}%</span>
            </div>
            <Progress value={focus.validationProgress} className="h-1 mt-1" />
          </div>
        )}
      </Link>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            {locale === "zh" ? "也可以做" : "Also consider"}
          </p>
          <div className="space-y-1.5">
            {alternatives.map((alt) => (
              <Link
                key={alt.id}
                href={`/projects/${alt.id}`}
                className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-accent/50 transition-colors"
              >
                <span className="flex-1 truncate">{alt.name}</span>
                {alt.reasons[0] && (
                  <span className="text-muted-foreground truncate max-w-32">{alt.reasons[0]}</span>
                )}
                <span className="text-muted-foreground">{Math.round(alt.momentum)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
