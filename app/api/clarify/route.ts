import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { CLARIFY_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

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
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: CLARIFY_PROMPT,
      messages: [{ role: "user", content: `Черновик: ${draftText}` }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Модель отказалась отвечать на этот запрос" }, { status: 422 });
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    let parsed: ClarifyResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      return NextResponse.json({ error: "Не удалось разобрать ответ модели, попробуйте ещё раз" }, { status: 502 });
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length < 3) {
      return NextResponse.json({ error: "Модель вернула меньше 3 вопросов, попробуйте ещё раз" }, { status: 502 });
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
    return NextResponse.json({ error: "Ошибка генерации вопросов" }, { status: 500 });
  }
}
