import { NextResponse } from "next/server";
import { CARD_PROMPT } from "@/lib/prompts";
import { getOpenAIClient, mapOpenAIError } from "@/lib/openai";

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

const STRING_FIELDS: (keyof Omit<CardResult, "missing_fields">)[] = [
  "title",
  "topic",
  "context",
  "need",
  "users",
  "data",
  "constraints",
  "expected_result",
  "success_criteria",
  "contact",
  "format",
];

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
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-5.4-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CARD_PROMPT },
        { role: "user", content: `Черновик: ${draftText}\n\nОтветы на вопросы:\n${qaText}` },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Не удалось разобрать карточку, попробуйте ещё раз" }, { status: 502 });
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Модель вернула карточку в неверном формате, попробуйте ещё раз" }, { status: 502 });
    }

    // Приводим каждое поле к строке — модель иногда возвращает null/число вместо ""
    const parsed = {} as CardResult;
    for (const field of STRING_FIELDS) {
      const value = raw[field];
      parsed[field] = typeof value === "string" ? value : "";
    }
    parsed.missing_fields = Array.isArray(raw.missing_fields)
      ? raw.missing_fields.filter((f): f is string => typeof f === "string")
      : [];

    return NextResponse.json(parsed);
  } catch (err) {
    return mapOpenAIError(err);
  }
}
