// Проверка инструментов без вызова Claude API: npx tsx scripts/test-tools.ts
import { buildIcs } from "../lib/ics";
import { AgentState } from "../lib/tools";
import type { Lesson } from "../lib/types";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!cond) failed++;
}

const good: Lesson[] = [
  { day: "Пн", start: "08:00", end: "09:20", subject: "Математика", teacher: "Иванова", room: "201", type: "лекция" },
  { day: "Пн", start: "09:30", end: "10:50", subject: "Физика", teacher: null, room: "105", type: null },
  { day: "Вт", start: "11:00", end: "12:20", subject: "История", teacher: null, room: null, type: null },
];
const conflicting: Lesson[] = [
  ...good,
  { day: "Пн", start: "09:00", end: "10:00", subject: "Английский", teacher: null, room: null, type: null },
  { day: "Ср", start: "25:00", end: "10:00", subject: "Ошибка времени", teacher: null, room: null, type: null },
];

async function main() {
  // Экстрактор-заглушка: extract не вызываем, остальное работает
  const state = new AgentState({ group: "ИС-21", text: "тест" }, async () => null);

  const noSchedule = await state.run("validate_schedule", {});
  check("validate без расписания возвращает ошибку", !noSchedule.ok);

  const fixBad = await state.run("fix_schedule", { lessons: conflicting });
  check("fix_schedule принимает список", fixBad.ok, fixBad.summary);

  const v1 = await state.run("validate_schedule", {});
  check("validate находит пересечение и неверное время", !v1.ok && v1.result.includes("Пересечение") && v1.result.includes("формат времени"), v1.summary);

  const fixGood = await state.run("fix_schedule", { lessons: good });
  check("fix_schedule исправляет", fixGood.ok);

  const v2 = await state.run("validate_schedule", {});
  check("validate проходит на чистом расписании", v2.ok, v2.summary);

  const save = await state.run("save_schedule", {});
  check("save_schedule сохраняет (заглушка или Supabase)", save.ok, save.summary);

  const verify = await state.run("verify_saved", {});
  check("verify_saved сверяет количество", verify.ok, verify.summary);

  const cal = await state.run("create_calendar", {});
  check("create_calendar создаёт .ics", cal.ok && (state.ics?.includes("BEGIN:VEVENT") ?? false), cal.summary);

  const ics = buildIcs("ИС-21", good);
  check("ics содержит 3 события", (ics.match(/BEGIN:VEVENT/g) ?? []).length === 3);
  check("ics содержит RRULE по понедельникам", ics.includes("BYDAY=MO"));

  const notify = await state.run("notify_group", { message: "<b>ИС-21</b>: расписание обновлено, 3 занятия" });
  check("notify_group отправляет или пишет заглушку", notify.ok, notify.summary);

  const empty = await state.run("notify_group", { message: "" });
  check("notify_group отклоняет пустое сообщение", !empty.ok);

  console.log(failed ? `\nПровалено: ${failed}` : "\nВсе проверки пройдены");
  process.exit(failed ? 1 : 0);
}

main();
