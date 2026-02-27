"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale-context";
import { updateProject } from "@/lib/hooks/use-projects";

export function GitScanCard({
  projectId,
  localPath,
  onUpdate,
}: {
  projectId: string;
  localPath?: string | null;
  onUpdate: () => void;
}) {
  const { t, locale } = useLocale();
  const [pathInput, setPathInput] = useState(localPath || "");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    commits7d: number;
    linesAdded: number;
    linesRemoved: number;
    branch: string;
    summary: string;
    momentumDelta: number;
  } | null>(null);
  const [editingPath, setEditingPath] = useState(!localPath);

  const savePath = async () => {
    await updateProject(projectId, { localPath: pathInput.trim() || null });
    setEditingPath(false);
    onUpdate();
  };

  const runScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/git-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setScanResult(data);
        onUpdate();
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm">{t("gitScan.title")}</h2>
        {localPath && !editingPath && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={runScan}
            disabled={scanning}
          >
            {scanning ? t("gitScan.scanning") : t("gitScan.scan")}
          </Button>
        )}
      </div>

      {editingPath || !localPath ? (
        <div className="space-y-2">
          <Input
            className="text-xs h-8"
            placeholder={locale === "zh" ? "本地项目路径，如 /Users/you/project" : "Local path, e.g. /Users/you/project"}
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") savePath(); }}
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs" onClick={savePath}>
              {t("common.save")}
            </Button>
            {localPath && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPath(false)}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="text-xs text-muted-foreground font-mono cursor-pointer hover:text-foreground"
            onClick={() => setEditingPath(true)}
            title={locale === "zh" ? "点击修改路径" : "Click to edit path"}
          >
            {localPath}
          </div>

          {scanResult && (
            <div className="mt-2 p-2.5 rounded-lg bg-muted/50 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t("gitScan.commits7d")}:</span>
                <span className="font-medium">{scanResult.commits7d}</span>
                <span className="text-muted-foreground ml-2">+{scanResult.linesAdded} / -{scanResult.linesRemoved}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{locale === "zh" ? "分支" : "Branch"}:</span>
                <span className="font-mono">{scanResult.branch}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{locale === "zh" ? "动量变化" : "Momentum"}:</span>
                <span className={scanResult.momentumDelta > 0 ? "text-green-600 font-medium" : scanResult.momentumDelta < 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                  {scanResult.momentumDelta > 0 ? "+" : ""}{scanResult.momentumDelta}
                </span>
              </div>
              <p className="text-muted-foreground pt-1 border-t">{scanResult.summary}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
