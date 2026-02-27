"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProjects } from "@/lib/hooks/use-projects";
import { useLocale } from "@/lib/locale-context";
import { STAGE_COLORS, type ProjectStage } from "@/types";
import { toast } from "sonner";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
}

type InlineAction = null | { mode: "commitment" | "note"; projectId: string; projectName: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inlineAction, setInlineAction] = useState<InlineAction>(null);
  const [actionText, setActionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { projects } = useProjects();
  const { t, stageLabel, locale } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const actionInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeProjects = projects.filter((p) => p.stage !== "archived");

  // Handle inline action submit
  const handleActionSubmit = async () => {
    if (!inlineAction || !actionText.trim()) return;
    setSubmitting(true);
    try {
      if (inlineAction.mode === "commitment") {
        await fetch("/api/commitments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: inlineAction.projectId, commitment: actionText.trim() }),
        });
        toast.success(locale === "zh" ? `承诺已添加到「${inlineAction.projectName}」` : `Commitment added to "${inlineAction.projectName}"`);
      } else {
        await fetch(`/api/projects/${inlineAction.projectId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: actionText.trim() }),
        });
        toast.success(locale === "zh" ? `笔记已添加到「${inlineAction.projectName}」` : `Note added to "${inlineAction.projectName}"`);
      }
      setActionText("");
      setInlineAction(null);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Focus action input when inline action opens
  useEffect(() => {
    if (inlineAction) {
      setTimeout(() => actionInputRef.current?.focus(), 50);
    }
  }, [inlineAction]);

  // Build command items
  const items: CommandItem[] = [];

  // Pages
  const pages = [
    { label: t("nav.dashboard"), href: "/", icon: gridIcon },
    { label: t("nav.pipeline"), href: "/pipeline", icon: barsIcon },
    { label: t("nav.settings"), href: "/settings", icon: settingsIcon },
    { label: t("report.title"), href: "/report", icon: reportIcon },
  ];

  for (const page of pages) {
    items.push({
      id: `page-${page.href}`,
      label: page.label,
      category: t("command.pages"),
      icon: page.icon,
      action: () => {
        router.push(page.href);
        setOpen(false);
      },
    });
  }

  // Actions
  const actions = [
    {
      label: locale === "zh" ? "创建备份" : "Create Backup",
      icon: backupIcon,
      action: async () => {
        await fetch("/api/backup", { method: "POST" });
        setOpen(false);
      },
    },
    {
      label: locale === "zh" ? "扫描所有项目" : "Scan All Projects",
      icon: scanIcon,
      action: async () => {
        await fetch("/api/git-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        setOpen(false);
      },
    },
    {
      label: locale === "zh" ? "检查提醒" : "Check Nudges",
      icon: bellIcon,
      action: async () => {
        await fetch("/api/nudges", { method: "POST" });
        setOpen(false);
      },
    },
  ];

  for (const action of actions) {
    items.push({
      id: `action-${action.label}`,
      label: action.label,
      category: locale === "zh" ? "操作" : "Actions",
      icon: action.icon,
      action: action.action,
    });
  }

  // Quick action: add commitment/note to each active project
  for (const project of activeProjects.slice(0, 5)) {
    items.push({
      id: `quick-commit-${project.id}`,
      label: `${locale === "zh" ? "添加承诺 →" : "Add commitment →"} ${project.name}`,
      category: locale === "zh" ? "快捷操作" : "Quick Actions",
      icon: checkIcon,
      action: () => {
        setInlineAction({ mode: "commitment", projectId: project.id, projectName: project.name });
        setQuery("");
      },
    });
    items.push({
      id: `quick-note-${project.id}`,
      label: `${locale === "zh" ? "添加笔记 →" : "Add note →"} ${project.name}`,
      category: locale === "zh" ? "快捷操作" : "Quick Actions",
      icon: penIcon,
      action: () => {
        setInlineAction({ mode: "note", projectId: project.id, projectName: project.name });
        setQuery("");
      },
    });
  }

  // Projects (filtered by query)
  const q = query.toLowerCase();
  const matchedProjects = projects
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
    .slice(0, 8);

  for (const project of matchedProjects) {
    items.push({
      id: `project-${project.id}`,
      label: project.name,
      description: stageLabel(project.stage),
      category: t("command.projects"),
      icon: (
        <div
          className={`h-3 w-3 rounded-full flex-shrink-0 ${STAGE_COLORS[project.stage as ProjectStage]}`}
        />
      ),
      action: () => {
        router.push(`/projects/${project.id}`);
        setOpen(false);
      },
    });
  }

  // Filter by query
  const filtered = q
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      )
    : items;

  // Group by category
  const grouped: Record<string, CommandItem[]> = {};
  for (const item of filtered) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  const flatFiltered = filtered;

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K: open palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setInlineAction(null);
        setSelectedIndex(0);
      }
      // 'c' key: open palette with commitment filter (not in input)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c") {
        e.preventDefault();
        setOpen(true);
        setQuery(locale === "zh" ? "承诺" : "commitment");
        setInlineAction(null);
        setSelectedIndex(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [locale]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatFiltered[selectedIndex]) {
          flatFiltered[selectedIndex].action();
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [flatFiltered, selectedIndex]
  );

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Reset index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setOpen(false); setInlineAction(null); }}
      />
      {/* Dialog */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg">
        <div className="bg-card border rounded-xl shadow-2xl overflow-hidden">
          {/* Inline action mode */}
          {inlineAction ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">
                  {inlineAction.mode === "commitment"
                    ? locale === "zh" ? `添加承诺 → ${inlineAction.projectName}` : `Add commitment → ${inlineAction.projectName}`
                    : locale === "zh" ? `添加笔记 → ${inlineAction.projectName}` : `Add note → ${inlineAction.projectName}`}
                </p>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setInlineAction(null); setTimeout(() => inputRef.current?.focus(), 50); }}
                >
                  {locale === "zh" ? "返回" : "Back"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={actionInputRef}
                  className="flex-1 h-10 px-3 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                  placeholder={
                    inlineAction.mode === "commitment"
                      ? locale === "zh" ? "今天要完成什么？" : "What will you accomplish?"
                      : locale === "zh" ? "记录想法..." : "Write a note..."
                  }
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleActionSubmit();
                    if (e.key === "Escape") { setInlineAction(null); setTimeout(() => inputRef.current?.focus(), 50); }
                  }}
                />
                <button
                  className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                  onClick={handleActionSubmit}
                  disabled={!actionText.trim() || submitting}
                >
                  {submitting
                    ? locale === "zh" ? "提交中..." : "..."
                    : locale === "zh" ? "提交" : "Submit"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 border-b">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-muted-foreground flex-shrink-0"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  className="flex-1 py-3.5 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  placeholder={t("command.placeholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <kbd className="hidden sm:inline-flex text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div ref={listRef} className="max-h-80 overflow-auto p-2">
                {flatFiltered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {t("command.noResults")}
                  </p>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="mb-2">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                        {category}
                      </p>
                      {items.map((item) => {
                        const idx = flatIndex++;
                        return (
                          <button
                            key={item.id}
                            data-index={idx}
                            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                              idx === selectedIndex
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50"
                            }`}
                            onClick={item.action}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground">
                              {item.icon}
                            </span>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.description && (
                              <span className="text-xs text-muted-foreground">
                                {item.description}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer hints */}
              <div className="border-t px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1 py-0.5 rounded font-mono">↑↓</kbd>
                  {locale === "zh" ? "导航" : "Navigate"}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1 py-0.5 rounded font-mono">↵</kbd>
                  {locale === "zh" ? "选择" : "Select"}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-muted px-1 py-0.5 rounded font-mono">esc</kbd>
                  {locale === "zh" ? "关闭" : "Close"}
                </span>
                <span className="ml-auto text-muted-foreground/60">
                  {locale === "zh" ? "C 快捷承诺" : "C quick commit"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
const gridIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="7" height="9" x="3" y="3" rx="1" />
    <rect width="7" height="5" x="14" y="3" rx="1" />
    <rect width="7" height="9" x="14" y="12" rx="1" />
    <rect width="7" height="5" x="3" y="16" rx="1" />
  </svg>
);
const barsIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="6" height="14" x="2" y="5" rx="2" />
    <rect width="6" height="10" x="9" y="9" rx="2" />
    <rect width="6" height="16" x="16" y="3" rx="2" />
  </svg>
);
const settingsIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
  </svg>
);
const reportIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 18v-4" /><path d="M14 18v-6" />
  </svg>
);
const backupIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);
const scanIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);
const bellIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const checkIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const penIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
  </svg>
);
