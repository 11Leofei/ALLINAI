"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocale } from "@/lib/locale-context";
import type { Locale } from "@/lib/i18n";

import { fetcher } from "@/lib/fetcher";

export default function SettingsPage() {
  const { data: settings, mutate } = useSWR("/api/settings", fetcher);
  const { t, stageLabel, locale, setLocale } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nudgeEnabled, setNudgeEnabled] = useState(true);
  const [thresholds, setThresholds] = useState({
    idea: 3, development: 5, launch: 7, validation: 5, data_collection: 7,
  });
  const [digestTime, setDigestTime] = useState("09:00");
  const [checkInterval, setCheckInterval] = useState(30);
  const [decayRate, setDecayRate] = useState(5);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setNudgeEnabled(settings["nudge.enabled"] ?? true);
      if (settings["nudge.staleThresholdDays"]) setThresholds(settings["nudge.staleThresholdDays"]);
      setDigestTime(settings["nudge.dailyDigestTime"] ?? "09:00");
      setCheckInterval(settings["nudge.checkIntervalMinutes"] ?? 30);
      setDecayRate(settings["momentum.decayRatePerDay"] ?? 5);
    }
  }, [settings]);

  const handleSave = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "nudge.enabled": nudgeEnabled,
        "nudge.staleThresholdDays": thresholds,
        "nudge.dailyDigestTime": digestTime,
        "nudge.checkIntervalMinutes": checkInterval,
        "momentum.decayRatePerDay": decayRate,
      }),
    });
    mutate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    const res = await fetch("/api/projects");
    const projects = await res.json();
    const blob = new Blob([JSON.stringify({ projects, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `allinai-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let imported = 0;
      if (data.projects && Array.isArray(data.projects)) {
        for (const proj of data.projects) {
          await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(proj),
          });
          imported++;
        }
      }
      if (data.settings && typeof data.settings === "object") {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data.settings),
        });
        mutate();
      }
      alert(t("settings.importSuccess", { count: imported }));
    } catch {
      alert(t("settings.importFailed"));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      {/* Language */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">{t("settings.language")}</h2>
        <div className="flex gap-2">
          <Button
            variant={locale === "zh" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("zh" as Locale)}
          >
            {t("settings.langZh")}
          </Button>
          <Button
            variant={locale === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("en" as Locale)}
          >
            {t("settings.langEn")}
          </Button>
        </div>
      </Card>

      {/* Theme */}
      <ThemeSection />

      {/* Nudge System */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">{t("settings.nudgeSystem")}</h2>
        <div className="flex items-center gap-2">
          <Checkbox checked={nudgeEnabled} onCheckedChange={(c) => setNudgeEnabled(!!c)} />
          <label className="text-sm">{t("settings.enableNotifications")}</label>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("settings.digestTime")}</label>
          <Input type="time" value={digestTime} onChange={(e) => setDigestTime(e.target.value)} className="w-32" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("settings.checkInterval")}</label>
          <Input type="number" value={checkInterval} onChange={(e) => setCheckInterval(parseInt(e.target.value) || 30)} className="w-32" />
        </div>
      </Card>

      {/* Staleness Thresholds */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">{t("settings.staleThresholds")}</h2>
        {Object.entries(thresholds).map(([stage, value]) => (
          <div key={stage} className="flex items-center gap-3">
            <label className="text-sm flex-1">{stageLabel(stage)}</label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setThresholds({ ...thresholds, [stage]: parseInt(e.target.value) || 1 })}
              className="w-20"
            />
          </div>
        ))}
      </Card>

      {/* Momentum Settings */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">{t("settings.momentumParams")}</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm flex-1">{t("settings.decayRate")}</label>
          <Input type="number" value={decayRate} onChange={(e) => setDecayRate(parseInt(e.target.value) || 1)} className="w-20" />
        </div>
      </Card>

      {/* Data */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">{t("settings.dataManagement")}</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>{t("settings.export")}</Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>{t("settings.import")}</Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.dbLocation")}</p>
      </Card>

      {/* AI Configuration */}
      <AISettingsSection />

      {/* Backup */}
      <BackupSection />

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>{t("settings.save")}</Button>
        {saved && <span className="text-sm text-green-600">{t("settings.saved")}</span>}
      </div>
    </div>
  );
}

function AISettingsSection() {
  const { locale } = useLocale();
  const { data: settings, mutate } = useSWR("/api/settings", fetcher);
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tokenDetected, setTokenDetected] = useState<{ found: boolean; preview: string | null } | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (settings) {
      setProvider(settings["ai.provider"] || "");
      setApiKey(settings["ai.apiKey"] || "");
      setModel(settings["ai.model"] || "");
      setBaseUrl(settings["ai.baseUrl"] || "");
    }
  }, [settings]);

  const handleSaveAI = async () => {
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "ai.provider": provider,
        "ai.apiKey": apiKey,
        "ai.model": model || undefined,
        "ai.baseUrl": baseUrl || undefined,
      }),
    });
    mutate();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save first
      await handleSaveAI();
      // Then test
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "__test__", analysisType: "full" }),
      });
      const data = await res.json();
      if (data.error) {
        // "Project not found" means the API key works (it got past auth)
        if (data.error.includes("not found") || data.error.includes("Not found")) {
          setTestResult({ ok: true, msg: locale === "zh" ? "连接成功！" : "Connection OK!" });
        } else {
          setTestResult({ ok: false, msg: data.error });
        }
      } else {
        setTestResult({ ok: true, msg: locale === "zh" ? "连接成功！" : "Connection OK!" });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleDetectToken = async () => {
    setDetecting(true);
    setTokenDetected(null);
    try {
      const res = await fetch("/api/ai-detect-token");
      const data = await res.json();
      setTokenDetected(data);
      if (data.found) {
        setProvider("claude-code");
      }
    } catch {
      setTokenDetected({ found: false, preview: null });
    } finally {
      setDetecting(false);
    }
  };

  const defaultModels: Record<string, string[]> = {
    claude: ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514"],
    "claude-code": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514"],
    openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
    custom: [],
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 0-4 4c0 1.4.7 2.6 1.8 3.3A2 2 0 0 0 8 11v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1a2 2 0 0 0-1.8-1.7A4 4 0 0 0 16 6a4 4 0 0 0-4-4Z" />
          <path d="M9 17v5" />
          <path d="M15 17v5" />
          <path d="M7 21h10" />
        </svg>
        {locale === "zh" ? "AI 配置" : "AI Configuration"}
      </h2>
      <p className="text-xs text-muted-foreground">
        {locale === "zh"
          ? "配置 AI 模型来获取项目智能分析。支持 Claude、OpenAI 和自定义 API。"
          : "Configure AI model for intelligent project analysis. Supports Claude, OpenAI, and custom APIs."}
      </p>

      {/* Provider */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {locale === "zh" ? "AI 提供商" : "AI Provider"}
        </label>
        <div className="flex flex-wrap gap-2">
          {(["claude-code", "claude", "openai", "custom"] as const).map((p) => (
            <Button
              key={p}
              variant={provider === p ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setProvider(p);
                setModel("");
                if (p === "claude-code") handleDetectToken();
              }}
            >
              {p === "claude-code"
                ? "Claude Code Token"
                : p === "claude"
                ? "Claude API Key"
                : p === "openai"
                ? "OpenAI"
                : locale === "zh" ? "自定义" : "Custom"}
            </Button>
          ))}
        </div>
      </div>

      {/* Claude Code Token mode */}
      {provider === "claude-code" && (
        <>
          <div className="p-4 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-800 space-y-3">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" x2="3" y1="12" y2="12" />
              </svg>
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                {locale === "zh" ? "使用 Claude Code 登录凭证" : "Use Claude Code Login Credentials"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {locale === "zh"
                ? "自动从 macOS 钥匙串读取 Claude Code 的 OAuth Token，无需手动输入 API Key。"
                : "Auto-reads Claude Code OAuth Token from macOS Keychain. No API key needed."}
            </p>

            {detecting ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {locale === "zh" ? "检测中..." : "Detecting..."}
              </div>
            ) : tokenDetected?.found ? (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                  {locale === "zh" ? "已检测到 Token" : "Token detected"}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{tokenDetected.preview}</span>
              </div>
            ) : tokenDetected && !tokenDetected.found ? (
              <div className="text-sm text-red-500">
                {locale === "zh"
                  ? "未找到 Claude Code Token。请确保已通过 claude 命令行登录。"
                  : "Claude Code Token not found. Make sure you've logged in via the claude CLI."}
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={handleDetectToken}>
                {locale === "zh" ? "检测 Token" : "Detect Token"}
              </Button>
            )}
          </div>
        </>
      )}

      {/* API Key — for non-claude-code providers */}
      {provider && provider !== "claude-code" && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <Input
              type="password"
              placeholder={
                provider === "claude"
                  ? "sk-ant-api03-..."
                  : provider === "openai"
                  ? "sk-..."
                  : "API Key"
              }
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Base URL for custom */}
          {(provider === "custom" || provider === "openai") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {locale === "zh" ? "API 地址" : "Base URL"}
                {provider === "openai" && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({locale === "zh" ? "可选，默认为 OpenAI 官方" : "Optional, defaults to OpenAI"})
                  </span>
                )}
              </label>
              <Input
                placeholder={
                  provider === "custom"
                    ? "https://your-api-endpoint.com/v1"
                    : "https://api.openai.com/v1"
                }
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      {/* Model selector + save/test — for all providers */}
      {provider && (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {locale === "zh" ? "模型" : "Model"}
            </label>
            {defaultModels[provider]?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {defaultModels[provider].map((m) => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      model === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
                <Input
                  placeholder={locale === "zh" ? "或输入自定义模型" : "Or enter custom model"}
                  value={defaultModels[provider].includes(model) ? "" : model}
                  onChange={(e) => setModel(e.target.value)}
                  className="text-sm h-7 w-48"
                />
              </div>
            ) : (
              <Input
                placeholder={locale === "zh" ? "模型名称" : "Model name"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveAI}>
              {locale === "zh" ? "保存 AI 设置" : "Save AI Settings"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={
                (provider !== "claude-code" && !apiKey) ||
                (provider === "claude-code" && !tokenDetected?.found) ||
                testing
              }
            >
              {testing
                ? locale === "zh" ? "测试中..." : "Testing..."
                : locale === "zh" ? "测试连接" : "Test Connection"}
            </Button>
            {saved && <span className="text-sm text-green-600">{locale === "zh" ? "已保存" : "Saved!"}</span>}
            {testResult && (
              <span className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-500"}`}>
                {testResult.msg}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function BackupSection() {
  const { t, locale } = useLocale();
  const { data: backupData, mutate } = useSWR("/api/backup", fetcher);
  const [backing, setBacking] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");

  const handleBackup = async () => {
    setBacking(true);
    try {
      await fetch("/api/backup", { method: "POST" });
      mutate();
      setBackupMsg(t("backup.success"));
      setTimeout(() => setBackupMsg(""), 2000);
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async (name: string) => {
    const msg = locale === "zh"
      ? `确定要恢复到备份 ${name} 吗？当前数据将自动备份。`
      : `Restore from ${name}? Current data will be auto-backed up.`;
    if (!confirm(msg)) return;
    await fetch("/api/backup", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    mutate();
    window.location.reload();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-semibold">{t("backup.title")}</h2>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleBackup} disabled={backing}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          {backing
            ? (locale === "zh" ? "备份中..." : "Backing up...")
            : t("backup.backupNow")}
        </Button>
        {backupMsg && <span className="text-sm text-green-600">{backupMsg}</span>}
        {backupData?.dbSize > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            DB: {formatSize(backupData.dbSize)}
          </span>
        )}
      </div>
      {backupData?.backups?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {locale === "zh" ? "备份列表" : "Backup History"} ({backupData.backups.length})
          </p>
          <div className="max-h-40 overflow-auto space-y-1">
            {backupData.backups.map((b: { name: string; size: number; createdAt: number }) => (
              <div key={b.name} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-accent">
                <span className="flex-1 truncate font-mono">{b.name}</span>
                <span className="text-muted-foreground">{formatSize(b.size)}</span>
                <span className="text-muted-foreground">
                  {new Date(b.createdAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                </span>
                <button
                  className="text-blue-500 hover:underline"
                  onClick={() => handleRestore(b.name)}
                >
                  {t("backup.restore")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ThemeSection() {
  const { t } = useLocale();
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const saved = localStorage.getItem("allinai-theme") as "light" | "dark" | "system" | null;
    if (saved) {
      setThemeState(saved);
      applyTheme(saved);
    }
  }, []);

  function applyTheme(mode: "light" | "dark" | "system") {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }

  function setTheme(mode: "light" | "dark" | "system") {
    setThemeState(mode);
    localStorage.setItem("allinai-theme", mode);
    applyTheme(mode);
  }

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-semibold">{t("settings.theme")}</h2>
      <div className="flex gap-2">
        <Button
          variant={theme === "light" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("light")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" /><path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" /><path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
          </svg>
          {t("settings.themeLight")}
        </Button>
        <Button
          variant={theme === "dark" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("dark")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
          {t("settings.themeDark")}
        </Button>
        <Button
          variant={theme === "system" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("system")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
          </svg>
          {t("settings.themeSystem")}
        </Button>
      </div>
    </Card>
  );
}
