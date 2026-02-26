import { z } from "zod";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

const { metrics, projects } = schema;

export const addMetricSchema = z.object({
  projectId: z.string().describe("Project ID"),
  name: z.string().describe("Metric name (e.g., visitors, signups, revenue)"),
  value: z.number().describe("Metric value"),
});

export function addMetric(args: z.infer<typeof addMetricSchema>) {
  const now = Date.now();
  const metric = {
    id: nanoid(),
    projectId: args.projectId,
    name: args.name,
    value: args.value,
    recordedAt: now,
  };
  db.insert(metrics).values(metric).run();
  db.update(projects).set({ updatedAt: now }).where(eq(projects.id, args.projectId)).run();
  return metric;
}

export const getMetricsSchema = z.object({
  projectId: z.string().describe("Project ID"),
  name: z.string().optional().describe("Filter by metric name"),
});

export function getMetrics(args: z.infer<typeof getMetricsSchema>) {
  let query = db.select().from(metrics)
    .where(eq(metrics.projectId, args.projectId))
    .orderBy(desc(metrics.recordedAt));

  const results = query.all();
  if (args.name) {
    return results.filter((m) => m.name === args.name);
  }
  return results;
}
