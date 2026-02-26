"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { STAGE_ORDER, type ProjectStage } from "@/types";

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  stageFilter: string;
  onStageFilterChange: (stage: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (priority: string) => void;
}

export function SearchFilterBar({
  searchQuery,
  onSearchChange,
  stageFilter,
  onStageFilterChange,
  priorityFilter,
  onPriorityFilterChange,
}: SearchFilterBarProps) {
  const { t, stageLabel } = useLocale();

  const hasFilters = searchQuery || stageFilter !== "all" || priorityFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-[200px]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Input
          placeholder={t("search.placeholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stage filter */}
      <Select value={stageFilter} onValueChange={onStageFilterChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t("filter.allStages")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter.allStages")}</SelectItem>
          {STAGE_ORDER.map((stage) => (
            <SelectItem key={stage} value={stage}>
              {stageLabel(stage)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t("filter.allPriorities")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filter.allPriorities")}</SelectItem>
          <SelectItem value="5">5 - {t("priority.highest")}</SelectItem>
          <SelectItem value="4">4 - {t("priority.high")}</SelectItem>
          <SelectItem value="3">3 - {t("priority.medium")}</SelectItem>
          <SelectItem value="2">2 - {t("priority.low")}</SelectItem>
          <SelectItem value="1">1 - {t("priority.lowest")}</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange("");
            onStageFilterChange("all");
            onPriorityFilterChange("all");
          }}
        >
          {t("filter.clear")}
        </Button>
      )}
    </div>
  );
}
