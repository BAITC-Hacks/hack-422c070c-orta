import type { Extractor, ToolDef, ToolOutcome } from "@/lib/llm";
import { getSupabase } from "@/lib/supabase";
import { sendTelegram } from "@/lib/telegram";
import { buildIcs } from "@/lib/ics";
import { ScheduleSchema, type AgentInput, type Lesson, type Schedule } from "@/lib/types";
export type { ToolOutcome };

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "extract_schedule",
    description: "Распознаёт расписание из загруженного фото или текста и возвращает структурированный список занятий.",
    parameters: {
      type: "object",
      properties: {
        instructions: {
          type: "string",
          description: "Дополнительные указания для повторной попытки, например какие ошибки исправить",
        },
      },
    },
  },
  {
    name: "validate_schedule",
    description: "Проверяет текущее расписание: пересечения по времени, пустые поля, формат времени. Возвращает список проблем.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "fix_schedule",
    description: "Заменяет текущее расписание исправленной версией. Используй, когда проблемы очевидны и их можно поправить без повторного распознавания.",
    parameters: {
      type: "object",
      properties: {
        lessons: {
          type: "array",
          description: "Полный исправленный список занятий",
          items: {
            type: "object",
            properties: {
              day: { type: "string", enum: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] },
              start: { type: "string" },
              end: { type: "string" },
              subject: { type: "string" },
              teacher: { type: ["string", "null"] },
              room: { type: ["string", "null"] },
              type: { type: ["string", "null"], enum: ["лекция", "практика", "лаборатория", "другое", null] },
            },
            required: ["day", "start", "end", "subject", "teacher", "room", "type"],
          },
        },
      },
      required: ["lessons"],
    },
  },
  {
    name: "save_schedule",
    description: "Сохраняет проверенное расписание в базу данных Supabase для указанной группы. Старые занятия группы заменяются.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "verify_saved",
    description: "Читает расписание группы из базы и сверяет количество занятий с текущим.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "create_calendar",
    description: "Создаёт файл календаря .ics с повторяющимися событиями на семестр.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "notify_group",
    description: "Отправляет сообщение в Telegram-группу студентов.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Текст сообщения для студентов на русском, можно с HTML-тегами <b> и <i>" },
      },
      required: ["message"],
    },
  },
];

export class AgentState {
  schedule: Schedule | null = null;
  ics: string | null = null;
  saved = 0;
  notified = false;
  private memoryStore: Lesson[] = [];

  constructor(private input: AgentInput, private extractor: Extractor) {}

  async run(name: string, rawInput: unknown): Promise<ToolOutcome> {
    const input = (rawInput ?? {}) as Record<string, unknown>;
    switch (name) {
      case "extract_schedule":
        return this.extract(typeof input.instructions === "string" ? input.instructions : undefined);
      case "validate_schedule":
        return this.validate();
      case "fix_schedule":
        return this.fix(input.lessons);
      case "save_schedule":
        return this.save();
      case "verify_saved":
        return this.verify();
      case "create_calendar":
        return this.calendar();
      case "notify_group":
        return this.notify(String(input.message ?? ""));
      default:
        return { ok: false, result: `Неизвестный инструмент ${name}`, summary: "неизвестный инструмент" };
    }
  }

  private async extract(instructions?: string): Promise<ToolOutcome> {
    const parsed = await this.extractor(this.input, instructions);
    if (!parsed) return { ok: false, result: "Не удалось распознать расписание", summary: "распознавание не удалось" };
    this.schedule = parsed;
    return {
      ok: true,
      result: JSON.stringify(parsed, null, 2),
      summary: `распознано ${parsed.lessons.length} занятий`,
    };
  }

