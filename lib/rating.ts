import { ReadinessLevel, TaskCard } from "./types";

const MIN_FIELD_LENGTH = 12;
const MIN_FIELD_WORDS = 3;

// Поле считается заполненным, только если это осмысленная фраза:
// не меньше 12 символов И не меньше 3 слов. Так нельзя набить баллы
// случайным набором букв — рейтинг остаётся честным.
function filled(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < MIN_FIELD_LENGTH) return false;
  const words = trimmed.split(/\s+/).filter((w) => w.length > 1);
  return words.length >= MIN_FIELD_WORDS;
}

export interface RatingBreakdownItem {
  category: string;
  points: number;
  max: number;
  filled: boolean;
  hint: string;
}

export interface RatingResult {
  score: number;
  readiness: ReadinessLevel;
  breakdown: RatingBreakdownItem[];
}

export function calculateRating(card: TaskCard): RatingResult {
  const breakdown: RatingBreakdownItem[] = [
    {
      category: "Контекст и потребность",
      max: 20,
      filled: filled(card.context) && filled(card.need),
      points: 0,
      hint: "Опишите, что происходит сейчас и что нужно изменить",
    },
    {
      category: "Данные и материалы",
      max: 20,
      filled: filled(card.data),
      points: 0,
      hint: "Укажите доступные данные, примеры или источники",
    },
    {
      category: "Ожидаемый результат",
      max: 15,
      filled: filled(card.expectedResult),
      points: 0,
      hint: "Опишите конкретный результат работы команды",
    },
    {
      category: "Критерии успеха",
      max: 15,
      filled: filled(card.successCriteria),
      points: 0,
      hint: "Укажите измеримые признаки принятия решения",
    },
    {
      category: "Ограничения",
      max: 10,
      filled: filled(card.constraints),
      points: 0,
      hint: "Укажите сроки, технологии, доступы или иные границы",
    },
    {
      category: "Пользователи",
      max: 10,
      filled: filled(card.users),
      points: 0,
      hint: "Опишите, для кого создаётся решение",
    },
    {
      category: "Связь с бизнесом",
      max: 10,
      filled: filled(card.contact) && filled(card.format),
      points: 0,
      hint: "Укажите контакт, формат консультаций и порядок обратной связи",
    },
  ];

  for (const item of breakdown) {
    item.points = item.filled ? item.max : 0;
  }

  const score = breakdown.reduce((sum, item) => sum + item.points, 0);

  let readiness: ReadinessLevel;
  if (score >= 90) readiness = "приоритетная";
  else if (score >= 70) readiness = "готовая";
  else if (score >= 40) readiness = "рабочая";
  else readiness = "черновик";

  return { score, readiness, breakdown };
}
