"use client";

import { useRef, useState } from "react";
import type { AgentEvent } from "@/lib/types";

const TOOL_LABELS: Record<string, string> = {
  extract_schedule: "Распознавание расписания",
  validate_schedule: "Проверка конфликтов",
  fix_schedule: "Исправление расписания",
  save_schedule: "Запись в базу",
  verify_saved: "Сверка с базой",
  create_calendar: "Календарь .ics",
  notify_group: "Уведомление группы",
};

const SAMPLE_TEXT = `Расписание ИС-21 с 22 сентября
Пн: 1 пара Математика ауд 201 Иванова А.К.; 2 пара Физика ауд 105 Петров С.Н.; 3 пара Английский ауд 310
Вт: 2 пара История Казахстана ауд 301; 3 пара Программирование лаб 12 Сейткали Д.
Ср: 1 пара Математика ауд 201; 2 пара Физкультура спортзал
Чт: 3 пара Программирование лаб 12; 4 пара Базы данных ауд 214 Сейткали Д.
Пт: 1 пара Английский ауд 310; 2 пара Философия ауд 118`;

export default function Home() {
  const [group, setGroup] = useState("ИС-21");
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ media_type: string; data: string; preview: string } | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const [head, data] = url.split(",");
      const media_type = head.slice(5, head.indexOf(";"));
      setImage({ media_type, data, preview: url });
    };
    reader.readAsDataURL(f);
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setEvents([]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group,
          text: text || undefined,
          image: image ? { media_type: image.media_type, data: image.data } : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setEvents([{ type: "error", message: data.error ?? `Ошибка ${res.status}` }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const ev = JSON.parse(part.slice(6)) as AgentEvent;
          setEvents((prev) => [...prev, ev]);
        }
      }
    } catch (err) {
      setEvents((prev) => [...prev, { type: "error", message: err instanceof Error ? err.message : "Ошибка" }]);
    } finally {
      setRunning(false);
    }
  }

  const done = events.find((e): e is Extract<AgentEvent, { type: "done" }> => e.type === "done");

  function downloadIcs() {
    if (!done?.ics) return;
    const blob = new Blob([done.ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${group}.ics`;
    a.click();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Староста-агент</h1>
        <p className="mt-2 text-gray-600">
          Фото расписания или сообщение из чата → база, календарь и уведомление группы. Без ручной перепечатки.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <form onSubmit={run} className="flex flex-col gap-4">
          <label className="grid gap-1 text-sm font-medium">
            Группа
            <input className="rounded-lg border px-3 py-2 font-normal" value={group} onChange={(e) => setGroup(e.target.value)} />
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Фото расписания
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="text-sm font-normal" />
          </label>
          {image && (
            <div className="relative">
              <img src={image.preview} alt="Расписание" className="max-h-56 rounded-lg border object-contain" />
              <button
                type="button"
                onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-xs"
              >
                Убрать
              </button>
            </div>
          )}

          <label className="grid gap-1 text-sm font-medium">
            Или текст из чата
            <textarea
              className="min-h-32 rounded-lg border px-3 py-2 font-normal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Вставь сообщение старосты из WhatsApp"
            />
          </label>
          <button type="button" onClick={() => setText(SAMPLE_TEXT)} className="self-start text-sm text-blue-600 underline">
            Вставить пример
          </button>

          <button
            type="submit"
            disabled={running || (!text && !image)}
            className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {running ? "Агент работает..." : "Запустить агента"}
          </button>
        </form>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Лог агента</h2>
          {events.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-sm text-gray-500">
              Здесь появятся шаги: план, вызовы инструментов, проверки и повторы.
            </p>
          )}
          <ol className="space-y-2">
            {events.map((ev, i) => (
              <li key={i} className="rounded-lg border bg-white p-3 text-sm">
                {ev.type === "plan" && <p className="whitespace-pre-wrap text-gray-800">{ev.text}</p>}
                {ev.type === "tool_call" && (
                  <p className="text-gray-600">
                    <span className="mr-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs">вызов</span>
                    {TOOL_LABELS[ev.tool] ?? ev.tool}
                  </p>
                )}
                {ev.type === "tool_result" && (
                  <p className={ev.ok ? "text-green-700" : "text-red-700"}>
                    <span className="mr-2">{ev.ok ? "✓" : "✗"}</span>
                    {TOOL_LABELS[ev.tool] ?? ev.tool}: {ev.summary}
                  </p>
                )}
                {ev.type === "retry" && <p className="text-amber-700">↻ {ev.reason}</p>}
                {ev.type === "error" && <p className="text-red-700">Ошибка: {ev.message}</p>}
                {ev.type === "done" && <p className="font-medium text-green-800">{ev.summary}</p>}
              </li>
            ))}
          </ol>

          {done?.schedule && (
            <div className="mt-6 rounded-lg border bg-gray-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Расписание {done.schedule.group ?? group}</h3>
                {done.ics && (
                  <button onClick={downloadIcs} className="rounded border bg-white px-3 py-1 text-sm">
                    Скачать .ics
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1 pr-3">День</th>
                      <th className="py-1 pr-3">Время</th>
                      <th className="py-1 pr-3">Предмет</th>
                      <th className="py-1 pr-3">Ауд.</th>
                      <th className="py-1">Преподаватель</th>
                    </tr>
                  </thead>
                  <tbody>
                    {done.schedule.lessons.map((l, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1 pr-3">{l.day}</td>
                        <td className="py-1 pr-3 whitespace-nowrap">{l.start}–{l.end}</td>
                        <td className="py-1 pr-3">{l.subject}</td>
                        <td className="py-1 pr-3">{l.room ?? "—"}</td>
                        <td className="py-1">{l.teacher ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
