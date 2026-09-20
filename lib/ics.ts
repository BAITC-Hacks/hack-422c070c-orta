import type { Lesson } from "./types";

const DAY_INDEX: Record<Lesson["day"], number> = { Пн: 1, Вт: 2, Ср: 3, Чт: 4, Пт: 5, Сб: 6, Вс: 0 };
const DAY_RRULE: Record<Lesson["day"], string> = { Пн: "MO", Вт: "TU", Ср: "WE", Чт: "TH", Пт: "FR", Сб: "SA", Вс: "SU" };

function nextDate(day: Lesson["day"], from = new Date()): Date {
  const d = new Date(from);
  const diff = (DAY_INDEX[day] - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function fmt(d: Date, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(group: string, lessons: Lesson[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Starosta Agent//RU",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(`Расписание ${group}`)}`,
    "X-WR-TIMEZONE:Asia/Almaty",
  ];
  lessons.forEach((l, i) => {
    const date = nextDate(l.day);
    const desc = [l.teacher && `Преподаватель: ${l.teacher}`, l.type && `Тип: ${l.type}`].filter(Boolean).join("\\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${Date.now()}-${i}@starosta-agent`,
      `DTSTAMP:${fmt(new Date(), "00:00")}Z`,
      `DTSTART;TZID=Asia/Almaty:${fmt(date, l.start)}`,
      `DTEND;TZID=Asia/Almaty:${fmt(date, l.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_RRULE[l.day]};COUNT=16`,
      `SUMMARY:${esc(l.subject)}`,
      l.room ? `LOCATION:${esc(l.room)}` : "",
      desc ? `DESCRIPTION:${desc}` : "",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}
