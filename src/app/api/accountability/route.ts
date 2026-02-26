import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyCommitments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const today = getToday();

    // Get all commitments ever
    const all = db
      .select()
      .from(dailyCommitments)
      .orderBy(desc(dailyCommitments.date))
      .all();

    // Group by date
    const byDate: Record<string, { total: number; completed: number }> = {};
    for (const c of all) {
      if (!byDate[c.date]) byDate[c.date] = { total: 0, completed: 0 };
      byDate[c.date].total++;
      if (c.isCompleted) byDate[c.date].completed++;
    }

    // Calculate current streak (consecutive days with 100% completion)
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const dateStr = getDateString(i);
      // Skip today if it's not over yet (after 21:00 count it)
      if (i === 0 && new Date().getHours() < 21) continue;

      const dayData = byDate[dateStr];
      if (!dayData || dayData.total === 0) {
        if (i <= 1) continue;
        break;
      }

      if (dayData.completed === dayData.total) {
        streak++;
      } else {
        break;
      }
    }

    // Best streak ever
    let bestStreak = 0;
    let currentRun = 0;
    const dates = Object.keys(byDate).sort().reverse();
    for (let i = 0; i < dates.length; i++) {
      const d = byDate[dates[i]];
      if (d.total > 0 && d.completed === d.total) {
        currentRun++;
        bestStreak = Math.max(bestStreak, currentRun);
      } else if (d.total > 0) {
        currentRun = 0;
      }
    }

    // Overdue (incomplete from past days)
    const overdue = all.filter((c) => !c.isCompleted && c.date < today);
    const overdueCount = overdue.length;

    // 30-day completion rate
    const last30Days: string[] = [];
    for (let i = 0; i < 30; i++) {
      last30Days.push(getDateString(i));
    }
    let total30 = 0;
    let completed30 = 0;
    for (const d of last30Days) {
      if (byDate[d]) {
        total30 += byDate[d].total;
        completed30 += byDate[d].completed;
      }
    }
    const completionRate30 = total30 > 0 ? completed30 / total30 : 0;

    // Streak score (max at 14 days)
    const streakScore = Math.min(streak / 14, 1);

    // Overdue penalty (more overdue = worse)
    const overduePenalty = Math.min(overdueCount / 5, 1);

    // Consistency (how many of last 14 days had commitments)
    const last14Days: string[] = [];
    for (let i = 0; i < 14; i++) {
      last14Days.push(getDateString(i));
    }
    const activeDays14 = last14Days.filter((d) => byDate[d] && byDate[d].total > 0).length;
    const consistency = activeDays14 / 14;

    const accountabilityScore = Math.round(
      completionRate30 * 40 +
      streakScore * 25 +
      (1 - overduePenalty) * 20 +
      consistency * 15
    );

    // Rating key (locale-agnostic, client resolves label)
    let ratingKey: string;
    let ratingColor: string;
    if (accountabilityScore >= 85) {
      ratingKey = "accountability.outstanding";
      ratingColor = "text-green-600";
    } else if (accountabilityScore >= 70) {
      ratingKey = "accountability.reliable";
      ratingColor = "text-blue-600";
    } else if (accountabilityScore >= 50) {
      ratingKey = "accountability.needsPush";
      ratingColor = "text-yellow-600";
    } else if (accountabilityScore >= 30) {
      ratingKey = "accountability.slacking";
      ratingColor = "text-orange-500";
    } else {
      ratingKey = "accountability.critical";
      ratingColor = "text-red-500";
    }

    // Heatmap data for last 30 days
    const heatmap = last30Days.reverse().map((d) => ({
      date: d,
      total: byDate[d]?.total || 0,
      completed: byDate[d]?.completed || 0,
      perfect: byDate[d] ? byDate[d].total > 0 && byDate[d].completed === byDate[d].total : false,
    }));

    return NextResponse.json({
      score: accountabilityScore,
      ratingKey,
      ratingColor,
      streak,
      bestStreak,
      overdueCount,
      completionRate30: Math.round(completionRate30 * 100),
      consistency: Math.round(consistency * 100),
      heatmap,
      totalCommitmentsEver: all.length,
      totalCompletedEver: all.filter((c) => c.isCompleted).length,
    });
  } catch (err) {
    console.error("GET accountability error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
