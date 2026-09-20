import type { AgentInput, Schedule } from "@/lib/types";

export type Provider = "anthropic" | "openai";

export function getProvider(): Provider | null {
  const forced = process.env.LLM_PROVIDER;
  if (forced === "openai" || forced === "anthropic") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/** Описание инструмента, не зависящее от провайдера. parameters это JSON Schema. */
export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolOutcome = { ok: boolean; result: string; summary: string };

export type Extractor = (input: AgentInput, instructions?: string) => Promise<Schedule | null>;

export type LoopParams = {
  system: string;
  userMessage: string;
  tools: ToolDef[];
  maxSteps: number;
  onText: (text: string) => void;
  onToolCall: (name: string, input: unknown) => Promise<ToolOutcome>;
};

/** Возвращает true, если модель завершила работу сама, false если упёрлась в лимит шагов. */
export type LoopRunner = (params: LoopParams) => Promise<boolean>;

export async function loadProvider(provider: Provider): Promise<{ runLoop: LoopRunner; extract: Extractor }> {
  if (provider === "openai") {
    const m = await import("./openai");
    return { runLoop: m.runLoop, extract: m.extract };
  }
  const m = await import("./anthropic");
  return { runLoop: m.runLoop, extract: m.extract };
}

/** Человекочитаемое сообщение об ошибке провайдера. */
export function describeError(err: unknown): string {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    if (status === 401) return "Неверный ключ модели";
    if (status === 429) return "Лимит запросов или нет баланса у провайдера, попробуй через минуту";
    if (status === 402) return "Нет баланса у провайдера";
  }
  return err instanceof Error ? err.message : "Ошибка агента";
}
