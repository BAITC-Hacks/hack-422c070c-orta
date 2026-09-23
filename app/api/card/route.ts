import OpenAI from "openai";
import { NextResponse } from "next/server";
import { CARD_PROMPT } from "@/lib/prompts";

const client = new OpenAI({ timeout: 18000, maxRetries: 1 });

interface CardResult {
  title: string;
  topic: string;
  context: string;
  need: string;
  users: string;
  data: string;
  constraints: string;
  expected_result: string;
  success_criteria: string;
  contact: string;
  format: string;
  missing_fields: string[];
}

export async function POST(req: Request) {
  const { draftText, answers } = await req.json();

  if (!draftText || typeof draftText !== "string") {
    return NextResponse.json({ error: "Нет текста черновика" }, { status: 400 });
  }
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "Нет ответов на уточняющие вопросы" }, { status: 400 });
  }

  const qaText = answers
    .map((a: { category: string; question: string; answer: string }) => `[${a.category}] ${a.question} -> ${a.answer || "(без ответа)"}`)
    .join("\n");

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CARD_PROMPT },
        { role: "user", content: `Черновик: ${draftText}\n\nОтветы на вопросы:\n${qaText}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

    let parsed: CardResult;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Не удалось разобрать карточку, попробуйте ещё раз" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof OpenAI.AuthenticationError) {
      return NextResponse.json({ error: "Неверный OPENAI_API_KEY" }, { status: 500 });
    }
    if (err instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "Лимит запросов, попробуйте через минуту" }, { status: 429 });
    }
    if (err instanceof OpenAI.APIConnectionTimeoutError) {
      return NextResponse.json({ error: "Модель не ответила вовремя, попробуйте ещё раз" }, { status: 504 });
    }
    console.error(err);
    return NextResponse.json({ error: "Ошибка сборки карточки" }, { status: 500 });
  }
}
