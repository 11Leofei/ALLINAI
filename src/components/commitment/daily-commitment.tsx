"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

export function DailyCommitmentBar() {
  const { locale } = useLocale();
  const { data, mutate } = useSWR("/api/commitments", fetcher, {
    refreshInterval: 60000,
  });
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Initialize cron scheduler on first load
  useEffect(() => {
    fetch("/api/cron").catch(() => {});
  }, []);

  useEffect(() => {
    const dismissedDate = localStorage.getItem("allinai-commitment-dismissed");
    const today = new Date().toISOString().slice(0, 10);
    if (dismissedDate === today) setDismissed(true);
    else setDismissed(false);
  }, []);

  const commitments: Commitment[] = data?.commitments || [];
  const overdueItems = commitments.filter((c) => c.isOverdue);
  const todayItems = commitments.filter((c) => !c.isOverdue);
  const todayTotal = todayItems.length;
  const todayCompleted = todayItems.filter((c) => c.isCompleted).length;
  const overdueCount = overdueItems.length;
  const progress = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  const hour = new Date().getHours();
  const isEvening = hour >= 18;
  const isMorning = hour < 12;

  const showMorningPrompt = todayTotal === 0 && isMorning && !dismissed;
  const hasOverdue = overdueCount > 0;
  const showEveningReminder = todayTotal > 0 && todayCompleted < todayTotal && isEvening;

  const handleToggle = async (id: string, currentState: number) => {
    const completing = !currentState;
    await fetch("/api/commitments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isCompleted: currentState ? 0 : 1 }),
    });
    mutate();

    if (completing) {
      const remaining = todayItems.filter((c) => !c.isCompleted && c.id !== id).length;
      if (remaining === 0 && todayTotal > 0) {
        toast.success(
          locale === "zh"
            ? `🎉 太棒了！今日 ${todayTotal} 个承诺全部完成！`
            : `🎉 Amazing! All ${todayTotal} commitments done today!`
        );
      } else {
        toast.success(
          locale === "zh" ? "✓ 完成！继续加油" : "✓ Done! Keep going"
        );
      }
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/commitments?id=${id}`, { method: "DELETE" });
    mutate();
  };

  const handleDismiss = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem("allinai-commitment-dismissed", today);
    setDismissed(true);
  };

  if (dismissed && todayTotal === 0 && overdueCount === 0) return null;

  // All done today and no overdue
  if (todayTotal > 0 && todayCompleted === todayTotal && overdueCount === 0 && !expanded) {
    return (
      <div
        className="mx-6 mt-4 flex items-center gap-2 text-sm text-green-600 cursor-pointer hover:opacity-80"
        onClick={() => setExpanded(true)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {locale === "zh"
          ? `今日 ${todayTotal} 个承诺全部完成！`
          : `All ${todayTotal} commitments done today!`}
      </div>
    );
  }

  const borderClass = hasOverdue
    ? "border-red-300 bg-red-50 dark:bg-red-950/20"
    : showEveningReminder
    ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20"
    : showMorningPrompt
    ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20"
    : "";

  return (
    <div className="mx-6 mt-4">
      <Card className={`p-4 ${borderClass}`}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {hasOverdue
                  ? locale === "zh"
                    ? `${overdueCount} 个拖延承诺！`
                    : `${overdueCount} overdue commitments!`
                  : showMorningPrompt
                  ? locale === "zh" ? "今天打算做什么？" : "What will you work on today?"
                  : showEveningReminder
                  ? locale === "zh" ? "今日还有未完成的承诺" : "Unfinished commitments"
                  : locale === "zh" ? "今日承诺" : "Today's Commitments"}
              </span>
              {todayTotal > 0 && (
                <span className="text-xs text-muted-foreground">{todayCompleted}/{todayTotal}</span>
              )}
              {hasOverdue && (
                <Badge variant="destructive" className="text-xs">
                  {locale === "zh" ? `${overdueCount} 拖延` : `${overdueCount} overdue`}
                </Badge>
              )}
            </div>
            {todayTotal > 0 && <Progress value={progress} className="h-1.5 mt-1.5" />}
          </div>
          <div className="flex items-center gap-1">
            {todayTotal === 0 && overdueCount === 0 && (
              <>
                <Button size="sm" onClick={() => setExpanded(true)}>
                  {locale === "zh" ? "设定承诺" : "Set goals"}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss} className="text-muted-foreground">
                  {locale === "zh" ? "跳过" : "Skip"}
                </Button>
              </>
            )}
            {(todayTotal > 0 || overdueCount > 0) && (
              <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </Button>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {(expanded || showMorningPrompt || hasOverdue) && (
          <div className="mt-3 space-y-1">
            {/* Overdue items — with shame badges */}
            {overdueItems.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-100/50 dark:bg-red-900/20">
                <Checkbox
                  checked={!!c.isCompleted}
                  onCheckedChange={() => handleToggle(c.id, c.isCompleted)}
                />
                <span className="text-sm flex-1">{c.commitment}</span>
                <span className="text-xs text-muted-foreground">{c.projectName}</span>
                <Badge variant="destructive" className="text-xs">
                  {locale === "zh" ? `拖了 ${c.delayedDays} 天` : `${c.delayedDays}d late`}
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

            {overdueItems.length > 0 && todayItems.length > 0 && (
              <div className="border-t my-1" />
            )}

            {/* Today's items */}
            {todayItems.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                <Checkbox
                  checked={!!c.isCompleted}
                  onCheckedChange={() => handleToggle(c.id, c.isCompleted)}
                />
                <span className={`text-sm flex-1 ${c.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                  {c.commitment}
                </span>
                <span className="text-xs text-muted-foreground">{c.projectName}</span>
              </div>
            ))}

            {/* Add form */}
            <AddCommitmentForm onAdded={() => { mutate(); setDismissed(false); }} />
          </div>
        )}
      </Card>
    </div>
  );
}

