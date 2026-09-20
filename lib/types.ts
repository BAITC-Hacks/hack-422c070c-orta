import { z } from "zod";

export const LessonSchema = z.object({
  day: z.enum(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]),
  start: z.string().describe("Время начала в формате HH:MM"),
  end: z.string().describe("Время конца в формате HH:MM"),
  subject: z.string(),
  teacher: z.string().nullable(),
  room: z.string().nullable(),
  type: z.enum(["лекция", "практика", "лаборатория", "другое"]).nullable(),
});

export const ScheduleSchema = z.object({
  group: z.string().nullable(),
  week_note: z.string().nullable().describe("Пометка о неделе, например 'числитель' или 'с 22 сентября'"),
  lessons: z.array(LessonSchema),
});

export type Lesson = z.infer<typeof LessonSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;

export type AgentInput = {
  group: string;
  text?: string;
  image?: { media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string };
};

export type AgentEvent =
  | { type: "plan"; text: string }
  | { type: "tool_call"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; ok: boolean; summary: string }
  | { type: "retry"; reason: string }
  | { type: "done"; summary: string; schedule: Schedule | null; ics: string | null; saved: number; notified: boolean }
  | { type: "error"; message: string };
