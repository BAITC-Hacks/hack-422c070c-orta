import OpenAI from "openai";
import { NextResponse } from "next/server";

let client: OpenAI | null = null;

// Ленивая инициализация — если ключ отсутствует, ошибка ловится здесь
// и возвращается понятным JSON, а не падает при загрузке модуля роута.
export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ timeout: 18000, maxRetries: 1 });
  }
  return client;
}

export function mapOpenAIError(err: unknown) {
  if (err instanceof OpenAI.AuthenticationError) {
    return NextResponse.json({ error: "Неверный OPENAI_API_KEY" }, { status: 500 });
  }
  if (err instanceof OpenAI.RateLimitError) {
    return NextResponse.json({ error: "Лимит запросов, попробуйте через минуту" }, { status: 429 });
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return NextResponse.json({ error: "Модель не ответила вовремя, попробуйте ещё раз" }, { status: 504 });
  }
  // OpenAI SDK бросает обычный Error (не подкласс APIError), если OPENAI_API_KEY не задан вовсе
  if (err instanceof Error && /OPENAI_API_KEY|api key|credentials/i.test(err.message)) {
    return NextResponse.json({ error: "Неверный или отсутствующий OPENAI_API_KEY" }, { status: 500 });
  }
  console.error(err);
  return NextResponse.json({ error: "Ошибка обращения к OpenAI" }, { status: 500 });
}

export async function postJSON<T>(client: OpenAI, model: string, system: string, user: string): Promise<T> {
  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text = response.choices[0]?.message?.content ?? "";
  return JSON.parse(text) as T;
}
