"use client";

import { useParams, useRouter } from "next/navigation";
import { useProject, updateProject, deleteProject } from "@/lib/hooks/use-projects";
import useSWR from "swr";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useLocale } from "@/lib/locale-context";
import { getPriorityLabel } from "@/lib/i18n";
import {
  STAGE_ORDER,
  STAGE_COLORS,
  type ProjectStage,
  type StageTransition,
  type ValidationItem,
  type Metric,
  type Note,
} from "@/types";
import { AIAnalysisCard } from "@/components/ai/ai-analysis-card";
import { GitScanCard } from "@/components/project/git-scan-card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { fetcher } from "@/lib/fetcher";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { t, stageLabel, locale } = useLocale();

  const { project, mutate: mutateProject } = useProject(id);
  const { data: transitions = [], mutate: mutateTransitions } = useSWR<StageTransition[]>(
    `/api/projects/${id}/transitions`, fetcher
  );
  const { data: validationItems = [], mutate: mutateValidation } = useSWR<ValidationItem[]>(
    `/api/projects/${id}/validation`, fetcher
  );
  const { data: projectMetrics = [], mutate: mutateMetrics } = useSWR<Metric[]>(
    `/api/projects/${id}/metrics`, fetcher
  );
  const { data: projectNotes = [], mutate: mutateNotes } = useSWR<Note[]>(
    `/api/projects/${id}/notes`, fetcher
  );

  const [newValidation, setNewValidation] = useState("");
  const [newNote, setNewNote] = useState("");
  const [metricName, setMetricName] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [editingValidationId, setEditingValidationId] = useState<string | null>(null);
  const [editValidationLabel, setEditValidationLabel] = useState("");

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

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

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const handleStageChange = async (stage: string) => {
    const oldStage = project?.stage;
    await updateProject(id, { stage });
    mutateProject();
    mutateTransitions();
    if (oldStage && stage !== "archived") {
      const STAGE_IDX: Record<string, number> = { idea: 0, development: 1, launch: 2, validation: 3, data_collection: 4 };
      if ((STAGE_IDX[stage] ?? 0) > (STAGE_IDX[oldStage] ?? 0)) {
        toast.success(
          locale === "zh"
            ? `${project?.name} 推进到「${stageLabel(stage)}」！`
            : `${project?.name} advanced to ${stageLabel(stage)}!`
        );
      }
    }
  };

  const handleDelete = async () => {
    if (confirm(t("project.deleteConfirm"))) {
      await deleteProject(id);
      router.push("/pipeline");
    }
  };

  const handleSaveEdit = async () => {
    await updateProject(id, { name: editName, description: editDescription });
    setIsEditing(false);
    mutateProject();
  };

  const startEdit = () => {
    setEditName(project.name);
    setEditDescription(project.description || "");
    setIsEditing(true);
  };

  // Validation CRUD
  const addValidationItem = async () => {
    if (!newValidation.trim()) return;
    await fetch(`/api/projects/${id}/validation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newValidation.trim() }),
    });
    setNewValidation("");
    mutateValidation();
    mutateProject();
  };

  const toggleValidation = async (item: ValidationItem) => {
    const completing = !item.isCompleted;
    await fetch(`/api/projects/${id}/validation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isCompleted: completing }),
    });
    mutateValidation();
    mutateProject();
    if (completing) {
      const newDone = completedValidation + 1;
      const total = validationItems.length;
      if (newDone === total) {
        toast.success(locale === "zh" ? "验证清单全部完成！" : "All validation items complete!");
      } else {
        const pct = Math.round((newDone / total) * 100);
        toast.success(locale === "zh" ? `验证进度 ${pct}%` : `Validation ${pct}%`);
      }
    }
  };

  const deleteValidationItem = async (itemId: string) => {
    if (!confirm(t("validation.deleteConfirm"))) return;
    await fetch(`/api/projects/${id}/validation`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId }),
    });
    mutateValidation();
    mutateProject();
  };

  const saveEditValidation = async () => {
    if (!editingValidationId || !editValidationLabel.trim()) return;
    await fetch(`/api/projects/${id}/validation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingValidationId, label: editValidationLabel.trim() }),
    });
    setEditingValidationId(null);
    setEditValidationLabel("");
    mutateValidation();
  };

  // Metrics
  const addMetric = async () => {
    if (!metricName.trim() || !metricValue) return;
    await fetch(`/api/projects/${id}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: metricName.trim(), value: parseFloat(metricValue) }),
    });
    setMetricName("");
    setMetricValue("");
    mutateMetrics();
    mutateProject();
  };

  const deleteMetric = async (metricId: string) => {
    if (!confirm(t("metrics.deleteConfirm"))) return;
    await fetch(`/api/projects/${id}/metrics`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: metricId }),
    });
    mutateMetrics();
    mutateProject();
  };

  // Notes CRUD
  const addNote = async () => {
    if (!newNote.trim()) return;
    await fetch(`/api/projects/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote.trim() }),
    });
    setNewNote("");
    mutateNotes();
    mutateProject();
  };

  const saveEditNote = async () => {
    if (!editingNoteId || !editNoteContent.trim()) return;
    await fetch(`/api/projects/${id}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingNoteId, content: editNoteContent.trim() }),
    });
    setEditingNoteId(null);
    setEditNoteContent("");
    mutateNotes();
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm(t("notes.deleteConfirm"))) return;
    await fetch(`/api/projects/${id}/notes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: noteId }),
    });
    mutateNotes();
    mutateProject();
  };

  const activeStages = STAGE_ORDER.filter((s) => s !== "archived");
  const completedValidation = validationItems.filter((i) => i.isCompleted).length;

  // Metrics chart data
  const metricsChartData = (() => {
    if (projectMetrics.length === 0) return { data: [], metricNames: [] as string[] };
    const metricNames = [...new Set(projectMetrics.map((m) => m.name))];
    const sorted = [...projectMetrics].sort((a, b) => a.recordedAt - b.recordedAt);
    const dateMap = new Map<string, Record<string, number | string>>();
    for (const m of sorted) {
      const dateKey = new Date(m.recordedAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, { date: dateKey });
      dateMap.get(dateKey)![m.name] = m.value;
    }
    return { data: Array.from(dateMap.values()), metricNames };
  })();

  const commonMetrics = [
    t("metrics.visitors"), t("metrics.signups"), t("metrics.revenue"),
    t("metrics.conversion"), t("metrics.retention"),
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            {t("project.back")}
          </Button>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xl font-bold" />
              <Button size="sm" onClick={handleSaveEdit}>{t("common.save")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>{t("common.cancel")}</Button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold">{project.name}</h1>
          )}
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEdit}>{t("project.edit")}</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => handleStageChange("archived")}>{t("project.archive")}</Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>{t("project.delete")}</Button>
        </div>
      </div>

      {/* Stage Progress + Next Step (merged) */}
      <Card className="p-4">
        <div className="flex items-center gap-1">
          {activeStages.map((stage, idx) => {
            const currentIdx = activeStages.indexOf(project.stage as typeof activeStages[number]);
            const isActive = idx <= currentIdx;
            const isCurrent = stage === project.stage;
            return (
              <div key={stage} className="flex items-center flex-1">
                <button
                  onClick={() => handleStageChange(stage)}
                  className={`flex-1 rounded-md px-2 py-2 text-xs font-medium text-center transition-all ${
                    isCurrent
                      ? `${STAGE_COLORS[stage]} text-white`
                      : isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {stageLabel(stage)}
                </button>
                {idx < activeStages.length - 1 && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-1 text-muted-foreground flex-shrink-0"><path d="m9 18 6-6-6-6" /></svg>
                )}
              </div>
            );
          })}
        </div>
        {/* Inline next-step guidance */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t(`nextStep.${project.stage}.action`)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(`nextStep.${project.stage}.why`)}</p>
          </div>
          {(() => {
            const NEXT: Record<string, string> = { idea: "development", development: "launch", launch: "validation", validation: "data_collection" };
            const next = NEXT[project.stage];
            return next ? (
              <Button size="sm" variant="outline" onClick={() => handleStageChange(next)}>
                {stageLabel(next)} →
              </Button>
            ) : null;
          })()}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Action-oriented */}
        <div className="space-y-6">
          {/* Description */}
          <Card className="p-4">
            <h2 className="font-semibold mb-2">{t("project.description")}</h2>
            {isEditing ? (
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} />
            ) : (
              <p className="text-sm text-muted-foreground cursor-pointer hover:text-foreground" onClick={startEdit}>
                {project.description || t("project.noDescription")}
              </p>
            )}
            {project.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {project.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}
          </Card>

          {/* Validation Checklist */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{t("validation.title")}</h2>
              {validationItems.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("validation.progress", { done: completedValidation, total: validationItems.length })}
                </span>
              )}
            </div>
            {validationItems.length > 0 && (
              <Progress
                value={(completedValidation / validationItems.length) * 100}
                className="h-1.5 mb-3"
              />
            )}
            {validationItems.length === 0 && (
              <p className="text-xs text-muted-foreground mb-3">{t("validation.empty")}</p>
            )}
            <div className="space-y-2">
              {validationItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <Checkbox checked={item.isCompleted} onCheckedChange={() => toggleValidation(item)} />
                  {editingValidationId === item.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editValidationLabel}
                        onChange={(e) => setEditValidationLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEditValidation()}
                        className="text-sm h-7"
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={saveEditValidation}>{t("common.save")}</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingValidationId(null)}>{t("common.cancel")}</Button>
                    </div>
                  ) : (
                    <>
                      <span className={`text-sm flex-1 ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                        {item.label}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        <button onClick={() => { setEditingValidationId(item.id); setEditValidationLabel(item.label); }} className="text-xs text-muted-foreground hover:text-foreground">{t("validation.edit")}</button>
                        <button onClick={() => deleteValidationItem(item.id)} className="text-xs text-red-500 hover:text-red-700">{t("validation.delete")}</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <Input
                placeholder={t("validation.add")}
                value={newValidation}
                onChange={(e) => setNewValidation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addValidationItem()}
                className="text-sm"
              />
              <Button size="sm" onClick={addValidationItem}>{t("validation.addBtn")}</Button>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-4">
            <h2 className="font-semibold mb-3">{t("notes.title")}</h2>
            {projectNotes.length === 0 && (
              <p className="text-xs text-muted-foreground mb-3">{t("notes.empty")}</p>
            )}
            <div className="space-y-3">
              {projectNotes.map((note) => (
                <div key={note.id} className="border-l-2 border-muted pl-3 group">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        rows={3}
                        className="text-sm"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={saveEditNote}>{t("notes.save")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>{t("notes.cancel")}</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                          <button onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content); }} className="text-xs text-muted-foreground hover:text-foreground">{t("notes.edit")}</button>
                          <button onClick={() => deleteNote(note.id)} className="text-xs text-red-500 hover:text-red-700">{t("notes.delete")}</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder={t("notes.add")}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button size="sm" onClick={addNote}>{t("notes.addBtn")}</Button>
            </div>
          </Card>
        </div>

        {/* Right: Data & context */}
        <div className="space-y-6">
          {/* Momentum + Info (merged) */}
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Progress value={project.momentum} className="h-2.5 flex-1" />
              <span className="text-2xl font-bold">{Math.round(project.momentum)}</span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("project.created")}</span>
                <span>{formatDate(project.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("project.stageEntered")}</span>
                <span>{formatDate(project.stageEnteredAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("project.priority")}</span>
                <span>{getPriorityLabel(project.priority, locale)} ({project.priority}/5)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("project.lastUpdated", { time: timeAgo(project.updatedAt) })}</span>
              </div>
            </div>
          </Card>

          {/* Metrics */}
          <Card className="p-4">
            <h2 className="font-semibold mb-3">{t("metrics.title")}</h2>
            {projectMetrics.length > 0 ? (
              <>
                <div className="space-y-2 mb-3">
                  {Object.entries(
                    projectMetrics.reduce((acc, m) => {
                      if (!acc[m.name] || m.recordedAt > acc[m.name].recordedAt) acc[m.name] = m;
                      return acc;
                    }, {} as Record<string, Metric>)
                  ).map(([name, metric]) => (
                    <div key={name} className="flex items-center justify-between py-1 group">
                      <span className="text-sm">{name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{metric.value}</span>
                        <button
                          onClick={() => deleteMetric(metric.id)}
                          className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 transition-opacity"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {metricsChartData.data.length > 1 && (
                  <>
                    <Separator className="my-3" />
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">{t("metrics.trend")}</h3>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={metricsChartData.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={40} />
                        <RechartsTooltip />
                        <Legend />
                        {metricsChartData.metricNames.map((name, idx) => (
                          <Line
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("metrics.noData")}</p>
            )}
            <Separator className="my-3" />
            <div className="flex flex-wrap gap-1 mb-2">
              {commonMetrics.filter((cm) => cm !== metricName).map((cm) => (
                <Badge key={cm} variant="outline" className="cursor-pointer text-xs hover:bg-accent" onClick={() => setMetricName(cm)}>
                  + {cm}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder={t("metrics.addName")} value={metricName} onChange={(e) => setMetricName(e.target.value)} className="text-sm" />
              <Input placeholder={t("metrics.addValue")} type="number" value={metricValue} onChange={(e) => setMetricValue(e.target.value)} className="text-sm w-24" />
              <Button size="sm" onClick={addMetric}>{t("metrics.add")}</Button>
            </div>
          </Card>

          {/* Timeline (collapsed — only last 5) */}
          {transitions.length > 0 && (
            <Card className="p-4">
              <h2 className="font-semibold mb-3">{t("project.timeline")}</h2>
              <div className="space-y-3">
                {transitions.slice(0, 5).map((tr) => (
                  <div key={tr.id} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm">
                        {tr.fromStage ? (
                          <>
                            <span className="text-muted-foreground">{stageLabel(tr.fromStage)}</span>
                            {" → "}
                            <span className="font-medium">{stageLabel(tr.toStage)}</span>
                          </>
                        ) : (
                          <span className="font-medium">
                            {t("project.createdIn", { stage: stageLabel(tr.toStage) })}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(tr.transitionedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* AI Analysis */}
          <AIAnalysisCard projectId={project.id} />

          {/* Git Scan */}
          <GitScanCard projectId={project.id} localPath={project.localPath} onUpdate={() => mutateProject()} />
        </div>
      </div>
    </div>
  );
}
