import { NextResponse } from "next/server";
import { CLARIFY_PROMPT } from "@/lib/prompts";
import { getOpenAIClient, mapOpenAIError } from "@/lib/openai";

interface ClarifyResult {
  understood: true;
  missing_categories: string[];
  questions: { category: string; question: string }[];
}

interface NotUnderstoodResult {
  understood: false;
  clarification_message: string;
}

export async function POST(req: Request) {
  const { draftText } = await req.json();

  if (!draftText || typeof draftText !== "string" || draftText.trim().length < 5) {
    return NextResponse.json({ error: "Опишите черновик задачи (минимум несколько слов)" }, { status: 400 });
  }

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CLARIFY_PROMPT },
        { role: "user", content: `Черновик: ${draftText}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Не удалось разобрать ответ модели, попробуйте ещё раз" }, { status: 502 });
    }

    if (parsed.understood === false) {
      const message =
        typeof parsed.clarification_message === "string" && parsed.clarification_message.trim()
          ? parsed.clarification_message
          : "Не удалось понять черновик — опишите, пожалуйста, своими словами, какая задача или проблема есть у бизнеса.";
      const result: NotUnderstoodResult = { understood: false, clarification_message: message };
      return NextResponse.json(result);
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length < 3) {
      return NextResponse.json({ error: "Модель вернула меньше 3 вопросов, попробуйте ещё раз" }, { status: 502 });
    }
    const questions = parsed.questions.filter(
      (q): q is { category: string; question: string } =>
        typeof (q as { category?: unknown })?.category === "string" && typeof (q as { question?: unknown })?.question === "string"
    );
    if (questions.length < 3) {
      return NextResponse.json({ error: "Модель вернула вопросы в неверном формате, попробуйте ещё раз" }, { status: 502 });
    }
    const missingCategories = Array.isArray(parsed.missing_categories)
      ? parsed.missing_categories.filter((c): c is string => typeof c === "string")
      : [];

    const result: ClarifyResult = { understood: true, missing_categories: missingCategories, questions };
    return NextResponse.json(result);
  } catch (err) {
    return mapOpenAIError(err);
  }
}
