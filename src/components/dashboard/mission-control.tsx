"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/lib/hooks/use-projects";
import { useLocale } from "@/lib/locale-context";
import { fetcher } from "@/lib/fetcher";
import { toast } from "sonner";
import Link from "next/link";

interface Commitment {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  commitment: string;
  isCompleted: number;
  isOverdue: boolean;
  delayedDays: number;
}

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

export function MissionControl() {
  const { locale, stageLabel } = useLocale();
  const { projects } = useProjects();
  const activeProjects = projects.filter((p) => p.stage !== "archived");

  const { data: commitData, mutate: mutateCommitments } = useSWR(
    "/api/commitments",
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: focusData } = useSWR("/api/focus", fetcher, {
    refreshInterval: 120000,
  });
  const { data: accountData } = useSWR("/api/accountability", fetcher, {
    refreshInterval: 300000,
  });

  const commitments: Commitment[] = commitData?.commitments || [];
  const todayItems = commitments.filter((c) => !c.isOverdue);
  const overdueItems = commitments.filter((c) => c.isOverdue);
  const todayDone = todayItems.filter((c) => c.isCompleted).length;
  const todayTotal = todayItems.length;
  const overdueCount = overdueItems.length;
  const progress =
    todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  const focus: FocusProject | null = focusData?.focus || null;
  const isUrgent = focusData?.message === "urgent";
  const streak = accountData?.streak || 0;
  const score = accountData?.score || 0;

  const hour = new Date().getHours();
  const greeting =
    locale === "zh"
      ? hour < 12
        ? "早上好"
        : hour < 18
        ? "下午好"
        : "晚上好"
      : hour < 12
      ? "Good morning"
      : hour < 18
      ? "Good afternoon"
      : "Good evening";

  // Init cron
  useEffect(() => {
    fetch("/api/cron").catch(() => {});
  }, []);

  const handleToggle = async (id: string, currentState: number) => {
    const completing = !currentState;
    await fetch("/api/commitments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isCompleted: currentState ? 0 : 1 }),
    });
    mutateCommitments();
    if (completing) {
      const remaining = todayItems.filter(
        (c) => !c.isCompleted && c.id !== id
      ).length;
      if (remaining === 0 && todayTotal > 0) {
        toast.success(
          locale === "zh"
            ? `今日 ${todayTotal} 个承诺全部完成！`
            : `All ${todayTotal} commitments done today!`
        );
      } else {
        toast.success(locale === "zh" ? "完成！继续加油" : "Done! Keep going");
      }
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/commitments?id=${id}`, { method: "DELETE" });
    mutateCommitments();
  };

  // Determine overall mood
  const allDone = todayTotal > 0 && todayDone === todayTotal && overdueCount === 0;
  const hasTrouble = overdueCount > 0 || (todayTotal > 0 && todayDone === 0 && hour >= 15);

  const borderClass = allDone
    ? "border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/80 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/10"
    : hasTrouble
    ? "border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50/80 to-orange-50/50 dark:from-red-950/20 dark:to-orange-950/10"
    : "bg-gradient-to-br from-slate-50/80 to-blue-50/50 dark:from-slate-950/20 dark:to-blue-950/10";

  return (
    <Card className={`p-5 ${borderClass}`}>
      {/* Row 1: Greeting + Stats */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-lg font-bold">{greeting}</p>
            {streak > 0 && (
              <span className="text-xs text-orange-600 flex items-center gap-0.5">
                <span>🔥</span>
                <span className="font-semibold">
                  {streak}
                  {locale === "zh" ? "天" : "d"}
                </span>
              </span>
            )}
            {score > 0 && (
              <Badge
                variant={
                  score >= 70
                    ? "default"
                    : score >= 40
                    ? "secondary"
                    : "destructive"
                }
                className="text-xs"
              >
                {locale === "zh" ? `执行力 ${score}` : `Score ${score}`}
              </Badge>
            )}
          </div>
          {/* Smart summary */}
          <p className="text-sm text-muted-foreground mt-0.5">
            {_buildSummary(locale, todayDone, todayTotal, overdueCount, focus)}
          </p>
        </div>

        {/* Focus project quick link */}
        {focus && (
          <Link
            href={`/projects/${focus.id}`}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isUrgent
                ? "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
            }`}
          >
            <span className="text-xs text-muted-foreground block">
              {isUrgent
                ? locale === "zh"
                  ? "现在该做"
                  : "Do NOW"
                : locale === "zh"
                ? "建议专注"
                : "Focus on"}
            </span>
            <span className="truncate max-w-40 block">{focus.name}</span>
            {focus.reasons[0] && (
              <span className="text-xs opacity-70 block truncate max-w-40">
                {focus.reasons[0]}
              </span>
            )}
          </Link>
        )}
      </div>

      {/* Row 2: Today's progress bar */}
      {todayTotal > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs font-medium text-muted-foreground w-12 text-right">
            {todayDone}/{todayTotal}
          </span>
        </div>
      )}

      {/* Row 3: Commitment list — always visible */}
      <div className="mt-3 space-y-1">
        {/* Overdue first */}
        {overdueItems.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2.5 p-1.5 rounded-lg bg-red-100/60 dark:bg-red-900/20"
          >
            <Checkbox
              checked={!!c.isCompleted}
              onCheckedChange={() => handleToggle(c.id, c.isCompleted)}
            />
            <span className="text-sm flex-1 truncate">{c.commitment}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {c.projectName}
            </span>
            <Badge variant="destructive" className="text-xs">
              {locale === "zh"
                ? `拖了 ${c.delayedDays} 天`
                : `${c.delayedDays}d late`}
            </Badge>
            <button
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(c.id)}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Today items */}
        {todayItems.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-accent/50"
          >
            <Checkbox
              checked={!!c.isCompleted}
              onCheckedChange={() => handleToggle(c.id, c.isCompleted)}
            />
            <span
              className={`text-sm flex-1 truncate ${
                c.isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {c.commitment}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {c.projectName}
            </span>
          </div>
        ))}

        {/* All done message */}
        {allDone && (
          <p className="text-sm text-green-600 font-medium py-1">
            {locale === "zh"
              ? `✓ 今日 ${todayTotal} 个承诺全部完成！`
              : `✓ All ${todayTotal} commitments done!`}
          </p>
        )}

        {/* Quick add — always visible */}
        <QuickAddCommitment
          activeProjects={activeProjects}
          focusProjectId={focus?.id || null}
          onAdded={() => mutateCommitments()}
        />
      </div>
    </Card>
  );
}

function QuickAddCommitment({
  activeProjects,
  focusProjectId,
  onAdded,
}: {
  activeProjects: { id: string; name: string; stage: string }[];
  focusProjectId: string | null;
  onAdded: () => void;
}) {
  const { locale } = useLocale();
  const [projectId, setProjectId] = useState("");
  const [commitment, setCommitment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-select focus project on mount
  useEffect(() => {
    if (!projectId && focusProjectId) {
      setProjectId(focusProjectId);
    }
  }, [focusProjectId, projectId]);

  const handleSubmit = async () => {
    if (!projectId || !commitment.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/commitments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, commitment: commitment.trim() }),
      });
      setCommitment("");
      onAdded();
      toast.success(locale === "zh" ? "承诺已添加" : "Commitment added");
    } finally {
      setSubmitting(false);
    }
  };

  if (activeProjects.length === 0) return null;

  return (
    <div className="flex items-center gap-2 pt-1">
      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue
            placeholder={locale === "zh" ? "项目" : "Project"}
          />
        </SelectTrigger>
        <SelectContent>
          {activeProjects.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        ref={inputRef}
        className="h-8 text-sm flex-1"
        placeholder={
          locale === "zh" ? "今天要完成什么？回车添加" : "What will you do? Enter to add"
        }
        value={commitment}
        onChange={(e) => setCommitment(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
      <Button
        size="sm"
        className="h-8"
        onClick={handleSubmit}
        disabled={!projectId || !commitment.trim() || submitting}
      >
        {locale === "zh" ? "添加" : "Add"}
      </Button>
    </div>
  );
}

function _buildSummary(
  locale: string,
  done: number,
  total: number,
  overdue: number,
  focus: FocusProject | null
): string {
  if (locale === "zh") {
    const parts: string[] = [];
    if (overdue > 0) parts.push(`${overdue} 个拖延承诺需要处理`);
    if (total > 0 && done < total)
      parts.push(`今日还剩 ${total - done} 个承诺`);
    if (total > 0 && done === total) parts.push("今日承诺已全部完成！");
    if (total === 0 && overdue === 0) {
      parts.push("还没设定今日承诺 — 设定一个开始行动");
    }
    return parts.join("，");
  } else {
    const parts: string[] = [];
    if (overdue > 0) parts.push(`${overdue} overdue commitments`);
    if (total > 0 && done < total) parts.push(`${total - done} remaining today`);
    if (total > 0 && done === total) parts.push("All commitments done today!");
    if (total === 0 && overdue === 0) {
      parts.push("No commitments yet — add one to start");
    }
    return parts.join(". ");
  }
}
