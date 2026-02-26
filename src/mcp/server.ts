#!/usr/bin/env npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  listProjects, listProjectsSchema,
  getProject, getProjectSchema,
  createProject, createProjectSchema,
  updateProject, updateProjectSchema,
  deleteProject, deleteProjectSchema,
  advanceStage, advanceStageSchema,
} from "./tools/projects";

import { addNote, addNoteSchema, listNotes, listNotesSchema } from "./tools/notes";
import { addMetric, addMetricSchema, getMetrics, getMetricsSchema } from "./tools/metrics";
import {
  addValidationItem, addValidationItemSchema,
  toggleValidation, toggleValidationSchema,
  listValidation, listValidationSchema,
} from "./tools/validation";
import { getDigest, getDigestSchema, getSettings, getSettingsSchema } from "./tools/digest";
import { scanLocalProject, scanLocalProjectSchema } from "./tools/scanner";
import { analyzeProject, analyzeProjectSchema } from "./tools/analyzer";

const server = new McpServer({
  name: "allinai",
  version: "1.0.0",
});

// --- Project tools ---
server.tool("list_projects", "List all projects with optional search/filter", listProjectsSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(listProjects(args), null, 2) }],
}));

server.tool("get_project", "Get detailed information about a specific project", getProjectSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(getProject(args), null, 2) }],
}));

server.tool("create_project", "Create a new project in ALLINAI", createProjectSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(createProject(args), null, 2) }],
}));

server.tool("update_project", "Update project information, stage, or priority", updateProjectSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(updateProject(args), null, 2) }],
}));

server.tool("delete_project", "Delete a project from ALLINAI", deleteProjectSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(deleteProject(args), null, 2) }],
}));

server.tool("advance_stage", "Advance a project to the next stage in the pipeline", advanceStageSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(advanceStage(args), null, 2) }],
}));

// --- Notes tools ---
server.tool("add_note", "Add a note to a project", addNoteSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(addNote(args), null, 2) }],
}));

server.tool("list_notes", "List all notes for a project", listNotesSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(listNotes(args), null, 2) }],
}));

// --- Metrics tools ---
server.tool("add_metric", "Record a metric value for a project", addMetricSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(addMetric(args), null, 2) }],
}));

server.tool("get_metrics", "Get metric history for a project", getMetricsSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(getMetrics(args), null, 2) }],
}));

// --- Validation tools ---
server.tool("add_validation_item", "Add a validation checklist item", addValidationItemSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(addValidationItem(args), null, 2) }],
}));

server.tool("toggle_validation", "Toggle a validation item's completion status", toggleValidationSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(toggleValidation(args), null, 2) }],
}));

// --- Digest & Settings ---
server.tool("get_digest", "Get daily digest: stale projects, momentum ranking, action suggestions", getDigestSchema.shape, async () => ({
  content: [{ type: "text", text: JSON.stringify(getDigest(), null, 2) }],
}));

server.tool("get_settings", "Get ALLINAI system configuration", getSettingsSchema.shape, async () => ({
  content: [{ type: "text", text: JSON.stringify(getSettings(), null, 2) }],
}));

// --- AI tools ---
server.tool("scan_local_project", "Scan a local Git repository and analyze its progress, updating the linked ALLINAI project", scanLocalProjectSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(scanLocalProject(args), null, 2) }],
}));

server.tool("analyze_project", "AI analysis of a project: stage assessment, blockers, next actions, momentum trend", analyzeProjectSchema.shape, async (args) => ({
  content: [{ type: "text", text: JSON.stringify(analyzeProject(args), null, 2) }],
}));

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ALLINAI MCP Server running on stdio");
}

main().catch(console.error);
