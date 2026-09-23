import { SEED_TASKS, SEED_TEAMS, SEED_RESPONSES } from "../lib/seed";
import { TeamResponse, ResponseStatus } from "../lib/types";

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  OK   " + n)) : (fail++, console.log("  FAIL " + n)); };

// Повторяем ровно ту логику, что в app/page.tsx: submitResponse и decideResponse
function submitResponse(list: TeamResponse[], taskId: string, teamId: string, idea: string, plan: string, deadline: string, link: string) {
  return [...list, { id: `resp-${Date.now()}-${Math.random()}`, taskId, teamId, idea, plan, deadline, link, status: "pending" as ResponseStatus }];
}
function decideResponse(list: TeamResponse[], id: string, status: ResponseStatus) {
  return list.map((r) => (r.id === id ? { ...r, status } : r));
}

console.log("ПУТЬ ОТКЛИКА");
const task = SEED_TASKS[0];
const team = SEED_TEAMS[2];
let responses = [...SEED_RESPONSES];
const before = responses.filter((r) => r.taskId === task.id).length;

responses = submitResponse(responses, task.id, team.id, "Соберём бота на готовом движке", "Неделя на сборку, неделя на тесты", "2 недели", "https://github.com/example/demo");
const mine = responses.filter((r) => r.taskId === task.id);

check("отклик добавился в общий список", responses.length === SEED_RESPONSES.length + 1);
check("отклик виден у своей задачи", mine.length === before + 1);
check("отклик НЕ попал в другие задачи", responses.filter((r) => r.taskId === SEED_TASKS[1].id).length === SEED_RESPONSES.filter((r) => r.taskId === SEED_TASKS[1].id).length);

const created = mine[mine.length - 1];
check("сохранилась идея", created.idea === "Соберём бота на готовом движке");
check("сохранился план", created.plan.length > 0);
check("сохранился срок", created.deadline === "2 недели");
check("сохранилась ссылка", created.link.startsWith("https://"));
check("команда определяется по teamId", SEED_TEAMS.find((t) => t.id === created.teamId)?.name === team.name);
check("новый отклик приходит со статусом pending", created.status === "pending");

console.log("РЕШЕНИЕ БИЗНЕСА");
let after = decideResponse(responses, created.id, "accepted");
check("принятие меняет статус на accepted", after.find((r) => r.id === created.id)?.status === "accepted");
check("остальные отклики не затронуты", after.filter((r) => r.status === "pending").length === responses.filter((r) => r.status === "pending").length - 1);

after = decideResponse(after, created.id, "declined");
check("отклонение меняет статус на declined", after.find((r) => r.id === created.id)?.status === "declined");
after = decideResponse(after, created.id, "pending");
check("возврат на рассмотрение работает", after.find((r) => r.id === created.id)?.status === "pending");

console.log("ЛЕНТА АКТИВНОСТИ");
const feed = [...after].reverse().slice(0, 6);
check("новый отклик показывается первым в ленте", feed[0].id === created.id);
check("в ленте не больше 6 записей", feed.length <= 6);

console.log("\nИТОГ: " + pass + " пройдено, " + fail + " провалено");
process.exit(fail > 0 ? 1 : 0);
