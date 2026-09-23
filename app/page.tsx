"use client";

import { useState } from "react";
import { calculateRating, RatingResult } from "@/lib/rating";
import { Task, TaskCard, Team, TeamResponse } from "@/lib/types";

interface Question {
  category: string;
  question: string;
}

interface Answer extends Question {
  answer: string;
}

const SEED_TEAMS: Team[] = [
  { id: "t1", name: "DataFalcons", interests: "Аналитика данных, дашборды", skills: "Python, SQL, Power BI", tech: "Python, FastAPI" },
  { id: "t2", name: "NeuroKazakh", interests: "NLP на казахском и русском", skills: "ML, NLP", tech: "PyTorch, HuggingFace" },
  { id: "t3", name: "WebSmiths", interests: "Быстрые MVP веб-сервисов", skills: "Frontend/Backend", tech: "Next.js, TypeScript" },
  { id: "t4", name: "AutomateKZ", interests: "Автоматизация бизнес-процессов", skills: "RPA, интеграции", tech: "n8n, Zapier, Python" },
  { id: "t5", name: "EduBridge", interests: "EdTech решения", skills: "Продукт, дизайн, фронтенд", tech: "React, Supabase" },
];

type Step = "draft" | "questions" | "card" | "published";

export default function Home() {
  const [step, setStep] = useState<Step>("draft");
  const [draftText, setDraftText] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [missingCategories, setMissingCategories] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [card, setCard] = useState<TaskCard | null>(null);
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<Task[]>([]);
  const [responses, setResponses] = useState<TeamResponse[]>([]);

  async function handleDraftSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      setAnswers(data.questions.map((q: Question) => ({ ...q, answer: "" })));
      setStep("questions");
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftText, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      const newCard: TaskCard = {
        title: data.title ?? "",
        context: data.context ?? "",
        need: data.need ?? "",
        users: data.users ?? "",
        data: data.data ?? "",
        constraints: data.constraints ?? "",
        expectedResult: data.expected_result ?? "",
        successCriteria: data.success_criteria ?? "",
        contact: data.contact ?? "",
        format: data.format ?? "",
      };
      setCard(newCard);
      setRating(calculateRating(newCard));
      setStep("card");
    } catch {
      setError("Не удалось связаться с сервером");
    } finally {
      setLoading(false);
    }
  }

  function updateCardField(field: keyof TaskCard, value: string) {
    if (!card) return;
    const next = { ...card, [field]: value };
    setCard(next);
    setRating(calculateRating(next));
  }

  function publishTask() {
    if (!card || !rating) return;
    const task: Task = {
      id: `task-${Date.now()}`,
      draftText,
      card,
      rating: rating.score,
      readiness: rating.readiness,
      createdAt: new Date().toISOString(),
    };
    setCatalog((prev) => [...prev, task].sort((a, b) => b.rating - a.rating));
    setStep("published");
  }

  function submitResponse(taskId: string, teamId: string, idea: string, plan: string, link: string) {
    const response: TeamResponse = {
      id: `resp-${Date.now()}`,
      taskId,
      teamId,
      idea,
      plan,
      deadline: "",
      link,
      status: "pending",
    };
    setResponses((prev) => [...prev, response]);
  }

  function decideResponse(id: string, status: "accepted" | "declined") {
    setResponses((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  function resetFlow() {
    setStep("draft");
    setDraftText("");
    setQuestions([]);
    setAnswers([]);
    setCard(null);
    setRating(null);
    setError(null);
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
      <h1 className="text-2xl font-bold mb-2">AI Sana Challenge Hub</h1>
      <p className="text-sm opacity-70 mb-8">От бизнес-задачи к решению — HackAlem AI, трек «Образование»</p>

      {step === "draft" && (
        <form onSubmit={handleDraftSubmit} className="flex flex-col gap-4">
          <label className="font-semibold">Шаг 1. Опишите бизнес-задачу</label>
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
      )}

      {step === "questions" && (
        <form onSubmit={handleAnswersSubmit} className="flex flex-col gap-4">
          <label className="font-semibold">Шаг 2. Ответьте на уточняющие вопросы</label>
          {missingCategories.length > 0 && (
            <p className="text-sm opacity-70">Слабо раскрыто: {missingCategories.join(", ")}</p>
          )}
          {answers.map((a, i) => (
            <div key={i} className="border rounded-lg p-3">
              <span className="text-xs uppercase opacity-60">{a.category}</span>
              <p className="mb-2">{a.question}</p>
              <input
                value={a.answer}
                onChange={(e) => {
                  const next = [...answers];
                  next[i] = { ...next[i], answer: e.target.value };
                  setAnswers(next);
                }}
                className="border rounded p-2 w-full bg-transparent"
                placeholder="Ваш ответ"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Собираю карточку..." : "Собрать карточку"}
          </button>
        </form>
      )}

      {step === "card" && card && rating && (
        <div className="flex flex-col gap-6">
          <div>
            <label className="font-semibold">Шаг 3. Проверьте и отредактируйте карточку</label>
            <div className="flex flex-col gap-3 mt-3">
              {(
                [
                  ["title", "Название"],
                  ["context", "Контекст"],
                  ["need", "Потребность"],
                  ["users", "Пользователи"],
                  ["data", "Данные и материалы"],
                  ["constraints", "Ограничения"],
                  ["expectedResult", "Ожидаемый результат"],
                  ["successCriteria", "Критерии успеха"],
                  ["contact", "Контакт"],
                  ["format", "Формат взаимодействия"],
                ] as [keyof TaskCard, string][]
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs uppercase opacity-60">{label}</label>
                  <textarea
                    value={card[field]}
                    onChange={(e) => updateCardField(field, e.target.value)}
                    rows={2}
                    className="border rounded p-2 w-full bg-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <p className="font-semibold mb-2">
              Рейтинг: {rating.score} / 100 — {rating.readiness}
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {rating.breakdown.map((b) => (
                <li key={b.category} className={b.filled ? "opacity-100" : "opacity-50"}>
                  {b.filled ? "✅" : "⬜"} {b.category}: {b.points}/{b.max}
                  {!b.filled && <span className="opacity-70"> — {b.hint}</span>}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={publishTask}
            className="self-start rounded-lg bg-black text-white dark:bg-white dark:text-black px-4 py-2"
          >
            Подтвердить и опубликовать в каталог
          </button>
        </div>
      )}

      {step === "published" && (
        <div className="flex flex-col gap-6">
          <p className="text-green-600 font-semibold">Задача опубликована в каталоге.</p>
          <button onClick={resetFlow} className="self-start border rounded-lg px-4 py-2">
            Добавить ещё одну задачу
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {catalog.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-4">Шаг 5–6. Каталог задач и отклики команд</h2>
          <div className="flex flex-col gap-6">
            {catalog.map((task) => (
              <div key={task.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold">{task.card.title || "(без названия)"}</h3>
                  <span className="text-sm opacity-70">
                    {task.rating}/100 — {task.readiness}
                  </span>
                </div>
                <p className="text-sm opacity-70 mt-1">{task.card.context}</p>

                <TeamResponseForm taskId={task.id} teams={SEED_TEAMS} onSubmit={submitResponse} />

                <div className="mt-4">
                  <p className="text-xs uppercase opacity-60 mb-2">Отклики</p>
                  {responses
                    .filter((r) => r.taskId === task.id)
                    .map((r) => {
                      const team = SEED_TEAMS.find((t) => t.id === r.teamId);
                      return (
                        <div key={r.id} className="border rounded p-2 mb-2 text-sm">
                          <p>
                            <strong>{team?.name}</strong>: {r.idea}
                          </p>
                          <p className="opacity-70">{r.plan}</p>
                          <p className="mt-1">
                            Статус: <strong>{r.status}</strong>
                          </p>
                          {r.status === "pending" && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => decideResponse(r.id, "accepted")}
                                className="text-xs border rounded px-2 py-1"
                              >
                                Выбрать команду
                              </button>
                              <button
                                onClick={() => decideResponse(r.id, "declined")}
                                className="text-xs border rounded px-2 py-1"
                              >
                                Отклонить
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function TeamResponseForm({
  taskId,
  teams,
  onSubmit,
}: {
  taskId: string;
  teams: Team[];
  onSubmit: (taskId: string, teamId: string, idea: string, plan: string, link: string) => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [idea, setIdea] = useState("");
  const [plan, setPlan] = useState("");
  const [link, setLink] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!idea.trim()) return;
        onSubmit(taskId, teamId, idea, plan, link);
        setIdea("");
        setPlan("");
        setLink("");
      }}
      className="flex flex-col gap-2 mt-3 border-t pt-3"
    >
      <p className="text-xs uppercase opacity-60">Откликнуться командой</p>
      <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="border rounded p-2 bg-transparent text-sm">
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Идея решения" className="border rounded p-2 bg-transparent text-sm" />
      <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Краткий план" className="border rounded p-2 bg-transparent text-sm" />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ссылка на прототип" className="border rounded p-2 bg-transparent text-sm" />
      <button type="submit" className="self-start text-xs border rounded px-2 py-1">
        Отправить отклик
      </button>
    </form>
  );
}
