import { AGENT_SYSTEM_PROMPT } from "@/lib/prompt";
import { AgentState, TOOL_DEFS } from "@/lib/tools";
import { getSupabase } from "@/lib/supabase";
import { describeError, getProvider, loadProvider } from "@/lib/llm";
import type { AgentEvent, AgentInput } from "@/lib/types";

export const maxDuration = 300;

const MAX_STEPS = 14;

const TOOL_NAMES: Record<string, string> = {
  extract_schedule: "распознавания",
  validate_schedule: "проверки",
  fix_schedule: "исправления",
  save_schedule: "записи в базу",
  verify_saved: "сверки",
  create_calendar: "календаря",
  notify_group: "уведомления",
};

export async function POST(req: Request) {
  const input = (await req.json()) as AgentInput;
  if (!input.group?.trim()) return Response.json({ error: "Укажи группу" }, { status: 400 });
  if (!input.text?.trim() && !input.image) return Response.json({ error: "Загрузи фото или вставь текст" }, { status: 400 });
  if (input.image && input.image.data.length > 5_400_000) return Response.json({ error: "Фото больше 4 МБ, сожми или обрежь" }, { status: 413 });
  const provider = getProvider();
  if (!provider) return Response.json({ error: "Нет ключа модели в окружении: задай OPENAI_API_KEY или ANTHROPIC_API_KEY" }, { status: 500 });

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
        await runAgent(provider, input, send);
      } catch (err) {
        console.error(err);
        send({ type: "error", message: describeError(err) });
      } finally {
        try {
          await logRun(input.group, startedAt, events);
        } catch (err) {
          console.error("logRun failed", err);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

async function runAgent(provider: "anthropic" | "openai", input: AgentInput, send: (e: AgentEvent) => void) {
  const { runLoop, extract } = await loadProvider(provider);
  const state = new AgentState(input, extract);
  const failedTools = new Set<string>();

  const userMessage = [
    `Группа: ${input.group}.`,
    input.image ? "Загружено фото расписания, инструмент extract_schedule его видит." : "",
    input.text ? `Текст из чата (${input.text.length} символов), инструмент extract_schedule его видит.` : "",
    "Выполни задачу до конца.",
  ].filter(Boolean).join(" ");

  const finished = await runLoop({
    system: AGENT_SYSTEM_PROMPT,
    userMessage,
    tools: TOOL_DEFS,
    maxSteps: MAX_STEPS,
    onText: (text) => send({ type: "plan", text }),
    onToolCall: async (name, args) => {
      send({ type: "tool_call", tool: name, input: args });
      const outcome = await state.run(name, args);
      send({ type: "tool_result", tool: name, ok: outcome.ok, summary: outcome.summary });
      if (!outcome.ok) {
        failedTools.add(name);
      } else if (failedTools.has(name)) {
        send({ type: "retry", reason: `Повтор ${TOOL_NAMES[name] ?? name} после ошибки: успешно` });
        failedTools.delete(name);
      } else if (failedTools.has("validate_schedule") && (name === "extract_schedule" || name === "fix_schedule")) {
        send({ type: "retry", reason: "Расписание исправлено после проверки, идёт повторная проверка" });
        failedTools.delete("validate_schedule");
      }
      return outcome;
    },
  });

  if (!finished) {
    send({ type: "error", message: `Агент не завершил задачу за ${MAX_STEPS} шагов. Сохранено занятий: ${state.saved}` });
    return;
  }
  if (state.saved === 0) {
    send({ type: "error", message: "Агент завершился, но расписание не сохранено. Проверь исходные данные." });
    return;
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