function AddCommitmentForm({ onAdded }: { onAdded: () => void }) {
  const { locale } = useLocale();
  const { projects } = useProjects();
  const activeProjects = projects.filter((p) => p.stage !== "archived");
  const [projectId, setProjectId] = useState("");
  const [commitment, setCommitment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="flex items-center gap-2 pt-1">
      <Select value={projectId} onValueChange={setProjectId}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder={locale === "zh" ? "选择项目" : "Project"} />
        </SelectTrigger>
        <SelectContent>
          {activeProjects.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="h-8 text-sm flex-1"
        placeholder={locale === "zh" ? "今天要完成什么？" : "What will you accomplish?"}
        value={commitment}
        onChange={(e) => setCommitment(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
      />
      <Button size="sm" className="h-8" onClick={handleSubmit}
        disabled={!projectId || !commitment.trim() || submitting}>
        {locale === "zh" ? "添加" : "Add"}
      </Button>
    </div>
  );
}

// Commitment Stats (used in dashboard)
export function CommitmentStats() {
  const { locale } = useLocale();
  const { data } = useSWR("/api/commitments?range=week", fetcher);

  if (!data?.stats) return null;
  const { completionRate, perfectDays, totalCompleted, totalCommitments } = data.stats;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">
        {locale === "zh" ? "本周承诺" : "Weekly Commitments"}
      </h3>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className={`text-2xl font-bold ${completionRate >= 80 ? "text-green-600" : completionRate >= 50 ? "text-yellow-600" : "text-red-500"}`}>
            {completionRate}%
          </p>
          <p className="text-xs text-muted-foreground">{locale === "zh" ? "完成率" : "Rate"}</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{totalCompleted}/{totalCommitments}</p>
          <p className="text-xs text-muted-foreground">{locale === "zh" ? "已完成" : "Done"}</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-blue-600">{perfectDays}</p>
          <p className="text-xs text-muted-foreground">{locale === "zh" ? "满分天" : "Perfect"}</p>
        </div>
      </div>
      {totalCommitments > 0 && <Progress value={completionRate} className="h-1.5 mt-3" />}
    </Card>
  );
}
