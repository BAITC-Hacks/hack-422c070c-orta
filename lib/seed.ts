// Синтетические тестовые данные (минимальный объём по ТЗ: 5 черновиков, 5 профилей).
// Используются для ручного тестирования сценария и на демонстрации.

export const SEED_DRAFTS: string[] = [
  // Слабый черновик — специально для демо роста рейтинга на защите
  "Нужно автоматизировать проверку заявок клиентов",

  "У нас сеть кофеен в Астане, хотим бота, который отвечает на частые вопросы клиентов в Instagram и WhatsApp: часы работы, меню, адреса. Отвечать должен на русском и казахском.",

  "Есть база из 500 анкет соискателей в Excel, нужно автоматически ранжировать их по соответствию вакансии Python-разработчика. Результат — таблица с баллами и кратким обоснованием. Срок — 2 недели, стек любой веб.",

  "Хотим сервис для учёта расходов на стройматериалы по объектам. Есть данные в 1С (выгрузка CSV). Нужен дашборд для прораба, который видит превышение бюджета в реальном времени. Критерий успеха — прораб видит отклонение больше 10% сразу на главном экране.",

  "Разработать чат-бота для школы",
];

export interface SeedTeamProfile {
  name: string;
  interests: string;
  skills: string;
  tech: string;
}

export const SEED_TEAM_PROFILES: SeedTeamProfile[] = [
  { name: "DataFalcons", interests: "Аналитика данных, дашборды", skills: "Python, SQL, Power BI", tech: "Python, FastAPI" },
  { name: "NeuroKazakh", interests: "NLP на казахском и русском", skills: "ML, NLP", tech: "PyTorch, HuggingFace" },
  { name: "WebSmiths", interests: "Быстрые MVP веб-сервисов", skills: "Frontend/Backend", tech: "Next.js, TypeScript" },
  { name: "AutomateKZ", interests: "Автоматизация бизнес-процессов", skills: "RPA, интеграции", tech: "n8n, Zapier, Python" },
  { name: "EduBridge", interests: "EdTech решения", skills: "Продукт, дизайн, фронтенд", tech: "React, Supabase" },
];
