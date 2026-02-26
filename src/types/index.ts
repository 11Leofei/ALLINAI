export type ProjectStage =
  | "idea"
  | "development"
  | "launch"
  | "validation"
  | "data_collection"
  | "archived";

export const STAGE_ORDER: ProjectStage[] = [
  "idea",
  "development",
  "launch",
  "validation",
  "data_collection",
  "archived",
];

/** Fallback only — use getStageLabel(stage, locale) from i18n.ts or stageLabel() from useLocale() */
export const STAGE_LABELS: Record<ProjectStage, string> = {
  idea: "Idea",
  development: "Development",
  launch: "Launch",
  validation: "Validation",
  data_collection: "Data Collection",
  archived: "Archived",
};

export const STAGE_COLORS: Record<ProjectStage, string> = {
  idea: "bg-purple-500",
  development: "bg-blue-500",
  launch: "bg-orange-500",
  validation: "bg-green-500",
  data_collection: "bg-teal-500",
  archived: "bg-gray-400",
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  stage: ProjectStage;
  tags: string[];
  priority: number;
  momentum: number;
  createdAt: number;
  updatedAt: number;
  stageEnteredAt: number;
  localPath?: string | null;
}

export interface StageTransition {
  id: string;
  projectId: string;
  fromStage: ProjectStage | null;
  toStage: ProjectStage;
  transitionedAt: number;
  note: string | null;
}

export interface ValidationItem {
  id: string;
  projectId: string;
  label: string;
  isCompleted: boolean;
  completedAt: number | null;
  sortOrder: number;
}

export interface Metric {
  id: string;
  projectId: string;
  name: string;
  value: number;
  recordedAt: number;
}

export interface Note {
  id: string;
  projectId: string;
  content: string;
  createdAt: number;
}

export interface Nudge {
  id: string;
  projectId: string | null;
  message: string;
  type: "stale" | "milestone" | "daily_digest" | "momentum_drop";
  sentAt: number;
  dismissed: boolean;
}
