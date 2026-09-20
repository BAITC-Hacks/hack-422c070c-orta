-- Выполнить в Supabase: SQL Editor -> New query -> Run

create table if not exists schedules (
  group_name text primary key,
  week_note text,
  lessons_count int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists lessons (
  id bigserial primary key,
  group_name text not null,
  day text not null,
  start text not null,
  "end" text not null,
  subject text not null,
  teacher text,
  room text,
  type text,
  created_at timestamptz not null default now()
);
create index if not exists lessons_group_idx on lessons (group_name);

create table if not exists agent_runs (
  id bigserial primary key,
  group_name text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  status text not null,
  tool_calls int not null default 0,
  retries int not null default 0,
  log jsonb not null default '[]'::jsonb
);
