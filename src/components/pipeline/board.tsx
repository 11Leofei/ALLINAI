"use client";

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { ProjectCard } from "./project-card";
import { STAGE_ORDER, STAGE_COLORS, type Project, type ProjectStage } from "@/types";
import { updateProject } from "@/lib/hooks/use-projects";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useLocale } from "@/lib/locale-context";

interface PipelineBoardProps {
  projects: Project[];
  onUpdate: () => void;
}

export function PipelineBoard({ projects, onUpdate }: PipelineBoardProps) {
  const { t, stageLabel } = useLocale();
  const activeStages = STAGE_ORDER.filter((s) => s !== "archived");

  const projectsByStage: Record<string, Project[]> = {};
  for (const stage of activeStages) {
    projectsByStage[stage] = projects
      .filter((p) => p.stage === stage)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const archivedProjects = projects.filter((p) => p.stage === "archived");

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const projectId = result.draggableId;
    const newStage = result.destination.droppableId as ProjectStage;

    const project = projects.find((p) => p.id === projectId);
    if (!project || project.stage === newStage) return;

    await updateProject(projectId, { stage: newStage });
    onUpdate();
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <ScrollArea className="w-full">
        <div className="flex gap-4 p-1 min-w-max">
          {activeStages.map((stage) => (
            <div key={stage} className="w-72 flex-shrink-0">
              {/* Column header */}
              <div className="mb-3 flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${STAGE_COLORS[stage]}`} />
                <h3 className="font-semibold text-sm">{stageLabel(stage)}</h3>
                <span className="text-xs text-muted-foreground ml-auto rounded-full bg-muted px-2 py-0.5">
                  {projectsByStage[stage].length}
                </span>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 rounded-lg border border-dashed p-2 min-h-[200px] transition-colors ${
                      snapshot.isDraggingOver
                        ? "border-primary bg-accent/50"
                        : "border-muted"
                    }`}
                  >
                    {projectsByStage[stage].length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                        {t("pipeline.noProjects")}
                      </div>
                    )}
                    {projectsByStage[stage].map((project, index) => (
                      <Draggable
                        key={project.id}
                        draggableId={project.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <ProjectCard
                              project={project}
                              isDragging={snapshot.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Archived section */}
      {archivedProjects.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${STAGE_COLORS.archived}`} />
            {t("pipeline.archived")} ({archivedProjects.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {archivedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}
    </DragDropContext>
  );
}
