import { calculateRating } from "../lib/rating";
import { TaskCard } from "../lib/types";
import { SEED_TASKS, SEED_TEAMS, SEED_RESPONSES, SEED_DRAFTS } from "../lib/seed";

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

const empty = (): TaskCard => ({ title:"", topic:"", context:"", need:"", users:"", data:"", constraints:"", expectedResult:"", successCriteria:"", contact:"", format:"" });

console.log("РЕЙТИНГ: базовые случаи");
check("пустая карточка = 0 баллов, черновик", calculateRating(empty()).score === 0 && calculateRating(empty()).readiness === "черновик");

const full = { ...empty(), context:"Сейчас всё вручную в Excel", need:"Нужно автоматизировать процесс", data:"Выгрузка CSV за год", expectedResult:"Работающий веб сервис", successCriteria:"Время проверки сокращается вдвое", constraints:"Срок две недели, любой стек", users:"Три менеджера отдела продаж", contact:"Почта и телеграм для связи", format:"Созвон раз в неделю" };
check("полностью заполненная = 100, приоритетная", calculateRating(full).score === 100 && calculateRating(full).readiness === "приоритетная");

console.log("РЕЙТИНГ: защита от накрутки");
const junk = { ...empty(), context:"ааааааааааааа", need:"ббббббббббббб", data:"вввввввввввв", expectedResult:"ггггггггггггг", successCriteria:"ддддддддддд", constraints:"еееееееееее", users:"жжжжжжжжжжж", contact:"ззззззззззз", format:"иииииииииии" };
check("длинные слова без пробелов НЕ дают баллов", calculateRating(junk).score === 0);

const shortWords = { ...empty(), context:"а б в г д е", need:"ж з и к л м" };
check("много коротких букв НЕ дают баллов", calculateRating(shortWords).score === 0);

const exactly = { ...empty(), context:"это ровно три слова", need:"и тут три слова" };
check("три осмысленных слова дают 20 баллов", calculateRating(exactly).score === 20);

console.log("РЕЙТИНГ: уровни готовности");

const partial1 = { ...empty(), context:"Сейчас всё вручную в Excel", need:"Нужно автоматизировать процесс" };
check("20 баллов -> черновик", calculateRating(partial1).readiness === "черновик");
const partial2 = { ...partial1, data:"Выгрузка CSV за год" };
check("40 баллов -> рабочая", calculateRating(partial2).score === 40 && calculateRating(partial2).readiness === "рабочая");
const partial3 = { ...partial2, expectedResult:"Работающий веб сервис", successCriteria:"Время сокращается вдвое", users:"Три менеджера отдела" };
check("80 баллов -> готовая", calculateRating(partial3).score === 80 && calculateRating(partial3).readiness === "готовая");

console.log("РЕЙТИНГ: сумма весов = 100");
check("сумма максимумов всех категорий = 100", calculateRating(empty()).breakdown.reduce((s,b)=>s+b.max,0) === 100);
check("категорий ровно 7", calculateRating(empty()).breakdown.length === 7);

console.log("ДАННЫЕ: требования раздела 6 ТЗ");
check("5 черновиков", SEED_DRAFTS.length === 5);
check("5 карточек", SEED_TASKS.length === 5);
check("5 профилей команд", SEED_TEAMS.length === 5);
check("5 откликов", SEED_RESPONSES.length === 5);
check("у всех откликов заполнены идея, план, срок, ссылка", SEED_RESPONSES.every(r => r.idea && r.plan && r.deadline && r.link));
check("все 4 уровня готовности представлены", new Set(SEED_TASKS.map(t=>t.readiness)).size === 4);
check("все отклики ссылаются на существующие задачи", SEED_RESPONSES.every(r => SEED_TASKS.some(t=>t.id===r.taskId)));
check("все отклики ссылаются на существующие команды", SEED_RESPONSES.every(r => SEED_TEAMS.some(t=>t.id===r.teamId)));
check("есть статусы pending/accepted/declined", new Set(SEED_RESPONSES.map(r=>r.status)).size === 3);

console.log("\nИТОГ: " + pass + " пройдено, " + fail + " провалено");
process.exit(fail > 0 ? 1 : 0);
