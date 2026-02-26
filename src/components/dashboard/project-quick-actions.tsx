"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale-context";
import { toast } from "sonner";

type ActionMode = null | "commitment" | "note";

/**
 * Inline quick action buttons that appear on hover for project list items.
 * Clicking opens a small inline input to add commitment or note.
 */
export function ProjectQuickActions({
  projectId,
  projectName,
  className = "",
}: {
  projectId: string;
  projectName: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const [mode, setMode] = useState<ActionMode>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [mode]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      if (mode === "commitment") {
        await fetch("/api/commitments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            commitment: text.trim(),
          }),
        });
        toast.success(
          locale === "zh"
            ? `承诺已添加到「${projectName}」`
            : `Commitment added to "${projectName}"`
        );
      } else if (mode === "note") {
        await fetch(`/api/projects/${projectId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text.trim() }),
        });
        toast.success(
          locale === "zh"
            ? `笔记已添加到「${projectName}」`
            : `Note added to "${projectName}"`
        );
      }
      setText("");
      setMode(null);
    } catch {
      toast.error(locale === "zh" ? "操作失败" : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (mode) {
    return (
      <div
        className="flex items-center gap-1.5 ml-auto"
        onClick={(e) => e.preventDefault()}
      >
        <Input
          ref={inputRef}
          className="h-6 text-xs w-40"
          placeholder={
            mode === "commitment"
              ? locale === "zh"
                ? "今天做什么？"
                : "What to do?"
              : locale === "zh"
              ? "记录想法..."
              : "Quick note..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") {
              setMode(null);
              setText("");
            }
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
        >
          {locale === "zh" ? "确定" : "OK"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1 text-xs text-muted-foreground"
          onClick={() => {
            setMode(null);
            setText("");
          }}
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
      onClick={(e) => e.preventDefault()}
    >
      <button
        className="h-6 px-1.5 rounded text-xs text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
        onClick={() => setMode("commitment")}
        title={locale === "zh" ? "添加承诺" : "Add commitment"}
      >
        +{locale === "zh" ? "承诺" : "task"}
      </button>
      <button
        className="h-6 px-1.5 rounded text-xs text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
        onClick={() => setMode("note")}
        title={locale === "zh" ? "添加笔记" : "Add note"}
      >
        +{locale === "zh" ? "笔记" : "note"}
      </button>
    </div>
  );
}
