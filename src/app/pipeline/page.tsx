"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/lib/hooks/use-projects";
import { PipelineBoard } from "@/components/pipeline/board";
import { CreateProjectDialog } from "@/components/project/create-dialog";
import { SearchFilterBar } from "@/components/search/search-filter-bar";
import { useLocale } from "@/lib/locale-context";

export default function PipelinePage() {
  const { projects, isLoading, mutate } = useProjects();
  const { t } = useLocale();

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (stageFilter !== "all") {
      result = result.filter((p) => p.stage === stageFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((p) => p.priority === parseInt(priorityFilter));
    }
    return result;
  }, [projects, searchQuery, stageFilter, priorityFilter]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold">{t("pipeline.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("pipeline.subtitle")}
          </p>
        </div>
        <CreateProjectDialog onCreated={() => mutate()} />
      </div>

      {/* Search & Filter */}
      <div className="px-6 pt-4">
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          stageFilter={stageFilter}
          onStageFilterChange={setStageFilter}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={setPriorityFilter}
        />
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t("pipeline.loading")}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="text-6xl opacity-20">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect width="6" height="14" x="2" y="5" rx="2" />
                <rect width="6" height="10" x="9" y="9" rx="2" />
                <rect width="6" height="16" x="16" y="3" rx="2" />
              </svg>
            </div>
            <p className="text-muted-foreground">{t("pipeline.noProjects")}</p>
            <CreateProjectDialog onCreated={() => mutate()}>
              <button className="text-primary underline text-sm">
                {t("pipeline.createFirst")}
              </button>
            </CreateProjectDialog>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t("search.noResults")}</p>
          </div>
        ) : (
          <PipelineBoard projects={filteredProjects} onUpdate={() => mutate()} />
        )}
      </div>
    </div>
  );
}
