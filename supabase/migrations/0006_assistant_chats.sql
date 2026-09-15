-- Chats with the in-app assistant, saved to the user's account.
--
-- Only for users who opt in. The assistant's default is "Don't save"; a user can
-- switch to "Save to my account" in the assistant's settings (Data tab). Until
-- they do, nothing is written here.
--
-- Adapted from page-assistant's reference migration
-- (vendor/page-assistant/packages/widget/supabase/assistant_chats.sql), renamed
-- with the skinscan_ prefix like every other table in the shared project. Pairs
-- with supabaseChatHistoryAdapter(supabase, { table: "skinscan_assistant_chats",
-- app: "skinscan" }) in src/components/PageAssistantWidget.tsx.
--
-- Access: row-level security. A signed-in user can read, add, change and delete
-- only their own rows. anon gets nothing. The browser reaches this table with the
-- user's own session, never the service role.
--
-- Retention: a chat with no activity for 12 months (updated_at) is deleted by
-- skinscan_assistant_chats_delete_inactive(), scheduled below with pg_cron when
-- it is enabled. Deleting the account cascades via auth.users.

create table if not exists public.skinscan_assistant_chats (
  id          text        not null check (char_length(id) between 1 and 128),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  -- The adapter's `app` option. Always 'skinscan' here; part of the key the
  -- adapter upserts on.
  app         text        not null default '' check (char_length(app) <= 128),
  title       text        not null default 'New chat' check (char_length(title) <= 500),
  messages    jsonb       not null default '[]'::jsonb
                          check (jsonb_typeof(messages) = 'array')
                          -- One user cannot fill the database. The widget keeps at
                          -- most 100 messages per chat.
                          check (octet_length(messages::text) <= 5000000),
  pinned      boolean     not null default false,
  archived    boolean     not null default false,
  group_id    text,
  model       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Must match the adapter's upsert onConflict "user_id,app,id".
  primary key (user_id, app, id)
);

-- The list: one user's chats, newest first.
create index if not exists skinscan_assistant_chats_user_app_updated_idx
  on public.skinscan_assistant_chats (user_id, app, updated_at desc);
-- The retention sweep.
create index if not exists skinscan_assistant_chats_updated_idx
  on public.skinscan_assistant_chats (updated_at);

-- The client sends its own timestamps (a chat moved from the device keeps its
-- real created_at). It may never send one in the future: that would dodge the
-- retention rule.
create or replace function public.skinscan_assistant_chats_clamp_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(coalesce(new.updated_at, now()), now());
  new.created_at := least(coalesce(new.created_at, now()), new.updated_at);
  return new;
end;
$$;

drop trigger if exists skinscan_assistant_chats_clamp_times on public.skinscan_assistant_chats;
create trigger skinscan_assistant_chats_clamp_times
  before insert or update on public.skinscan_assistant_chats
  for each row execute function public.skinscan_assistant_chats_clamp_times();

-- Row-level security: every policy is "the row is mine".
alter table public.skinscan_assistant_chats enable row level security;

drop policy if exists p_assistant_chats_select_own on public.skinscan_assistant_chats;
create policy p_assistant_chats_select_own on public.skinscan_assistant_chats
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists p_assistant_chats_insert_own on public.skinscan_assistant_chats;
create policy p_assistant_chats_insert_own on public.skinscan_assistant_chats
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists p_assistant_chats_update_own on public.skinscan_assistant_chats;
create policy p_assistant_chats_update_own on public.skinscan_assistant_chats
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists p_assistant_chats_delete_own on public.skinscan_assistant_chats;
create policy p_assistant_chats_delete_own on public.skinscan_assistant_chats
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.skinscan_assistant_chats from anon;
grant select, insert, update, delete on table public.skinscan_assistant_chats to authenticated;

-- Retention: delete chats with no activity for 12 months. Returns how many went.
-- The interval is fixed, with no parameter, so nobody can call it to wipe more.
create or replace function public.skinscan_assistant_chats_delete_inactive()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  deleted integer;
begin
  delete from public.skinscan_assistant_chats
  where updated_at < now() - interval '12 months';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Only the database owner and the service role may run it; never a signed-in user.
revoke execute on function public.skinscan_assistant_chats_delete_inactive() from public, anon, authenticated;
grant execute on function public.skinscan_assistant_chats_delete_inactive() to service_role;

-- Daily at 03:17 UTC with pg_cron, when pg_cron is enabled (Database ->
-- Extensions -> pg_cron). Re-running this file updates the same job.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'skinscan-assistant-chats-retention',
      '17 3 * * *',
      'select public.skinscan_assistant_chats_delete_inactive()'
    );
  else
    raise notice 'pg_cron is not enabled: schedule public.skinscan_assistant_chats_delete_inactive() another way (see the end of this file).';
  end if;
end;
$$;

-- If pg_cron is enabled after this migration ran, run the cron.schedule(...)
-- statement above once by hand. Without pg_cron, run this once a day from a
-- scheduler holding the service-role key (never a browser):
--
--   select public.skinscan_assistant_chats_delete_inactive();
--
-- The adapter also hides and deletes a returning user's own inactive chats when
-- they open the assistant, but a user who never comes back is only covered by
-- the scheduled run.
