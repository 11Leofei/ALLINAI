import useSWR from "swr";
import type { Project } from "@/types";
import { fetcher } from "@/lib/fetcher";

export function useProjects() {
  const { data, error, mutate, isLoading } = useSWR<Project[]>(
    "/api/projects",
    fetcher
  );

  return {
    projects: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

export function useProject(id: string | null) {
  const { data, error, mutate, isLoading } = useSWR<Project>(
    id ? `/api/projects/${id}` : null,
    fetcher
  );

  return {
    project: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export async function createProject(data: {
  name: string;
  description?: string;
  tags?: string[];
  stage?: string;
  priority?: number;
}) {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateProject(
  id: string,
  data: Record<string, unknown>
) {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteProject(id: string) {
  const res = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
  });
  return res.json();
}
