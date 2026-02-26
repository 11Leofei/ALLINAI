/**
 * Multi-model AI provider — supports Claude (API key + Claude Code OAuth token),
 * OpenAI, and custom endpoints.
 * API keys are stored in the app's settings DB, not read from env.
 */

import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { execSync } from "child_process";

export type AIProvider = "claude" | "claude-code" | "openai" | "custom";

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // for custom endpoints
}

interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  tokensUsed?: number;
}

function getSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

/**
 * Read Claude Code OAuth token from macOS Keychain.
 * Claude Code stores its credentials in Keychain under "Claude Code-credentials".
 */
export function getClaudeCodeToken(): string | null {
  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    const parsed = JSON.parse(raw);
    return parsed?.claudeAiOauth?.accessToken || null;
  } catch {
    return null;
  }
}

export function getAIConfig(): AIConfig | null {
  const provider = (getSetting("ai.provider") as AIProvider) || null;
  const apiKey = getSetting("ai.apiKey") as string;
  const model = getSetting("ai.model") as string;
  const baseUrl = getSetting("ai.baseUrl") as string;

  // Claude Code token mode — auto-read from Keychain
  if (provider === "claude-code") {
    const token = getClaudeCodeToken();
    if (!token) return null;
    return {
      provider: "claude-code",
      apiKey: token,
      model: model || "claude-sonnet-4-20250514",
    };
  }

  if (!provider || !apiKey) return null;

  return {
    provider,
    apiKey,
    model: model || getDefaultModel(provider),
    baseUrl: baseUrl || undefined,
  };
}

function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case "claude":
    case "claude-code":
      return "claude-sonnet-4-20250514";
    case "openai":
      return "gpt-4o";
    case "custom":
      return "default";
  }
}

export async function chatCompletion(
  messages: AIMessage[],
  config?: AIConfig
): Promise<AIResponse> {
  const cfg = config || getAIConfig();
  if (!cfg) {
    throw new Error("AI not configured. Please set API key in Settings.");
  }

  switch (cfg.provider) {
    case "claude":
      return callClaude(messages, cfg);
    case "claude-code":
      return callClaudeWithOAuth(messages, cfg);
    case "openai":
      return callOpenAI(messages, cfg);
    case "custom":
      return callCustom(messages, cfg);
  }
}

async function callClaudeWithOAuth(
  messages: AIMessage[],
  config: AIConfig
): Promise<AIResponse> {
  // Claude Code OAuth token uses Bearer auth instead of x-api-key
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error (OAuth): ${res.status} ${err}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find(
    (b: { type: string }) => b.type === "text"
  );

  return {
    content: textBlock?.text || "",
    model: data.model,
    provider: "claude-code",
    tokensUsed:
      (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}

async function callClaude(
  messages: AIMessage[],
  config: AIConfig
): Promise<AIResponse> {
  // Extract system message
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 4096,
    messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find(
    (b: { type: string }) => b.type === "text"
  );

  return {
    content: textBlock?.text || "",
    model: data.model,
    provider: "claude",
    tokensUsed:
      (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };
}

async function callOpenAI(
  messages: AIMessage[],
  config: AIConfig
): Promise<AIResponse> {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model,
    provider: "openai",
    tokensUsed: data.usage?.total_tokens,
  };
}

async function callCustom(
  messages: AIMessage[],
  config: AIConfig
): Promise<AIResponse> {
  if (!config.baseUrl) {
    throw new Error("Custom provider requires a base URL.");
  }

  // Use OpenAI-compatible format (most custom endpoints support this)
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Custom API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model || config.model,
    provider: "custom",
    tokensUsed: data.usage?.total_tokens,
  };
}

export function isAIConfigured(): boolean {
  return getAIConfig() !== null;
}
