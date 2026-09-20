import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { EXTRACT_SYSTEM_PROMPT } from "@/lib/prompt";
import { ScheduleSchema, type AgentInput, type Schedule } from "@/lib/types";
import type { LoopParams, ToolDef } from "./index";

const AGENT_MODEL = "claude-opus-5";
const EXTRACT_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

function toAnthropicTools(tools: ToolDef[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }));
}

export async function runLoop(p: LoopParams): Promise<boolean> {
  const c = getClient();
  const tools = toAnthropicTools(p.tools);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: p.userMessage }];

  for (let step = 0; step < p.maxSteps; step++) {
    const response = await c.messages.create({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: p.system,
      tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) p.onText(block.text.trim());
    }
    if (response.stop_reason === "refusal") throw new Error("Модель отказалась выполнять запрос");
    if (response.stop_reason !== "tool_use") return true;

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const outcome = await p.onToolCall(block.name, block.input);
      results.push({ type: "tool_result", tool_use_id: block.id, content: outcome.result, is_error: !outcome.ok });
    }
    messages.push({ role: "user", content: results });
  }
  return false;
}

export async function extract(input: AgentInput, instructions?: string): Promise<Schedule | null> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (input.image) {
    content.push({ type: "image", source: { type: "base64", media_type: input.image.media_type, data: input.image.data } });
  }
  const parts = [`Группа: ${input.group}`];
  if (input.text) parts.push(`Текст из чата:\n${input.text}`);
  if (instructions) parts.push(`Указания для этой попытки: ${instructions}`);
  content.push({ type: "text", text: parts.join("\n\n") });

  const response = await getClient().messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 8000,
    system: EXTRACT_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(ScheduleSchema) },
  });
  return response.parsed_output ?? null;
}
