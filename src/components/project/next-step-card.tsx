"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import type { ProjectStage } from "@/types";

const STAGE_NEXT: Record<string, ProjectStage> = {
  idea: "development",
  development: "launch",
  launch: "validation",
  validation: "data_collection",
};

const STAGE_ACCENT: Record<string, string> = {
  idea: "border-l-purple-500",
  development: "border-l-blue-500",
  launch: "border-l-orange-500",
  validation: "border-l-green-500",
  data_collection: "border-l-teal-500",
  archived: "border-l-gray-400",
};

interface NextStepCardProps {
  stage: ProjectStage;
  projectName: string;
  validationDone: number;
  validationTotal: number;
  onAdvance: (stage: string) => void;
}

export function NextStepCard({
  stage,
  projectName,
  validationDone,
  validationTotal,
  onAdvance,
}: NextStepCardProps) {
  const { t, stageLabel } = useLocale();

  const action = t(`nextStep.${stage}.action`);
  const why = t(`nextStep.${stage}.why`);
  const nextStage = STAGE_NEXT[stage];
  const accent = STAGE_ACCENT[stage] || "border-l-gray-400";

  return (
    <Card className={`p-4 border-l-4 ${accent}`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-sm">{t("nextStep.title")}</h2>
        <span className="text-xs text-muted-foreground">{stageLabel(stage)}</span>
      </div>

      <p className="font-medium text-base mt-2">{action}</p>
      <p className="text-sm text-muted-foreground mt-1">{why}</p>

      {/* Stage-specific context */}
      {stage === "validation" && validationTotal > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${(validationDone / validationTotal) * 100}%` }}
            />
          </div>
          <span className="text-muted-foreground">
            {validationDone}/{validationTotal}
          </span>
        </div>
      )}

      {nextStage && stage !== "archived" && (
        <Button
          size="sm"
          className="mt-3"
          onClick={() => onAdvance(nextStage)}
        >
          {stageLabel(nextStage)} →
        </Button>
      )}
    </Card>
  );
}
