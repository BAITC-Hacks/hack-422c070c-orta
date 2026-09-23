import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { CARD_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

interface CardResult {
  title: string;
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
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1536,
      system: CARD_PROMPT,
      messages: [
        {
          role: "user",
          content: `Черновик: ${draftText}\n\nОтветы на вопросы:\n${qaText}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Модель отказалась отвечать на этот запрос" }, { status: 422 });
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    let parsed: CardResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return NextResponse.json({ error: "Не удалось разобрать карточку, попробуйте ещё раз" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Неверный ANTHROPIC_API_KEY" }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Лимит запросов, попробуйте через минуту" }, { status: 429 });
    }
    console.error(err);
    return NextResponse.json({ error: "Ошибка сборки карточки" }, { status: 500 });
  }
}
