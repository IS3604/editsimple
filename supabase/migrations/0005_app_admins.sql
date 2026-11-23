-- =====================================================================
-- 0005 · Studio admins (who can invite people and manage accounts)
-- Run once in Supabase > SQL Editor (safe to run again).
-- Inviting also needs SUPABASE_SERVICE_ROLE_KEY in Vercel (server-only).
-- =====================================================================

create table if not exists public.app_admins (
  email      text primary key check (email = lower(email)),
  role       text not null default 'admin' check (role in ('owner', 'admin')),
  added_at   timestamptz not null default now(),
  added_by   text
);

alter table public.app_admins enable row level security;

-- True when the signed-in user's email is a Studio admin.
create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.is_app_admin() to authenticated;

-- Admins can see the admin list; changes go through the server (service role) only.
drop policy if exists "admins read" on public.app_admins;
create policy "admins read" on public.app_admins for select to authenticated using (public.is_app_admin());

-- ---------- OWNER ----------
insert into public.app_admins (email, role, added_by)
values ('ishpreet@editsimple.in', 'owner', 'setup')
on conflict (email) do update set role = 'owner';

notify pgrst, 'reload schema';
