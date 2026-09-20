import OpenAI from "openai";
import { EXTRACT_SYSTEM_PROMPT } from "@/lib/prompt";
import { ScheduleSchema, type AgentInput, type Schedule } from "@/lib/types";
import type { LoopParams, ToolDef } from "./index";

const AGENT_MODEL = process.env.OPENAI_MODEL || "gpt-5";
const EXTRACT_MODEL = process.env.OPENAI_EXTRACT_MODEL || "gpt-5-mini";

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI();
  return client;
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function toOpenAITools(tools: ToolDef[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export async function runLoop(p: LoopParams): Promise<boolean> {
  const c = getClient();
  const tools = toOpenAITools(p.tools);
  const messages: ChatMessage[] = [
    { role: "system", content: p.system },
    { role: "user", content: p.userMessage },
  ];

  for (let step = 0; step < p.maxSteps; step++) {
    const completion = await c.chat.completions.create({
      model: AGENT_MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });
    const msg = completion.choices[0]?.message;
    if (!msg) throw new Error("Пустой ответ модели");

    if (msg.content?.trim()) p.onText(msg.content.trim());
    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) return true;

    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
    for (const call of calls) {
      if (call.type !== "function") continue;
      let args: unknown = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      const outcome = await p.onToolCall(call.function.name, args);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: outcome.ok ? outcome.result : `ОШИБКА: ${outcome.result}`,
      });
    }
  }
  return false;
}

// JSON Schema расписания для strict structured output OpenAI (все поля обязательны, null через union)
const SCHEDULE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["group", "week_note", "lessons"],
  properties: {
    group: { type: ["string", "null"] },
    week_note: { type: ["string", "null"], description: "Пометка о неделе, например 'числитель' или 'с 22 сентября'" },
    lessons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "start", "end", "subject", "teacher", "room", "type"],
        properties: {
          day: { type: "string", enum: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] },
          start: { type: "string", description: "HH:MM" },
          end: { type: "string", description: "HH:MM" },
          subject: { type: "string" },
          teacher: { type: ["string", "null"] },
          room: { type: ["string", "null"] },
          type: { type: ["string", "null"], enum: ["лекция", "практика", "лаборатория", "другое", null] },
        },
      },
    },
  },
};

export async function extract(input: AgentInput, instructions?: string): Promise<Schedule | null> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
  if (input.image) {
    content.push({ type: "image_url", image_url: { url: `data:${input.image.media_type};base64,${input.image.data}` } });
  }
  const parts = [`Группа: ${input.group}`];
  if (input.text) parts.push(`Текст из чата:\n${input.text}`);
  if (instructions) parts.push(`Указания для этой попытки: ${instructions}`);
  content.push({ type: "text", text: parts.join("\n\n") });

  const completion = await getClient().chat.completions.create({
    model: EXTRACT_MODEL,
    messages: [
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      { role: "user", content },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "schedule", strict: true, schema: SCHEDULE_JSON_SCHEMA },
    },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = ScheduleSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
