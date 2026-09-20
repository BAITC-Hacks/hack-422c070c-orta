# Староста-агент. Правила проекта

Задача хакатона в `TASK.md`. План в `PLAN.md`. Читать оба перед работой.

## Стек
- Next.js 16 App Router, React 19, TypeScript, Tailwind 4
- Claude API через `@anthropic-ai/sdk`, модель `claude-opus-5` для агента, `claude-sonnet-5` для подзадач
- Supabase (таблицы `schedules`, `lessons`, `agent_runs`), Telegram Bot API, .ics календарь
- Деплой Vercel

## Структура
- `app/page.tsx` экран: загрузка фото или текста, запуск агента, лог шагов, результат
- `app/api/agent/route.ts` агентный цикл: план → инструменты → проверка → повтор
- `lib/tools/*.ts` инструменты агента, по одному файлу на инструмент
- `lib/prompt.ts` системный промпт агента
- `lib/supabase.ts`, `lib/telegram.ts` клиенты внешних систем

## Правила
- Один сценарий до конца важнее пяти половинчатых.
- Ключи только в `.env.local`, список в `.env.example`. Никогда не коммитить секреты.
- Если внешняя система не настроена (нет ключа), инструмент работает в режиме заглушки и явно пишет об этом в лог, демо не должно падать.
- После каждого значимого шага: `npm run build` должен проходить.
- Коммиты короткие, на русском или английском, по смыслу.
- Не трогать `app/page.tsx` стили, если задача про логику; не трогать `lib/` и `app/api/`, если задача про дизайн.
- README держать актуальным: раздел «что написано до хакатона» обязателен.

## Что написано до хакатона
Каркас Next.js с одной формой и одним вызовом Claude (`hackathon-template`). Всё агентное, инструменты, интеграции и UI агента пишутся на хакатоне.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
