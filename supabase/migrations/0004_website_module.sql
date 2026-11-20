-- =====================================================================
-- 0004 · EditSimple Website module (editsimple.in leads, blog posts, settings, team, push alerts)
-- Moved here from the CAS project. Run once in Supabase > SQL Editor (safe to run again).
--
-- Owner of the Website section: ishpreet@editsimple.in (set near the bottom).
--
-- pg_cron / pg_net: if the first two lines fail, enable both under Database > Extensions, then run again.
-- =====================================================================


create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------- ADMINS (who can use the dashboard) ----------
create table if not exists public.eds_admins (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.eds_admins enable row level security;

create or replace function public.eds_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.eds_admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- (No self-claiming: the Owner is added explicitly at the bottom of this file.)
drop function if exists public.eds_claim_first_admin();

-- Team details: the first admin is the Owner (can't be removed); who added whom.
alter table public.eds_admins add column if not exists role text not null default 'admin';
alter table public.eds_admins add column if not exists added_by text not null default '';
update public.eds_admins set role = 'owner'
  where email = (select email from public.eds_admins order by added_at limit 1)
    and not exists (select 1 from public.eds_admins where role = 'owner');

-- Every new team member: email stored lowercase, checked, role decided here (never by the browser).
create or replace function public.eds_admins_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address'; end if;
  new.role := case when exists (select 1 from public.eds_admins) then 'admin' else 'owner' end;  -- first row = Owner
  new.added_by := lower(coalesce(auth.jwt() ->> 'email', ''));
  new.added_at := now();
  return new;
end $$;
drop trigger if exists eds_admins_before_insert on public.eds_admins;
create trigger eds_admins_before_insert before insert on public.eds_admins for each row execute function public.eds_admins_before_insert();
revoke update on public.eds_admins from anon, authenticated;

drop policy if exists eds_admins_read on public.eds_admins;
drop policy if exists eds_admins_add on public.eds_admins;
drop policy if exists eds_admins_remove on public.eds_admins;
create policy eds_admins_read on public.eds_admins for select using (public.eds_is_admin());
create policy eds_admins_add on public.eds_admins for insert with check (public.eds_is_admin());
-- Nobody can remove the Owner or themselves.
create policy eds_admins_remove on public.eds_admins for delete
  using (public.eds_is_admin() and role <> 'owner' and email <> lower(coalesce(auth.jwt() ->> 'email', '')));

-- Team list for the dashboard: shows whether each person has created their account yet.
create or replace function public.eds_team_list()
returns table(email text, role text, added_at timestamptz, added_by text, has_account boolean, confirmed boolean, last_sign_in timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.eds_is_admin() then raise exception 'not authorized'; end if;
  return query
    select a.email, a.role, a.added_at, a.added_by,
           u.id is not null, u.email_confirmed_at is not null, u.last_sign_in_at
    from public.eds_admins a
    left join auth.users u on lower(u.email) = a.email
    order by (a.role = 'owner') desc, a.added_at;
end $$;

-- ---------- SETTINGS (API keys etc. — never readable from the browser) ----------
create table if not exists public.eds_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.eds_settings enable row level security;  -- no policies: only server code and the functions below

create or replace function public.eds_secret_setting_keys() returns text[]
language sql immutable as $$
  select array['openai_api_key','gsc_service_account','github_token','resend_api_key','cron_secret'];
$$;

create or replace function public.eds_editable_setting_keys() returns text[]
language sql immutable as $$
  select array['openai_api_key','openai_model','gsc_service_account','gsc_site',
               'github_token','github_repo','github_branch','site_url','auto_publish',
               'schedule_enabled','schedule_day','schedule_hour',
               'resend_api_key','lead_to_email','lead_from_email','supabase_url'];
$$;

insert into public.eds_settings(key, value) values
  ('openai_model', 'gpt-4.1-mini'),
  ('github_branch', 'main'),
  ('site_url', 'https://is3604.github.io/EDS-Web'),
  ('auto_publish', 'false'),
  ('schedule_enabled', 'true'),
  ('schedule_day', '1'),      -- 0=Sun 1=Mon ... 6=Sat (India time)
  ('schedule_hour', '10'),    -- 0-23, India time
  ('lead_to_email', 'contact@editsimple.in'),
  ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- Dashboard reads settings through this: secret values come back masked (last 4 chars only).
create or replace function public.eds_get_settings()
returns table(key text, value text, is_secret boolean, is_set boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eds_is_admin() then raise exception 'not authorized'; end if;
  return query
    select s.key,
           case when s.key = any(public.eds_secret_setting_keys())
                then case when s.value <> '' then '••••' || right(s.value, 4) else '' end
                else s.value end,
           s.key = any(public.eds_secret_setting_keys()),
           s.value <> ''
    from public.eds_settings s
    where s.key = any(public.eds_editable_setting_keys());
end $$;

-- Dashboard saves through this. Only known keys; send null to leave a value unchanged.
create or replace function public.eds_set_settings(data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare k text; v text;
begin
  if not public.eds_is_admin() then raise exception 'not authorized'; end if;
  for k, v in select * from jsonb_each_text(data) loop
    if k = any(public.eds_editable_setting_keys()) and v is not null then
      insert into public.eds_settings(key, value, updated_at) values (k, trim(v), now())
      on conflict (key) do update set value = excluded.value, updated_at = now();
    end if;
  end loop;
end $$;

-- ---------- BLOG POSTS ----------
create table if not exists public.eds_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null default '',
  description text not null default '',
  keywords text[] not null default '{}',
  target_query text not null default '',
  keyword_source text not null default '',
  sources jsonb not null default '[]',
  body_html text not null default '',
  model text not null default '',
  status text not null default 'draft' check (status in ('generating','draft','published','failed')),
  error text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.eds_posts enable row level security;
drop policy if exists eds_posts_read on public.eds_posts;
drop policy if exists eds_posts_edit on public.eds_posts;
create policy eds_posts_read on public.eds_posts for select using (public.eds_is_admin());
create policy eds_posts_edit on public.eds_posts for update using (public.eds_is_admin()) with check (public.eds_is_admin());
-- insert / delete / publish happen in the edge functions (they also update GitHub)
-- Team can only edit the text of a post from the browser; status/publishing goes through post-action.
revoke update on public.eds_posts from anon, authenticated;
grant update (title, description, keywords, body_html, slug, updated_at) on public.eds_posts to authenticated;
create or replace function public.eds_posts_guard() returns trigger language plpgsql as $$
begin
  if old.status = 'published' and new.slug <> old.slug and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'The address (slug) of a published post cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists eds_posts_guard on public.eds_posts;
create trigger eds_posts_guard before update on public.eds_posts for each row execute function public.eds_posts_guard();

-- ---------- LEADS (website form submissions) ----------
create table if not exists public.eds_leads (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  form text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  specialty text not null default '',
  interested_in text not null default '',
  message text not null default '',
  page text not null default '',
  page_url text not null default '',
  button text not null default '',
  button_location text not null default '',
  referrer text not null default '',
  fields jsonb not null default '{}',
  email_sent boolean not null default false
);
alter table public.eds_leads enable row level security;
alter table public.eds_leads add column if not exists status text not null default 'new'
  check (status in ('new', 'contacted', 'won', 'lost'));
drop policy if exists eds_leads_update on public.eds_leads;
create policy eds_leads_update on public.eds_leads for update using (public.eds_is_admin()) with check (public.eds_is_admin());
revoke update on public.eds_leads from anon, authenticated;
grant update (status) on public.eds_leads to authenticated;
drop policy if exists eds_leads_read on public.eds_leads;
drop policy if exists eds_leads_remove on public.eds_leads;
create policy eds_leads_read on public.eds_leads for select using (public.eds_is_admin());
create policy eds_leads_remove on public.eds_leads for delete using (public.eds_is_admin());

-- ---------- WEEKLY BLOG SCHEDULE ----------
-- Pings the generate-post function every hour; the function itself checks the day/hour set in the dashboard.
select cron.unschedule('eds-blog') where exists (select 1 from cron.job where jobname = 'eds-blog');
select cron.schedule('eds-blog', '5 * * * *', $cron$
  select net.http_post(
    url := (select value from public.eds_settings where key = 'supabase_url') || '/functions/v1/eds-generate-post',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select value from public.eds_settings where key = 'cron_secret')),
    body := '{"source":"cron"}'::jsonb)
  where exists (select 1 from public.eds_settings where key = 'supabase_url' and value like 'https://%');
$cron$);

-- ---------- OWNER: replace with your EditSimple Studio login email, then run ----------
insert into public.eds_admins(email) values ('ishpreet@editsimple.in') on conflict (email) do nothing;

-- ---------- This project's address (lets the weekly schedule reach the edge functions) ----------
insert into public.eds_settings(key, value) values ('supabase_url', 'https://jikqhnmhzuvhjvdweoah.supabase.co')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- =====================================================================  maintenance mode
create or replace function public.eds_editable_setting_keys() returns text[]
language sql immutable as $$
  select array['openai_api_key','openai_model','gsc_service_account','gsc_site',
               'github_token','github_repo','github_branch','site_url','auto_publish',
               'schedule_enabled','schedule_day','schedule_hour',
               'resend_api_key','lead_to_email','lead_from_email','supabase_url',
               'maintenance_mode'];
$$;

insert into public.eds_settings(key, value) values ('maintenance_mode', 'false')
on conflict (key) do nothing;

-- =====================================================================  browser push alerts for new website leads

create extension if not exists pg_net;

create table if not exists public.push_subscriptions (
  id           bigserial primary key,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email        text not null default lower(coalesce(auth.jwt()->>'email', '')),
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_email_idx on public.push_subscriptions (lower(email));

alter table public.push_subscriptions enable row level security;
drop policy if exists push_own_select on public.push_subscriptions;
drop policy if exists push_own_insert on public.push_subscriptions;
drop policy if exists push_own_update on public.push_subscriptions;
drop policy if exists push_own_delete on public.push_subscriptions;
create policy push_own_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_own_update on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant usage on sequence public.push_subscriptions_id_seq to authenticated;

-- A browser that was signed in as someone else hands its subscription over to the current user.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'invalid subscription';
  end if;
  insert into push_subscriptions (user_id, email, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), lower(coalesce(auth.jwt()->>'email', '')), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, email = excluded.email, p256dh = excluded.p256dh,
    auth = excluded.auth, user_agent = excluded.user_agent, last_seen_at = now();
end $$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------- config (not readable through the API)
create table if not exists public.push_config (
  id      int primary key default 1 check (id = 1),
  app_url text,
  secret  text
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- Called by the dashboard after sending: removes subscriptions the browser has cancelled (404/410).
create or replace function public.push_prune(p_secret text, p_endpoints text[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_secret is null or not exists (select 1 from push_config where id = 1 and secret = p_secret and length(secret) >= 24) then
    raise exception 'unauthorized';
  end if;
  delete from push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.push_prune(text, text[]) from public;
grant execute on function public.push_prune(text, text[]) to anon, authenticated;

-- ---------------------------------------------------------------- trigger on new website leads
create or replace function public.notify_new_eds_lead() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare cfg record; subs jsonb;
begin
  select app_url, secret into cfg from push_config where id = 1;
  if cfg.app_url is null or cfg.secret is null then return new; end if;

  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into subs
    from push_subscriptions s
   where lower(s.email) in (select lower(a.email) from eds_admins a);
  if subs is null then return new; end if;

  perform net.http_post(
    url := rtrim(cfg.app_url, '/') || '/api/push/new-lead',
    body := jsonb_build_object(
      'lead', jsonb_build_object(
        'id', new.id, 'name', left(new.name, 120), 'email', left(new.email, 160), 'interested_in', left(new.interested_in, 120),
        'form', new.form, 'page', left(new.page, 120),
        'source', left(new.fields->>'UTM Source', 80), 'medium', left(new.fields->>'UTM Medium', 80)),
      'subscriptions', subs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Push-Secret', cfg.secret),
    timeout_milliseconds := 8000);
  return new;
exception when others then
  raise warning 'push notification skipped: %', sqlerrm;  -- never lose a lead because of a notification
  return new;
end $$;
revoke all on function public.notify_new_eds_lead() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.eds_leads') is not null then
    drop trigger if exists eds_leads_push on public.eds_leads;
    create trigger eds_leads_push after insert on public.eds_leads for each row execute function public.notify_new_eds_lead();
  else
    raise notice 'eds_leads does not exist yet: run this file again.';
  end if;
end $$;

-- Live updates in the dashboard (optional; it also refreshes every 20s without this).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'eds_leads') then
      alter publication supabase_realtime add table public.eds_leads;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'eds_posts') then
      alter publication supabase_realtime add table public.eds_posts;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------- one-time setup: run separately AFTER adding PUSH_WEBHOOK_SECRET in Vercel (never commit the secret)
-- insert into public.push_config (id, app_url, secret)
-- values (1, 'https://YOUR-APP.vercel.app', '<same value as PUSH_WEBHOOK_SECRET in Vercel>')
-- on conflict (id) do update set app_url = excluded.app_url, secret = excluded.secret;
