"use client";

import { useState } from "react";

interface Question {
  category: string;
  question: string;
}

export default function Home() {
  const [draftText, setDraftText] = useState("");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [missingCategories, setMissingCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setQuestions(null);

    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }

      setQuestions(data.questions);
      setMissingCategories(data.missing_categories ?? []);
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">AI Sana Challenge Hub</h1>
      <p className="text-sm opacity-70 mb-8">
        Шаг 1: опишите бизнес-задачу своими словами — система подскажет, что стоит уточнить.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Например: нужно автоматизировать проверку заявок клиентов..."
          rows={6}
          className="border rounded-lg p-3 bg-transparent"
        />
        <button
          type="submit"
          disabled={loading || draftText.trim().length < 5}
          className="self-start rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Анализирую..." : "Проанализировать черновик"}
        </button>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {questions && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Уточняющие вопросы</h2>
          {missingCategories.length > 0 && (
            <p className="text-sm opacity-70 mb-3">
              Слабо раскрыто: {missingCategories.join(", ")}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <li key={i} className="border rounded-lg p-3">
                <span className="text-xs uppercase opacity-60">{q.category}</span>
                <p>{q.question}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
