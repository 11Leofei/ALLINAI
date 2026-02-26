"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/locale-context";

import { fetcher } from "@/lib/fetcher";

type AnalysisType = "full" | "next-steps" | "risks" | "code-review";

export function AIAnalysisCard({ projectId }: { projectId: string }) {
  const { locale } = useLocale();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("full");
  const [result, setResult] = useState<{
    analysis: string;
    model: string;
    provider: string;
    tokensUsed?: number;
  } | null>(null);
  const [error, setError] = useState("");

  // Check if AI is configured
  const { data: settingsData } = useSWR("/api/settings", fetcher);
  const isConfigured =
    settingsData?.["ai.provider"] === "claude-code" ||
    (settingsData?.["ai.provider"] && settingsData?.["ai.apiKey"]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, analysisType }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const analysisTypes: { key: AnalysisType; zh: string; en: string }[] = [
    { key: "full", zh: "全面评估", en: "Full Analysis" },
    { key: "next-steps", zh: "下步建议", en: "Next Steps" },
    { key: "risks", zh: "风险识别", en: "Risks" },
    { key: "code-review", zh: "代码审查", en: "Code Review" },
  ];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 0-4 4c0 1.4.7 2.6 1.8 3.3A2 2 0 0 0 8 11v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1a2 2 0 0 0-1.8-1.7A4 4 0 0 0 16 6a4 4 0 0 0-4-4Z" />
            <path d="M9 17v5" />
            <path d="M15 17v5" />
            <path d="M7 21h10" />
          </svg>
          {locale === "zh" ? "AI 分析" : "AI Analysis"}
        </h2>
        {result && (
          <Badge variant="outline" className="text-xs">
            {result.provider}/{result.model?.split("-").slice(0, 2).join("-")}
            {result.tokensUsed ? ` · ${result.tokensUsed} tokens` : ""}
          </Badge>
        )}
      </div>

      {!isConfigured ? (
        <div className="text-sm text-muted-foreground">
          <p>
            {locale === "zh"
              ? "请先在设置中配置 AI API Key"
              : "Please configure AI API Key in Settings first"}
          </p>
          <a href="/settings" className="text-primary hover:underline text-xs mt-1 inline-block">
            {locale === "zh" ? "前往设置 →" : "Go to Settings →"}
          </a>
        </div>
      ) : (
        <>
          {/* Analysis type selector */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {analysisTypes.map((t) => (
              <button
                key={t.key}
                onClick={() => setAnalysisType(t.key)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  analysisType === t.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-accent text-muted-foreground"
                }`}
              >
                {locale === "zh" ? t.zh : t.en}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            onClick={runAnalysis}
            disabled={analyzing}
            className="w-full"
          >
            {analyzing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {locale === "zh" ? "分析中..." : "Analyzing..."}
              </span>
            ) : (
              locale === "zh" ? "开始 AI 分析" : "Run AI Analysis"
            )}
          </Button>

          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm leading-relaxed whitespace-pre-wrap">
              {result.analysis}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
