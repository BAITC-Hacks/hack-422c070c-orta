import Anthropic from "@anthropic-ai/sdk";
import { AGENT_SYSTEM_PROMPT } from "@/lib/prompt";
import { AgentState, TOOLS } from "@/lib/tools";
import { getSupabase } from "@/lib/supabase";
import type { AgentEvent, AgentInput } from "@/lib/types";

export const maxDuration = 300;

const MAX_STEPS = 14;

export async function POST(req: Request) {
  const input = (await req.json()) as AgentInput;
  if (!input.group?.trim()) return Response.json({ error: "Укажи группу" }, { status: 400 });
  if (!input.text?.trim() && !input.image) return Response.json({ error: "Загрузи фото или вставь текст" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Нет ANTHROPIC_API_KEY в окружении" }, { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const events: AgentEvent[] = [];
      const send = (e: AgentEvent) => {
        events.push(e);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const startedAt = new Date().toISOString();
      try {
        await runAgent(input, send);
      } catch (err) {
        const message =
          err instanceof Anthropic.AuthenticationError ? "Неверный ANTHROPIC_API_KEY"
          : err instanceof Anthropic.RateLimitError ? "Лимит запросов к Claude, попробуй через минуту"
          : err instanceof Error ? err.message : "Ошибка агента";
        send({ type: "error", message });
      } finally {
        await logRun(input.group, startedAt, events);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

async function runAgent(input: AgentInput, send: (e: AgentEvent) => void) {
  const client = new Anthropic();
  const state = new AgentState(input, client);

  const sourceDesc = [
    `Группа: ${input.group}.`,
    input.image ? "Загружено фото расписания, инструмент extract_schedule его видит." : "",
    input.text ? `Текст из чата (${input.text.length} символов), инструмент extract_schedule его видит.` : "",
    "Выполни задачу до конца.",
  ].filter(Boolean).join(" ");

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: sourceDesc }];
  let lastFail: string | null = null;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: AGENT_SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) send({ type: "plan", text: block.text.trim() });
    }

    if (response.stop_reason === "refusal") throw new Error("Модель отказалась выполнять запрос");
    if (response.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      send({ type: "tool_call", tool: block.name, input: block.input });
      const outcome = await state.run(block.name, block.input);
      send({ type: "tool_result", tool: block.name, ok: outcome.ok, summary: outcome.summary });
      if (!outcome.ok) {
        lastFail = block.name;
      } else if (lastFail && (block.name === lastFail || block.name === "extract_schedule" || block.name === "fix_schedule")) {
        send({ type: "retry", reason: `Повторная попытка после ошибки в ${lastFail}: успешно` });
        lastFail = null;
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: outcome.result, is_error: !outcome.ok });
    }
    messages.push({ role: "user", content: results });
  }

  send({
    type: "done",
    summary: `Готово: ${state.saved} занятий сохранено, календарь ${state.ics ? "создан" : "не создан"}, уведомление ${state.notified ? "отправлено" : "в режиме заглушки"}`,
    schedule: state.schedule,
    ics: state.ics,
    saved: state.saved,
    notified: state.notified,
  });
}

async function logRun(group: string, startedAt: string, events: AgentEvent[]) {
  const sb = getSupabase();
  if (!sb) return;
  const done = events.find((e) => e.type === "done");
  const error = events.find((e) => e.type === "error");
  await sb.from("agent_runs").insert({
    group_name: group,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: error ? "error" : done ? "done" : "incomplete",
    tool_calls: events.filter((e) => e.type === "tool_call").length,
    retries: events.filter((e) => e.type === "retry").length,
    log: events,
  });
}
