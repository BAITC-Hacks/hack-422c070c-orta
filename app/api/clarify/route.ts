import OpenAI from "openai";
import { NextResponse } from "next/server";
import { CLARIFY_PROMPT } from "@/lib/prompts";

const client = new OpenAI({ timeout: 18000, maxRetries: 1 });

interface ClarifyResult {
  missing_categories: string[];
  questions: { category: string; question: string }[];
}

export async function POST(req: Request) {
  const { draftText } = await req.json();

  if (!draftText || typeof draftText !== "string" || draftText.trim().length < 5) {
    return NextResponse.json({ error: "Опишите черновик задачи (минимум несколько слов)" }, { status: 400 });
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CLARIFY_PROMPT },
        { role: "user", content: `Черновик: ${draftText}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

    let parsed: ClarifyResult;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Не удалось разобрать ответ модели, попробуйте ещё раз" }, { status: 502 });
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length < 3) {
      return NextResponse.json({ error: "Модель вернула меньше 3 вопросов, попробуйте ещё раз" }, { status: 502 });
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
    return NextResponse.json({ error: "Ошибка генерации вопросов" }, { status: 500 });
  }
}
