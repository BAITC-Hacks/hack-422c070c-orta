"use client";

import { useState } from "react";
import { calculateRating, RatingResult } from "@/lib/rating";
import { ReadinessLevel, Task, TaskCard, Team, TeamResponse } from "@/lib/types";
import { SEED_DRAFTS, SEED_TASKS, SEED_TEAMS, SEED_RESPONSES } from "@/lib/seed";

interface Question {
  category: string;
  question: string;
}

interface Answer extends Question {
  answer: string;
}

function readinessBadgeClass(level: ReadinessLevel): string {
  switch (level) {
    case "приоритетная":
      return "bg-accent text-accent-foreground";
    case "готовая":
      return "border border-accent text-accent";
    case "рабочая":
      return "border border-border-subtle text-foreground";
    default:
      return "border border-border-subtle text-muted";
  }
}

type Step = "draft" | "questions" | "card" | "published";
type Role = "business" | "team" | null;

export default function Home() {
  const [role, setRole] = useState<Role>(null);

  const [step, setStep] = useState<Step>("draft");
  const [draftText, setDraftText] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [missingCategories, setMissingCategories] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [card, setCard] = useState<TaskCard | null>(null);
  const [rating, setRating] = useState<RatingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<Task[]>(() => [...SEED_TASKS].sort((a, b) => b.rating - a.rating));
  const [responses, setResponses] = useState<TeamResponse[]>(SEED_RESPONSES);
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [filterReadiness, setFilterReadiness] = useState<ReadinessLevel | "all">("all");

  const topics = Array.from(new Set(catalog.map((t) => t.card.topic).filter(Boolean)));
  const readinessLevels: ReadinessLevel[] = ["черновик", "рабочая", "готовая", "приоритетная"];
  const filteredCatalog = catalog.filter(
    (t) =>
      (filterTopic === "all" || t.card.topic === filterTopic) &&
      (filterReadiness === "all" || t.readiness === filterReadiness)
  );

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
        topic: data.topic ?? "",
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

  function switchRole() {
    setRole(null);
    resetFlow();
    setFilterTopic("all");
    setFilterReadiness("all");
  }

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 md:px-10 py-12">
      <h1 className="text-3xl font-bold mb-2 tracking-tight">
        AI Sana <span className="text-accent">Challenge Hub</span>
      </h1>
      <p className="text-sm text-muted mb-6">От бизнес-задачи к решению — HackAlem AI, трек «Образование»</p>

      {role && (
        <div className="flex items-center gap-3 mb-10 text-sm">
          <span className="border border-accent text-accent rounded-full px-3 py-1">
            Роль: {role === "business" ? "Представитель бизнеса" : "Студенческая команда"}
          </span>
          <button onClick={switchRole} className="text-muted hover:text-accent transition underline underline-offset-2">
            Сменить роль
          </button>
        </div>
      )}

      {!role && (
        <div className="flex flex-col gap-4">
          <p className="text-muted mb-2">Выберите, кто вы — без логина, просто для демонстрации сценария.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setRole("business")}
              className="flex-1 text-left border border-border-subtle bg-surface rounded-2xl p-6 hover:border-accent transition"
            >
              <p className="text-lg font-semibold mb-1">Я представитель бизнеса</p>
              <p className="text-sm text-muted">Опишу задачу, дополню карточку, посмотрю рейтинг и выберу команду из откликов</p>
            </button>
            <button
              onClick={() => setRole("team")}
              className="flex-1 text-left border border-border-subtle bg-surface rounded-2xl p-6 hover:border-accent transition"
            >
              <p className="text-lg font-semibold mb-1">Я студенческая команда</p>
              <p className="text-sm text-muted">Посмотрю каталог задач и откликнусь на подходящую</p>
            </button>
          </div>
        </div>
      )}

      {role === "business" && (
        <>
          {step === "draft" && (
            <form onSubmit={handleDraftSubmit} className="flex flex-col gap-4 max-w-2xl">
              <label className="font-semibold">Шаг 1. Опишите бизнес-задачу</label>
              <div className="flex flex-wrap gap-2">
                {SEED_DRAFTS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDraftText(d)}
                    className="text-xs border border-border-subtle rounded-full px-3 py-1.5 text-muted hover:border-accent hover:text-accent transition"
                  >
                    Пример {i + 1}
                  </button>
                ))}
              </div>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Например: нужно автоматизировать проверку заявок клиентов..."
                rows={6}
                className="border border-border-subtle bg-surface rounded-xl p-4 placeholder:text-muted focus:outline-none focus:border-accent transition"
              />
              <button
                type="submit"
                disabled={loading || draftText.trim().length < 5}
                className="self-start rounded-full bg-accent text-accent-foreground font-semibold px-6 py-2.5 disabled:opacity-40 hover:brightness-110 transition"
              >
                {loading ? "Анализирую..." : "Проанализировать черновик"}
              </button>
            </form>
          )}

          {step === "questions" && (
            <form onSubmit={handleAnswersSubmit} className="flex flex-col gap-4 max-w-2xl">
              <label className="font-semibold">Шаг 2. Ответьте на уточняющие вопросы</label>
              {missingCategories.length > 0 && (
                <p className="text-sm text-muted">Слабо раскрыто: {missingCategories.join(", ")}</p>
              )}
              {answers.map((a, i) => (
                <div key={i} className="border border-border-subtle bg-surface rounded-xl p-4">
                  <span className="text-xs uppercase tracking-wide text-accent">{a.category}</span>
                  <p className="mb-2 mt-1">{a.question}</p>
                  <input
                    value={a.answer}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = { ...next[i], answer: e.target.value };
                      setAnswers(next);
                    }}
                    className="border border-border-subtle bg-background rounded-lg p-2 w-full focus:outline-none focus:border-accent transition"
                    placeholder="Ваш ответ"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="self-start rounded-full bg-accent text-accent-foreground font-semibold px-6 py-2.5 disabled:opacity-40 hover:brightness-110 transition"
              >
                {loading ? "Собираю карточку..." : "Собрать карточку"}
              </button>
            </form>
          )}

          {step === "card" && card && rating && (
            <div className="flex flex-col gap-6 max-w-2xl">
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <label className="font-semibold">Шаг 3. Проверьте и отредактируйте карточку</label>
                  <div className="shrink-0 flex items-center gap-2 border border-accent/60 bg-surface rounded-full pl-2 pr-3 py-1.5">
                    <span className="w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs">
                      ✦
                    </span>
                    <span className="text-xs text-muted leading-tight">
                      ИИ-помощник
                      <br />
                      заполнил по вашим ответам
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-3">
                  {(
                    [
                      ["title", "Название"],
                      ["topic", "Тема"],
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
                      <label className="text-xs uppercase tracking-wide text-muted">{label}</label>
                      <textarea
                        value={card[field]}
                        onChange={(e) => updateCardField(field, e.target.value)}
                        rows={2}
                        className="border border-border-subtle bg-surface rounded-lg p-2 w-full focus:outline-none focus:border-accent transition"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border-subtle bg-surface rounded-2xl p-5">
                <p className="font-semibold mb-3 text-lg">
                  Рейтинг: <span className="text-accent">{rating.score} / 100</span> — {rating.readiness}
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {rating.breakdown.map((b) => (
                    <li key={b.category} className={b.filled ? "text-foreground" : "text-muted"}>
                      <span className={b.filled ? "text-accent" : ""}>{b.filled ? "●" : "○"}</span> {b.category}: {b.points}/{b.max}
                      {!b.filled && <span> — {b.hint}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={publishTask}
                className="self-start rounded-full bg-accent text-accent-foreground font-semibold px-6 py-2.5 hover:brightness-110 transition"
              >
                Подтвердить и опубликовать в каталог
              </button>
            </div>
          )}

          {step === "published" && (
            <div className="flex flex-col gap-6">
              <p className="text-accent font-semibold">Задача опубликована в каталоге.</p>
              <button
                onClick={resetFlow}
                className="self-start rounded-full border border-border-subtle px-6 py-2.5 hover:border-accent hover:text-accent transition"
              >
                Добавить ещё одну задачу
              </button>
            </div>
          )}

          {error && <p className="mt-4 text-red-400">{error}</p>}

          <section className="mt-16">
            <h2 className="text-xl font-bold mb-4">Мои задачи и отклики</h2>
            {catalog.length === 0 && <p className="text-muted text-sm">Пока нет опубликованных задач.</p>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {catalog.map((task) => (
                <div key={task.id} className="border border-border-subtle bg-surface rounded-2xl p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{task.card.title || "(без названия)"}</h3>
                      {task.card.topic && (
                        <span className="inline-block mt-1 text-xs border border-border-subtle rounded-full px-2 py-0.5 text-muted">
                          {task.card.topic}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-accent font-semibold whitespace-nowrap">
                      {task.rating}/100 — {task.readiness}
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-2">{task.card.context}</p>

                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-muted mb-2">Отклики команд</p>
                    {responses.filter((r) => r.taskId === task.id).length === 0 && (
                      <p className="text-sm text-muted">Пока никто не откликнулся.</p>
                    )}
                    {responses
                      .filter((r) => r.taskId === task.id)
                      .map((r) => {
                        const team = SEED_TEAMS.find((t) => t.id === r.teamId);
                        const statusColor =
                          r.status === "accepted" ? "text-accent" : r.status === "declined" ? "text-red-400" : "text-muted";
                        return (
                          <div key={r.id} className="border border-border-subtle bg-background rounded-xl p-3 mb-2 text-sm">
                            <p>
                              <strong>{team?.name}</strong>: {r.idea}
                            </p>
                            <p className="text-muted">{r.plan}</p>
                            <p className={`mt-1 ${statusColor}`}>
                              Статус: <strong>{r.status}</strong>
                            </p>
                            {r.status === "pending" && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => decideResponse(r.id, "accepted")}
                                  className="text-xs rounded-full border border-border-subtle px-3 py-1 hover:border-accent hover:text-accent transition"
                                >
                                  Выбрать команду
                                </button>
                                <button
                                  onClick={() => decideResponse(r.id, "declined")}
                                  className="text-xs rounded-full border border-border-subtle px-3 py-1 hover:border-red-400 hover:text-red-400 transition"
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
        </>
      )}

      {role === "team" && (
        <section>
          <h2 className="text-xl font-bold mb-4">Каталог задач</h2>

          <div className="flex gap-3 mb-6 flex-wrap items-center text-sm">
            <label className="text-muted">Тема:</label>
            <select
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              className="border border-border-subtle bg-surface rounded-full px-3 py-1.5 focus:outline-none focus:border-accent"
            >
              <option value="all">Все темы</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <label className="text-muted">Готовность:</label>
            <select
              value={filterReadiness}
              onChange={(e) => setFilterReadiness(e.target.value as ReadinessLevel | "all")}
              className="border border-border-subtle bg-surface rounded-full px-3 py-1.5 focus:outline-none focus:border-accent"
            >
              <option value="all">Все уровни</option>
              {readinessLevels.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {filteredCatalog.length === 0 && (
            <p className="text-muted text-sm">
              {catalog.length === 0 ? "Пока нет опубликованных задач — переключись на роль бизнеса и опубликуй одну." : "Ничего не найдено по фильтрам."}
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredCatalog.map((task) => (
              <div
                key={task.id}
                className="border border-border-subtle bg-surface rounded-2xl p-5 hover:border-accent/60 transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{task.card.title || "(без названия)"}</h3>
                    {task.card.topic && (
                      <span className="inline-block mt-1.5 text-xs border border-border-subtle rounded-full px-2 py-0.5 text-muted">
                        {task.card.topic}
                      </span>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${readinessBadgeClass(task.readiness)}`}>
                    {task.readiness}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${task.rating}%` }} />
                  </div>
                  <p className="text-xs text-muted mt-1">Рейтинг {task.rating}/100</p>
                </div>

                <p className="text-sm text-muted mt-3 line-clamp-2">{task.card.context}</p>

                {task.card.expectedResult && (
                  <p className="text-sm mt-2">
                    <span className="text-muted">Результат: </span>
                    {task.card.expectedResult}
                  </p>
                )}
                {task.card.users && (
                  <p className="text-sm mt-1">
                    <span className="text-muted">Для кого: </span>
                    {task.card.users}
                  </p>
                )}

                <TeamResponseForm taskId={task.id} teams={SEED_TEAMS} onSubmit={submitResponse} />

                <p className="text-xs text-muted mt-3">
                  Отправлено откликов на эту задачу: {responses.filter((r) => r.taskId === task.id).length}
                </p>
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
  const [sent, setSent] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!idea.trim()) return;
        onSubmit(taskId, teamId, idea, plan, link);
        setIdea("");
        setPlan("");
        setLink("");
        setSent(true);
      }}
      className="flex flex-col gap-2 mt-4 border-t border-border-subtle pt-4"
    >
      <p className="text-xs uppercase tracking-wide text-muted">Откликнуться командой</p>
      <select
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        className="border border-border-subtle bg-background rounded-lg p-2 text-sm focus:outline-none focus:border-accent"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="Идея решения"
        className="border border-border-subtle bg-background rounded-lg p-2 text-sm focus:outline-none focus:border-accent"
      />
      <input
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        placeholder="Краткий план"
        className="border border-border-subtle bg-background rounded-lg p-2 text-sm focus:outline-none focus:border-accent"
      />
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Ссылка на прототип"
        className="border border-border-subtle bg-background rounded-lg p-2 text-sm focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="self-start text-xs rounded-full bg-accent text-accent-foreground font-semibold px-4 py-1.5 hover:brightness-110 transition"
      >
        Отправить отклик
      </button>
      {sent && <p className="text-xs text-accent">Отклик отправлен.</p>}
    </form>
  );
}
