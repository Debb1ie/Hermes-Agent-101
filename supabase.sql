-- Run this once in Supabase SQL Editor. It is safe to run again.
-- The service-role/secret key is used only by the server functions.
create table if not exists public.app_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Speeds up the prefix lookups the dashboard uses (user:, progress:, feedback:, telegram:, usage:).
create index if not exists app_store_key_prefix_idx on public.app_store (key text_pattern_ops);

create or replace function public.touch_app_store_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_store_updated_at on public.app_store;
create trigger app_store_updated_at
before update on public.app_store
for each row execute function public.touch_app_store_updated_at();

-- Daily usage counters (Live AI and Real agents messages). One atomic statement, so two
-- messages sent at the same moment are both counted.
create or replace function public.app_store_increment(p_key text, p_by integer default 1)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  result bigint;
begin
  insert into public.app_store as s (key, value) values (p_key, to_jsonb(p_by))
  on conflict (key) do update
    set value = to_jsonb(coalesce((s.value #>> '{}')::bigint, 0) + p_by)
  returning (value #>> '{}')::bigint into result;
  return result;
end;
$$;

-- RLS on with no policies: browsers (anon/authenticated keys) can never read this table.
-- Only the server's service-role/secret key, which bypasses RLS, can.
alter table public.app_store enable row level security;
revoke all on table public.app_store from anon, authenticated;
grant select, insert, update, delete on table public.app_store to service_role;
revoke all on function public.app_store_increment(text, integer) from public, anon, authenticated;
grant execute on function public.app_store_increment(text, integer) to service_role;

-- Optional cleanup. Run whenever you like.
-- Expired login sessions:
-- delete from public.app_store where key like 'session:%' and (value->>'expiresAt')::bigint < extract(epoch from now()) * 1000;
-- Usage counters older than 30 days:
-- delete from public.app_store where key like 'usage:%' and updated_at < now() - interval '30 days';