  private validate(): ToolOutcome {
    if (!this.schedule) return { ok: false, result: "Расписание ещё не извлечено", summary: "нет расписания" };
    const problems: string[] = [];
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const lessons = this.schedule.lessons;

    if (lessons.length === 0) problems.push("Список занятий пуст");
    lessons.forEach((l, i) => {
      if (!time.test(l.start) || !time.test(l.end)) problems.push(`Занятие ${i + 1} (${l.subject}): неверный формат времени ${l.start}–${l.end}`);
      else if (toMin(l.end) <= toMin(l.start)) problems.push(`Занятие ${i + 1} (${l.subject}): конец раньше начала`);
      if (!l.subject.trim()) problems.push(`Занятие ${i + 1}: пустое название предмета`);
    });
    for (let i = 0; i < lessons.length; i++) {
      for (let j = i + 1; j < lessons.length; j++) {
        const a = lessons[i], b = lessons[j];
        if (a.day !== b.day || !time.test(a.start) || !time.test(b.start) || !time.test(a.end) || !time.test(b.end)) continue;
        if (toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)) {
          problems.push(`Пересечение в ${a.day}: «${a.subject}» ${a.start}–${a.end} и «${b.subject}» ${b.start}–${b.end}`);
        }
      }
    }
    if (problems.length) {
      return { ok: false, result: `Найдено проблем: ${problems.length}\n- ${problems.join("\n- ")}`, summary: `${problems.length} проблем` };
    }
    return { ok: true, result: `Проверка пройдена: ${lessons.length} занятий, конфликтов нет`, summary: "конфликтов нет" };
  }

  private fix(lessons: unknown): ToolOutcome {
    const parsed = ScheduleSchema.shape.lessons.safeParse(lessons);
    if (!parsed.success) return { ok: false, result: `Неверный формат: ${parsed.error.message.slice(0, 300)}`, summary: "неверный формат" };
    this.schedule = { group: this.schedule?.group ?? this.input.group, week_note: this.schedule?.week_note ?? null, lessons: parsed.data };
    return { ok: true, result: `Расписание обновлено: ${parsed.data.length} занятий`, summary: `исправлено, ${parsed.data.length} занятий` };
  }

  private async save(): Promise<ToolOutcome> {
    if (!this.schedule) return { ok: false, result: "Нечего сохранять", summary: "нет расписания" };
    const sb = getSupabase();
    const group = this.input.group;
    const rows = this.schedule.lessons.map((l) => ({ group_name: group, ...l }));

    if (!sb) {
      this.memoryStore = this.schedule.lessons;
      this.saved = rows.length;
      return { ok: true, result: `Supabase не настроен, сохранено в память: ${rows.length} занятий`, summary: `${rows.length} занятий (заглушка, без Supabase)` };
    }

    const old = await sb.from("lessons").select("group_name, day, start, end, subject, teacher, room, type").eq("group_name", group);
    if (old.error) return { ok: false, result: `Ошибка чтения старых записей: ${old.error.message}`, summary: "ошибка базы" };
    const del = await sb.from("lessons").delete().eq("group_name", group);
    if (del.error) return { ok: false, result: `Ошибка очистки: ${del.error.message}`, summary: "ошибка базы" };
    const ins = await sb.from("lessons").insert(rows);
    if (ins.error) {
      if (old.data?.length) await sb.from("lessons").insert(old.data);
      return { ok: false, result: `Ошибка записи: ${ins.error.message}. Старое расписание восстановлено`, summary: "ошибка базы, откат" };
    }
    await sb.from("schedules").upsert({ group_name: group, week_note: this.schedule.week_note, lessons_count: rows.length, updated_at: new Date().toISOString() }, { onConflict: "group_name" });
    this.saved = rows.length;
    return { ok: true, result: `Записано в Supabase: ${rows.length} занятий для группы ${group}`, summary: `${rows.length} занятий в Supabase` };
  }

  private async verify(): Promise<ToolOutcome> {
    const expected = this.schedule?.lessons.length ?? 0;
    const sb = getSupabase();
    let actual: number;
    if (!sb) {
      actual = this.memoryStore.length;
    } else {
      const { count, error } = await sb.from("lessons").select("*", { count: "exact", head: true }).eq("group_name", this.input.group);
      if (error) return { ok: false, result: `Ошибка чтения: ${error.message}`, summary: "ошибка базы" };
      actual = count ?? 0;
    }
    if (actual !== expected) return { ok: false, result: `В базе ${actual} занятий, ожидалось ${expected}`, summary: `расхождение ${actual}/${expected}` };
    return { ok: true, result: `Сверка пройдена: в базе ${actual} занятий`, summary: `в базе ${actual}, совпадает` };
  }

  private calendar(): ToolOutcome {
    if (!this.schedule) return { ok: false, result: "Нет расписания", summary: "нет расписания" };
    this.ics = buildIcs(this.input.group, this.schedule.lessons);
    return { ok: true, result: `Календарь создан: ${this.schedule.lessons.length} повторяющихся событий`, summary: `${this.schedule.lessons.length} событий в .ics` };
  }

  private async notify(message: string): Promise<ToolOutcome> {
    if (!message.trim()) return { ok: false, result: "Пустое сообщение", summary: "пустое сообщение" };
    const r = await sendTelegram(message);
    if (!r.ok) return { ok: false, result: r.error ?? "Ошибка Telegram", summary: "ошибка Telegram" };
    this.notified = !r.stub;
    return r.stub
      ? { ok: true, result: "Telegram не настроен, сообщение записано в лог (заглушка)", summary: "заглушка, без Telegram" }
      : { ok: true, result: "Сообщение отправлено в Telegram-группу", summary: "отправлено в Telegram" };
  }
}
