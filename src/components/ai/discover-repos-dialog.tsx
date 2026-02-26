"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale-context";

import { fetcher } from "@/lib/fetcher";

interface DiscoveredRepo {
  path: string;
  name: string;
  branch: string;
  lastCommit: string;
  lastCommitDate: number;
  language: string;
  hasPackageJson: boolean;
  hasReadme: boolean;
  isLinked: boolean;
  linkedProjectId?: string;
}

export function DiscoverReposDialog({
  onImport,
  children,
}: {
  onImport: (data: { name: string; description: string; tags: string[]; localPath: string }) => void;
  children?: React.ReactNode;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [scanning, setScanning] = useState(false);

  const url = open
    ? `/api/discover${customPath ? `?path=${encodeURIComponent(customPath)}` : ""}`
    : null;
  const { data, isLoading, mutate } = useSWR(url, fetcher);

  const repos: DiscoveredRepo[] = data?.repos || [];

  const handleScanCustom = () => {
    if (customPath.trim()) {
      setScanning(true);
      mutate().finally(() => setScanning(false));
    }
  };

  const handleImport = async (repo: DiscoveredRepo) => {
    // Get pre-filled project data from API
    const res = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath: repo.path }),
    });
    const projectData = await res.json();
    onImport(projectData);
    setOpen(false);
  };

  const timeAgo = (timestamp: number): string => {
    if (!timestamp) return locale === "zh" ? "无提交" : "No commits";
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return locale === "zh" ? "今天" : "Today";
    if (days === 1) return locale === "zh" ? "昨天" : "Yesterday";
    if (days < 30) return locale === "zh" ? `${days}天前` : `${days}d ago`;
    if (days < 365) return locale === "zh" ? `${Math.floor(days / 30)}月前` : `${Math.floor(days / 30)}mo ago`;
    return locale === "zh" ? `${Math.floor(days / 365)}年前` : `${Math.floor(days / 365)}y ago`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {locale === "zh" ? "发现本地项目" : "Discover Local Repos"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {locale === "zh" ? "发现本地 Git 项目" : "Discover Local Git Repos"}
          </DialogTitle>
        </DialogHeader>

        {/* Custom path scan */}
        <div className="flex gap-2">
          <Input
            placeholder={locale === "zh" ? "自定义扫描路径，如 ~/Desktop" : "Custom path, e.g. ~/Desktop"}
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleScanCustom(); }}
            className="text-sm"
          />
          <Button size="sm" onClick={handleScanCustom} disabled={scanning || isLoading}>
            {locale === "zh" ? "扫描" : "Scan"}
          </Button>
        </div>

        {/* Stats */}
        {data && (
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>
              {locale === "zh"
                ? `发现 ${data.total} 个仓库`
                : `Found ${data.total} repos`}
            </span>
            {data.unlinked > 0 && (
              <Badge variant="secondary" className="text-xs">
                {locale === "zh"
                  ? `${data.unlinked} 个未关联`
                  : `${data.unlinked} unlinked`}
              </Badge>
            )}
            <span className="text-muted-foreground/50">
              {locale === "zh" ? "扫描路径：" : "Scanned: "}
              {data.scannedDirs?.join(", ")}
            </span>
          </div>
        )}

        {/* Repo list */}
        <div className="flex-1 overflow-auto space-y-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {locale === "zh" ? "扫描中..." : "Scanning..."}
            </div>
          ) : repos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {locale === "zh" ? "未发现 Git 项目" : "No Git repos found"}
            </p>
          ) : (
            repos.map((repo) => (
              <div
                key={repo.path}
                className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors ${
                  repo.isLinked ? "opacity-60" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{repo.name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {repo.language}
                    </Badge>
                    {repo.isLinked && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {locale === "zh" ? "已关联" : "Linked"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      {repo.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>{repo.branch}</span>
                    <span>{timeAgo(repo.lastCommitDate)}</span>
                    {repo.lastCommit && (
                      <span className="truncate max-w-48">{repo.lastCommit}</span>
                    )}
                  </div>
                </div>
                {!repo.isLinked && (
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => handleImport(repo)}>
                    {locale === "zh" ? "导入" : "Import"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
