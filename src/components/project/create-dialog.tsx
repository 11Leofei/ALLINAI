"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProject } from "@/lib/hooks/use-projects";
import { useLocale } from "@/lib/locale-context";
import { PROJECT_TEMPLATES, type ProjectTemplate } from "@/lib/templates";

interface CreateProjectDialogProps {
  onCreated?: () => void;
  children?: React.ReactNode;
}

const SUGGESTED_TAGS_ZH = ["AI", "SaaS", "移动端", "Web", "工具", "社交", "电商", "教育", "健康", "金融"];
const SUGGESTED_TAGS_EN = ["AI", "SaaS", "Mobile", "Web", "Tool", "Social", "E-commerce", "Education", "Health", "Finance"];

export function CreateProjectDialog({
  onCreated,
  children,
}: CreateProjectDialogProps) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"template" | "form">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [priority, setPriority] = useState("3");
  const [loading, setLoading] = useState(false);

  const suggestedTags = locale === "zh" ? SUGGESTED_TAGS_ZH : SUGGESTED_TAGS_EN;

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const selectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    if (template.id !== "blank") {
      setDescription(template.description[locale]);
      setTags(template.tags[locale]);
      setPriority(String(template.defaultPriority));
    } else {
      setDescription("");
      setTags([]);
      setPriority("3");
    }
    setStep("form");
  };

  const resetAndClose = () => {
    setOpen(false);
    setStep("template");
    setSelectedTemplate(null);
    setName("");
    setDescription("");
    setTags([]);
    setTagInput("");
    setPriority("3");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const result = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        tags,
        priority: parseInt(priority),
      });

      // If template has validation items, add them
      if (selectedTemplate && selectedTemplate.id !== "blank" && result?.id) {
        const items = selectedTemplate.validationItems[locale];
        for (let i = 0; i < items.length; i++) {
          await fetch(`/api/projects/${result.id}/validation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: items[i], sortOrder: i }),
          });
        }
      }

      resetAndClose();
      onCreated?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            {t("create.newProject")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {step === "template" ? t("template.title") : t("create.title")}
          </DialogTitle>
        </DialogHeader>

        {step === "template" ? (
          /* Template Selection Grid */
          <div className="grid grid-cols-2 gap-3">
            {PROJECT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => selectTemplate(template)}
                className="flex flex-col items-start gap-1.5 p-4 rounded-lg border hover:border-primary hover:bg-accent/50 transition-colors text-left"
              >
                <span className="text-2xl">{template.icon}</span>
                <span className="font-medium text-sm">{t(template.nameKey)}</span>
                <span className="text-xs text-muted-foreground">{t(template.descKey)}</span>
              </button>
            ))}
          </div>
        ) : (
          /* Project Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedTemplate && selectedTemplate.id !== "blank" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{selectedTemplate.icon}</span>
                <span>{t(selectedTemplate.nameKey)}</span>
                <button
                  type="button"
                  className="text-xs underline ml-auto"
                  onClick={() => setStep("template")}
                >
                  {locale === "zh" ? "换模板" : "Change"}
                </button>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("create.name")}</label>
              <Input
                placeholder={t("create.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("create.description")}</label>
              <Textarea
                placeholder={t("create.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("create.tags")}</label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} &times;
                    </Badge>
                  ))}
                </div>
              )}
              <Input
                placeholder={t("create.tagsPlaceholder")}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestedTags
                  .filter((st) => !tags.includes(st))
                  .slice(0, 6)
                  .map((st) => (
                    <Badge
                      key={st}
                      variant="outline"
                      className="cursor-pointer text-xs hover:bg-accent"
                      onClick={() => addTag(st)}
                    >
                      + {st}
                    </Badge>
                  ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("project.priority")}</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 - {t("priority.highest")}</SelectItem>
                  <SelectItem value="4">4 - {t("priority.high")}</SelectItem>
                  <SelectItem value="3">3 - {t("priority.medium")}</SelectItem>
                  <SelectItem value="2">2 - {t("priority.low")}</SelectItem>
                  <SelectItem value="1">1 - {t("priority.lowest")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && selectedTemplate.id !== "blank" && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium mb-1.5 text-muted-foreground">
                  {locale === "zh"
                    ? `将自动创建 ${selectedTemplate.validationItems[locale].length} 个验证项`
                    : `Will auto-create ${selectedTemplate.validationItems[locale].length} validation items`}
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5 max-h-24 overflow-auto">
                  {selectedTemplate.validationItems[locale].map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-muted-foreground/50">☐</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={resetAndClose}>
                {t("create.cancel")}
              </Button>
              <Button type="submit" disabled={!name.trim() || loading}>
                {loading ? t("create.creating") : t("create.submit")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
