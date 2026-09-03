-- Per-user daily budget for the page assistant.
--
-- The assistant proxies to paid LLM and voice APIs on a personal key with a
-- small balance, so an unbounded loop — or one enthusiastic user — would drain
-- it. An in-memory counter is useless on serverless (every invocation is a
-- fresh process), so the counter lives in the database next to everything else.

create table if not exists skinscan_assistant_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('llm', 'tts', 'stt')),
  count int not null default 0,
  primary key (user_id, day, kind)
);

alter table skinscan_assistant_usage enable row level security;

-- Users may see their own usage; only the server (service role) writes.
drop policy if exists p_assistant_usage_own on skinscan_assistant_usage;
create policy p_assistant_usage_own on skinscan_assistant_usage
  for select using (user_id = auth.uid());

-- Atomic increment-and-check. Returns true when the call is allowed, which
-- means the decision and the increment cannot race apart under concurrency.
create or replace function skinscan_assistant_take(p_user uuid, p_kind text, p_limit int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare new_count int;
begin
  insert into skinscan_assistant_usage (user_id, day, kind, count)
  values (p_user, current_date, p_kind, 1)
  on conflict (user_id, day, kind)
    do update set count = skinscan_assistant_usage.count + 1
  returning count into new_count;
  return new_count <= p_limit;
end $$;

revoke all on function skinscan_assistant_take(uuid, text, int) from public, anon, authenticated;
