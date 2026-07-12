-- ============================================================================
-- AI Copilot layer — schema additions
--
-- Adds the tables the AI Financial Reasoning Layer needs:
--   1. calendar_events        — already queried by lib/ai/context/tools/executor.ts
--                                and lib/notifications/engine.ts, but never created.
--                                This migration fixes that gap.
--   2. copilot_conversations  — one row per chat thread (Requirement 9: memory)
--   3. copilot_messages       — turn-by-turn history for a conversation
--   4. copilot_actions        — Action Center: every AI-proposed action lands
--                                here in 'proposed' state and only moves to
--                                'confirmed'/'executed' after explicit user
--                                confirmation (Requirement 8).
--   5. automations            — persisted form of workflows so the Context
--                                Builder's Automation module can reason about
--                                what's already configured, not just in-memory
--                                client state.
--
-- All tables are per-user and protected with row-level security scoped to
-- auth.uid(), matching the rest of the schema.
-- ============================================================================

-- 1. Calendar events ----------------------------------------------------------

create table if not exists public.calendar_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  event_type    text not null check (event_type in ('emi','renewal','tax_deadline','goal_target','bill','custom')),
  event_date    date not null,
  amount        numeric,
  linked_id     uuid,
  linked_type   text,
  is_completed  boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists calendar_events_user_date_idx on public.calendar_events (user_id, event_date);

alter table public.calendar_events enable row level security;

create policy "calendar_events_select_own" on public.calendar_events
  for select using (auth.uid() = user_id);
create policy "calendar_events_insert_own" on public.calendar_events
  for insert with check (auth.uid() = user_id);
create policy "calendar_events_update_own" on public.calendar_events
  for update using (auth.uid() = user_id);
create policy "calendar_events_delete_own" on public.calendar_events
  for delete using (auth.uid() = user_id);

-- 2. Conversation memory -------------------------------------------------------

create table if not exists public.copilot_conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null default 'New conversation',
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists copilot_conversations_user_idx on public.copilot_conversations (user_id, last_message_at desc);

alter table public.copilot_conversations enable row level security;

create policy "copilot_conversations_all_own" on public.copilot_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.copilot_messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.copilot_conversations(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  role                text not null check (role in ('user','assistant')),
  content             text not null,
  tools_used          text[] not null default '{}',
  recommendation_ids  text[] not null default '{}',
  created_at          timestamptz not null default now()
);

create index if not exists copilot_messages_conversation_idx on public.copilot_messages (conversation_id, created_at);

alter table public.copilot_messages enable row level security;

create policy "copilot_messages_all_own" on public.copilot_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Action Center --------------------------------------------------------------

create table if not exists public.copilot_actions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  conversation_id  uuid references public.copilot_conversations(id) on delete set null,
  action_type      text not null check (action_type in (
                     'categorize_transactions','create_reminder','generate_report',
                     'suggest_automation','update_goal','flag_for_review'
                   )),
  title            text not null,
  description      text not null,
  why              text not null,
  sources          text[] not null default '{}',
  confidence       text not null default 'Medium' check (confidence in ('High','Medium','Low')),
  payload          jsonb not null default '{}',
  status           text not null default 'proposed' check (status in ('proposed','confirmed','rejected','executed','failed')),
  result           jsonb,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index if not exists copilot_actions_user_status_idx on public.copilot_actions (user_id, status, created_at desc);

alter table public.copilot_actions enable row level security;

create policy "copilot_actions_all_own" on public.copilot_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Persisted automations -------------------------------------------------------

create table if not exists public.automations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  description           text not null default '',
  category              text not null default 'custom',
  status                text not null default 'draft' check (status in ('active','paused','draft','archived')),
  trigger               jsonb not null default '{}',
  conditions            jsonb not null default '[]',
  actions               jsonb not null default '[]',
  run_count             integer not null default 0,
  success_count         integer not null default 0,
  last_run_at           timestamptz,
  created_via_copilot   boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists automations_user_status_idx on public.automations (user_id, status);

alter table public.automations enable row level security;

create policy "automations_all_own" on public.automations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. updated_at triggers ----------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_events_set_updated_at on public.calendar_events;
create trigger calendar_events_set_updated_at
  before update on public.calendar_events
  for each row execute function public.set_updated_at();

drop trigger if exists automations_set_updated_at on public.automations;
create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();
