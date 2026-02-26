"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/lib/hooks/use-projects";
import { useLocale } from "@/lib/locale-context";
import { toast } from "sonner";

type QuickActionMode = null | "commitment" | "note";

export function QuickActionFAB() {
  const { locale } = useLocale();
  const { projects } = useProjects();
  const activeProjects = projects.filter((p) => p.stage !== "archived");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuickActionMode>(null);
  const [projectId, setProjectId] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when mode changes
  useEffect(() => {
    if (mode) setTimeout(() => inputRef.current?.focus(), 100);
  }, [mode]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode(null);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSubmit = async () => {
    if (!projectId || !text.trim()) return;
    setSubmitting(true);

    try {
      if (mode === "commitment") {
        await fetch("/api/commitments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, commitment: text.trim() }),
        });
        toast.success(locale === "zh" ? "承诺已添加" : "Commitment added");
      } else if (mode === "note") {
        await fetch(`/api/projects/${projectId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text.trim() }),
        });
        toast.success(locale === "zh" ? "笔记已保存" : "Note saved");
      }
      setText("");
      setMode(null);
      setOpen(false);
    } catch {
      toast.error(locale === "zh" ? "操作失败" : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (activeProjects.length === 0) return null;

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {open && (
        <div className="bg-popover border shadow-xl rounded-xl p-4 w-80 animate-in slide-in-from-bottom-2 fade-in duration-200">
          {!mode ? (
            <div className="space-y-2">
              <p className="text-sm font-medium mb-3">
                {locale === "zh" ? "快捷操作" : "Quick Actions"}
              </p>
              <button
                onClick={() => setMode("commitment")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium">{locale === "zh" ? "添加今日承诺" : "Add Commitment"}</p>
                  <p className="text-xs text-muted-foreground">{locale === "zh" ? "设定今天要完成的事" : "Set what you'll do today"}</p>
                </div>
              </button>
              <button
                onClick={() => setMode("note")}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium">{locale === "zh" ? "快速记笔记" : "Quick Note"}</p>
                  <p className="text-xs text-muted-foreground">{locale === "zh" ? "记录想法或决策" : "Capture a thought or decision"}</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {mode === "commitment"
                    ? locale === "zh" ? "添加承诺" : "Add Commitment"
                    : locale === "zh" ? "添加笔记" : "Add Note"}
                </p>
                <button
                  onClick={() => setMode(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {locale === "zh" ? "返回" : "Back"}
                </button>
              </div>

              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={locale === "zh" ? "选择项目" : "Select project"} />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                ref={inputRef}
                placeholder={
                  mode === "commitment"
                    ? locale === "zh" ? "今天要完成什么？" : "What will you accomplish?"
                    : locale === "zh" ? "记录想法..." : "Write a note..."
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                className="text-sm"
              />

              <Button
                size="sm"
                className="w-full"
                onClick={handleSubmit}
                disabled={!projectId || !text.trim() || submitting}
              >
                {submitting
                  ? locale === "zh" ? "提交中..." : "Submitting..."
                  : locale === "zh" ? "提交" : "Submit"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => { setOpen(!open); if (open) setMode(null); }}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open
            ? "bg-muted text-muted-foreground rotate-45"
            : "bg-primary text-primary-foreground hover:scale-105"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
