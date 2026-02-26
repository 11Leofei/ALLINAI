import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, stageTransitions, validationItems, metrics, notes } from "@/lib/db/schema";
import { gte, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "weekly";
    const now = Date.now();
    const periodMs =
      type === "monthly" ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const startTime = now - periodMs;

    const allProjects = db.select().from(projects).all();
    const activeProjects = allProjects.filter((p) => p.stage !== "archived");
    const newProjects = allProjects.filter((p) => p.createdAt >= startTime);

    const stageChanges = db
      .select()
      .from(stageTransitions)
      .where(gte(stageTransitions.transitionedAt, startTime))
      .all();

    const completedValidations = db
      .select()
      .from(validationItems)
      .where(
        and(
          gte(validationItems.completedAt, startTime),
          sql`${validationItems.isCompleted} = 1`
        )
      )
      .all();

    const totalValidation = db.select().from(validationItems).all();
    const totalCompleted = totalValidation.filter((v) => v.isCompleted).length;

    const recentMetrics = db
      .select()
      .from(metrics)
      .where(gte(metrics.recordedAt, startTime))
      .all();

    const recentNotes = db
      .select()
      .from(notes)
      .where(gte(notes.createdAt, startTime))
      .all();

    const avgMomentum =
      activeProjects.length > 0
        ? Math.round(
            activeProjects.reduce((sum, p) => sum + p.momentum, 0) /
              activeProjects.length
          )
        : 0;

    const highMomentumProjects = activeProjects
      .filter((p) => p.momentum >= 70)
      .map((p) => ({ id: p.id, name: p.name, momentum: p.momentum }));

    const lowMomentumProjects = activeProjects
      .filter((p) => p.momentum < 40)
      .map((p) => ({ id: p.id, name: p.name, momentum: p.momentum }));

    const stageDistribution: Record<string, number> = {};
    for (const p of allProjects) {
      stageDistribution[p.stage] = (stageDistribution[p.stage] || 0) + 1;
    }

    const thresholds: Record<string, number> = {
      idea: 3, development: 5, launch: 7, validation: 5, data_collection: 7,
    };
    const staleProjects = activeProjects
      .filter((p) => {
        const threshold = thresholds[p.stage] || 5;
        const days = (now - p.stageEnteredAt) / (1000 * 60 * 60 * 24);
        return days >= threshold;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        stage: p.stage,
        daysInStage: Math.floor((now - p.stageEnteredAt) / (1000 * 60 * 60 * 24)),
      }));

    return NextResponse.json({
      type,
      period: { start: startTime, end: now },
      summary: {
        totalProjects: allProjects.length,
        activeProjects: activeProjects.length,
        newProjects: newProjects.length,
        averageMomentum: avgMomentum,
        stageChanges: stageChanges.length,
        completedValidations: completedValidations.length,
        totalValidationItems: totalValidation.length,
        totalValidationCompleted: totalCompleted,
        metricsRecorded: recentMetrics.length,
        notesAdded: recentNotes.length,
      },
      stageDistribution,
      highlights: {
        highMomentum: highMomentumProjects,
        newProjects: newProjects.map((p) => ({ id: p.id, name: p.name, stage: p.stage })),
        stageChanges: stageChanges.map((sc) => ({
          projectId: sc.projectId,
          from: sc.fromStage,
          to: sc.toStage,
          at: sc.transitionedAt,
        })),
      },
      concerns: {
        staleProjects,
        lowMomentum: lowMomentumProjects,
      },
    });
  } catch (err) {
    console.error("GET reports error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
