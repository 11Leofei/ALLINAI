"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";

interface OnboardingProps {
  onCreateProject: () => void;
  onDiscover: () => void;
}

export function OnboardingCard({ onCreateProject, onDiscover }: OnboardingProps) {
  const { locale } = useLocale();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("allinai-onboarding-dismissed") === "1";
    }
    return false;
  });

  if (dismissed) return null;

  const steps = locale === "zh" ? [
    { icon: "1", title: "创建或导入项目", desc: "手动创建新项目，或从桌面自动发现 Git 仓库" },
    { icon: "2", title: "每天设定承诺", desc: "每天打开时告诉自己今天要完成什么" },
    { icon: "3", title: "跟踪并推进", desc: "记录指标、完成验证清单、推进项目阶段" },
    { icon: "4", title: "AI 帮你分析", desc: "在设置中配置 AI，获取智能项目建议" },
  ] : [
    { icon: "1", title: "Create or import a project", desc: "Create manually or auto-discover Git repos from your disk" },
    { icon: "2", title: "Set daily commitments", desc: "Tell yourself what you'll accomplish today" },
    { icon: "3", title: "Track & advance", desc: "Log metrics, complete validation items, advance stages" },
    { icon: "4", title: "Let AI help", desc: "Configure AI in Settings for intelligent project analysis" },
  ];

  return (
    <Card className="p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">
            {locale === "zh" ? "欢迎使用 ALLINAI" : "Welcome to ALLINAI"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {locale === "zh"
              ? "你的项目孵化仪表盘 — 让想法成为现实"
              : "Your project incubation dashboard — turn ideas into reality"}
          </p>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem("allinai-onboarding-dismissed", "1");
          }}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          {locale === "zh" ? "关闭" : "Dismiss"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {steps.map((step) => (
          <div key={step.icon} className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/60 dark:bg-white/5">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {step.icon}
            </span>
            <p className="text-sm font-medium">{step.title}</p>
            <p className="text-xs text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onCreateProject}>
          {locale === "zh" ? "创建第一个项目" : "Create First Project"}
        </Button>
        <Button variant="outline" onClick={onDiscover}>
          {locale === "zh" ? "从磁盘发现项目" : "Discover from Disk"}
        </Button>
      </div>
    </Card>
  );
}
