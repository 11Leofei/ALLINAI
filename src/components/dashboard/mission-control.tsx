"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
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
  reasons: string[];
}

export function MissionControl() {
  const { locale } = useLocale();
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
  const streak = accountData?.streak || 0;

  const hour = new Date().getHours();

  // Time-aware mode
  const mode: "morning" | "afternoon" | "evening" =
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  // Init cron
  useEffect(() => {
    fetch("/api/cron").catch(() => {});
  }, []);

  // Emotional state
  const allDone =
    todayTotal > 0 && todayDone === todayTotal && overdueCount === 0;
  const hasTrouble =
    overdueCount > 0 || (todayTotal > 0 && todayDone === 0 && hour >= 15);
  const noCommitments = todayTotal === 0 && overdueCount === 0;

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
          locale === "zh" ? "今日承诺全部完成！" : "All commitments done today!"
        );
      }
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/commitments?id=${id}`, { method: "DELETE" });
    mutateCommitments();
  };

  // Dynamic background
  const bgClass = allDone
    ? "bg-green-50 dark:bg-green-950/20"
    : hasTrouble
    ? "bg-red-50 dark:bg-red-950/15"
    : noCommitments && mode === "morning"
    ? "bg-blue-50 dark:bg-blue-950/15"
    : "";

  // Time-aware greeting & message
  const greeting =
    locale === "zh"
      ? mode === "morning"
        ? "早上好"
        : mode === "afternoon"
        ? "下午好"
        : "晚上好"
      : mode === "morning"
      ? "Good morning"
      : mode === "afternoon"
      ? "Good afternoon"
      : "Good evening";

  const subtitle = _getSubtitle(
    locale,
    mode,
    todayDone,
    todayTotal,
    overdueCount,
    focus
  );

  return (
    <div className={`rounded-xl p-5 transition-colors ${bgClass}`}>
      {/* Greeting + streak */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold">{greeting}</h1>
        {streak > 0 && (
          <span className="text-sm text-orange-600">
            🔥 {streak}
            {locale === "zh" ? " 天" : "d"}
          </span>
        )}
      </div>

      {/* Smart subtitle */}
      <p
        className={`text-sm mb-4 ${
          allDone
            ? "text-green-700 dark:text-green-400 font-medium"
            : hasTrouble
            ? "text-red-700 dark:text-red-400 font-medium"
            : "text-muted-foreground"
        }`}
      >
        {subtitle}
      </p>

      {/* Progress bar (only when there are items) */}
      {todayTotal > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-sm font-mono font-medium text-muted-foreground">
            {todayDone}/{todayTotal}
          </span>
        </div>
      )}

      {/* === Overdue debts === */}
      {overdueItems.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1.5">
            {locale === "zh" ? "你欠的" : "YOUR DEBTS"}
          </p>
          <div className="space-y-1">
            {overdueItems.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-red-100/70 dark:bg-red-900/20"
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
                  title={locale === "zh" ? "放弃" : "Abandon"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Today's commitments === */}
      {todayItems.length > 0 && (
        <div className="mb-3">
          {overdueItems.length > 0 && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {locale === "zh" ? "今天" : "TODAY"}
            </p>
          )}
          <div className="space-y-1">
            {todayItems.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={!!c.isCompleted}
                  onCheckedChange={() => handleToggle(c.id, c.isCompleted)}
                />
                <span
                  className={`text-sm flex-1 truncate ${
                    c.isCompleted
                      ? "line-through text-muted-foreground"
                      : ""
                  }`}
                >
                  {c.commitment}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {c.projectName}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All done state */}
      {allDone && (
        <p className="text-sm text-green-700 dark:text-green-400 font-medium py-2">
          {locale === "zh" ? "✓ 今天做到了。" : "✓ You delivered today."}
        </p>
      )}

      {/* Evening review nudge */}
      {mode === "evening" &&
        todayTotal > 0 &&
        todayDone < todayTotal &&
        !allDone && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 mb-2">
            {locale === "zh"
              ? `还剩 ${todayTotal - todayDone} 个承诺没完成。今天要交代清楚再走。`
              : `${todayTotal - todayDone} commitments unfinished. Wrap up before you call it a day.`}
          </p>
        )}

      {/* Quick add — always visible */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
        {focus && !allDone && (
          <Link
            href={`/projects/${focus.id}`}
            className="text-xs text-primary hover:underline flex-shrink-0 hidden sm:block"
          >
            → {focus.name}
          </Link>
        )}
        <QuickAddCommitment
          activeProjects={activeProjects}
          focusProjectId={focus?.id || null}
          onAdded={() => mutateCommitments()}
        />
      </div>
    </div>
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
    } finally {
      setSubmitting(false);
    }
  };

  if (activeProjects.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-1">
      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="w-28 h-8 text-xs">
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
          locale === "zh"
            ? "今天要完成什么？回车添加"
            : "What will you do? Enter to add"
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
        +
      </Button>
    </div>
  );
}

function _getSubtitle(
  locale: string,
  mode: "morning" | "afternoon" | "evening",
  done: number,
  total: number,
  overdue: number,
  focus: FocusProject | null
): string {
  if (locale === "zh") {
    if (total > 0 && done === total && overdue === 0) return "今天做到了。";
    if (overdue > 0 && total > 0 && done < total)
      return `${overdue} 个拖延 + ${total - done} 个今天的还没做。`;
    if (overdue > 0) return `你还欠着 ${overdue} 个承诺。`;
    if (total > 0 && done < total) {
      if (mode === "evening") return `还剩 ${total - done} 个。今天交代清楚。`;
      if (mode === "afternoon") return `还剩 ${total - done} 个。下午冲一下。`;
      return `今天 ${total} 个承诺，开始吧。`;
    }
    if (mode === "morning") return "今天打算做什么？设定承诺开始行动。";
    if (mode === "afternoon")
      return focus
        ? `今天还没开始。要不先做「${focus.name}」？`
        : "今天还没设定承诺。";
    return "今天什么都没做。明天会更好吗？";
  }
  // English
  if (total > 0 && done === total && overdue === 0) return "You delivered today.";
  if (overdue > 0 && total > 0 && done < total)
    return `${overdue} overdue + ${total - done} remaining today.`;
  if (overdue > 0) return `You owe ${overdue} commitments.`;
  if (total > 0 && done < total) {
    if (mode === "evening") return `${total - done} left. Finish before you leave.`;
    if (mode === "afternoon") return `${total - done} left. Push through.`;
    return `${total} commitments today. Let's go.`;
  }
  if (mode === "morning") return "What will you do today? Set a commitment.";
  if (mode === "afternoon")
    return focus
      ? `Nothing started. How about "${focus.name}"?`
      : "No commitments set today.";
  return "Nothing done today. Will tomorrow be different?";
}
