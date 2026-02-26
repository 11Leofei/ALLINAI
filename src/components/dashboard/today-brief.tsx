"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/locale-context";
import { fetcher } from "@/lib/fetcher";
import Link from "next/link";

export function TodayBrief() {
  const { locale } = useLocale();
  const { data: commitData } = useSWR("/api/commitments", fetcher, { refreshInterval: 30000 });
  const { data: focusData } = useSWR("/api/focus", fetcher, { refreshInterval: 120000 });
  const { data: accountData } = useSWR("/api/accountability", fetcher, { refreshInterval: 300000 });

  const commitments = commitData?.commitments || [];
  const todayItems = commitments.filter((c: { isOverdue: boolean }) => !c.isOverdue);
  const overdueItems = commitments.filter((c: { isOverdue: boolean }) => c.isOverdue);
  const todayDone = todayItems.filter((c: { isCompleted: number }) => c.isCompleted).length;
  const todayTotal = todayItems.length;
  const overdueCount = overdueItems.length;

  const focus = focusData?.focus;
  const streak = accountData?.streak || 0;
  const score = accountData?.score || 0;

  const hour = new Date().getHours();
  const greeting = locale === "zh"
    ? hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Determine urgency level
  const isGood = todayTotal > 0 && todayDone === todayTotal && overdueCount === 0;
  const isBad = overdueCount > 0 || (todayTotal > 0 && todayDone === 0 && hour >= 15);
  const isNeutral = !isGood && !isBad;

  const bgClass = isGood
    ? "from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800"
    : isBad
    ? "from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-red-200 dark:border-red-800"
    : "from-slate-50 to-blue-50 dark:from-slate-950/20 dark:to-blue-950/20";

  return (
    <Card className={`p-5 bg-gradient-to-r ${bgClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold">{greeting}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {locale === "zh"
              ? _todaySummaryZh(todayDone, todayTotal, overdueCount, focus)
              : _todaySummaryEn(todayDone, todayTotal, overdueCount, focus)}
          </p>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-xs">
          {streak > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <span>🔥</span>
              <span className="font-semibold">{streak}{locale === "zh" ? "天" : "d"}</span>
            </div>
          )}
          {score > 0 && (
            <Badge variant={score >= 70 ? "default" : score >= 40 ? "secondary" : "destructive"} className="text-xs">
              {locale === "zh" ? `执行力 ${score}` : `Score ${score}`}
            </Badge>
          )}
        </div>
      </div>

      {/* Action items */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {overdueCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {locale === "zh" ? `${overdueCount} 个拖延` : `${overdueCount} overdue`}
          </Badge>
        )}
        {todayTotal > 0 && (
          <Badge variant={todayDone === todayTotal ? "default" : "secondary"} className="text-xs">
            {locale === "zh" ? `今日 ${todayDone}/${todayTotal}` : `Today ${todayDone}/${todayTotal}`}
          </Badge>
        )}
        {focus && (
          <Link
            href={`/projects/${focus.id}`}
            className="text-xs text-primary hover:underline"
          >
            {locale === "zh" ? `→ 专注：${focus.name}` : `→ Focus: ${focus.name}`}
          </Link>
        )}
      </div>
    </Card>
  );
}

function _todaySummaryZh(done: number, total: number, overdue: number, focus: { name: string } | null): string {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`有 ${overdue} 个拖延承诺需要处理`);
  if (total > 0 && done < total) parts.push(`今日还剩 ${total - done} 个承诺`);
  if (total > 0 && done === total) parts.push("今日承诺已全部完成！");
  if (total === 0 && overdue === 0) {
    if (focus) parts.push(`建议专注「${focus.name}」`);
    else parts.push("还没有设定今日承诺");
  }
  return parts.join("，") || "开始新的一天吧";
}

function _todaySummaryEn(done: number, total: number, overdue: number, focus: { name: string } | null): string {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue commitments need attention`);
  if (total > 0 && done < total) parts.push(`${total - done} commitments remaining today`);
  if (total > 0 && done === total) parts.push("All commitments done today!");
  if (total === 0 && overdue === 0) {
    if (focus) parts.push(`Focus on "${focus.name}"`);
    else parts.push("No commitments set for today");
  }
  return parts.join(". ") || "Start a new day";
}
