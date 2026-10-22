-- EditSimple — initial schema
-- Every user-owned row carries user_id (default auth.uid()) and is protected by owner-only RLS.

create extension if not exists "pgcrypto";

-- ---------- helpers ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- brand settings ----------
create table public.brand_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'My brand',
  theme text not null default 'minimalist',
  colors jsonb not null default '{"primary":"#111111","accent":"#FF5A36","background":"#F6F3EE","text":"#111111"}',
  font_heading text not null default 'display',
  font_body text not null default 'sans',
  logo_path text,
  tone text default 'clear and confident',
  language text default 'English',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_settings_user_idx on public.brand_settings(user_id);

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  platform text not null check (platform in ('instagram','linkedin','both')),
  slide_count int not null check (slide_count between 3 and 10),
  size text not null default '1080x1350' check (size in ('1080x1350','1080x1080')),
  design jsonb not null default '{}',
  -- pipeline: 0 created,1 keywords,2 strategy,3 copy,4 visuals,5 rendered,6 caption,7 exports ready
  stage int not null default 0,
  status text not null default 'draft' check (status in ('draft','generating','ready','failed')),
  stage_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_idx on public.projects(user_id, updated_at desc);

-- ---------- content briefs ----------
create table public.content_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  topic text not null,
  industry text,
  audience text,
  objective text check (objective in ('education','engagement','awareness','leads')),
  tone text,
  language text default 'English',
  reference_url text,
  user_keywords text[] not null default '{}',
  strategy jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- keyword research ----------
create table public.keyword_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  topic text not null,
  niche text,
  platform text,
  sources jsonb not null default '[]',  -- [{source, ok, error?, fetched_at}]
  created_at timestamptz not null default now()
);
create index keyword_research_user_idx on public.keyword_research(user_id, created_at desc);
create index keyword_research_project_idx on public.keyword_research(project_id);

create table public.keyword_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  research_id uuid not null references public.keyword_research(id) on delete cascade,
  keyword text not null,
  related_topic text,
  kind text not null default 'related' check (kind in ('seed','related','long_tail','hashtag','user')),
  origin text not null check (origin in ('google_ads','wikipedia','youtube','ai_suggested','user')),
  -- REAL statistics (null when the source didn't provide them)
  avg_monthly_searches bigint,
  competition text,
  competition_index int,
  monthly_searches jsonb,
  interest_series jsonb,            -- [{date, value}]
  interest_source text,             -- e.g. 'wikipedia:Article_Title'
  trend_direction text check (trend_direction in ('rising','falling','stable')),
  youtube_stats jsonb,              -- {sample_size, median_views, median_engagement_rate, latest_upload}
  -- AI ESTIMATES (always labelled in UI)
  ai_opportunity_score int check (ai_opportunity_score between 0 and 100),
  ai_rationale text,
  selected boolean not null default false,
  fetched_at timestamptz not null default now()
);
create index keyword_metrics_research_idx on public.keyword_metrics(research_id);
create index keyword_metrics_user_idx on public.keyword_metrics(user_id);

-- ---------- slides ----------
create table public.slides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  position int not null,
  role text not null default 'insight',
  kicker text,
  heading text not null default '',
  body text not null default '',
  visual_prompt text,
  layout text not null default 'top' check (layout in ('top','center','bottom','split')),
  background_path text,
  style jsonb not null default '{}',
  render_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index slides_project_idx on public.slides(project_id, position);

-- ---------- generated assets ----------
create table public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  slide_id uuid references public.slides(id) on delete set null,
  kind text not null check (kind in ('background','logo','render','upload')),
  storage_path text not null,
  provider text,
  prompt text,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index generated_assets_project_idx on public.generated_assets(project_id);

-- ---------- captions ----------
create table public.captions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null check (platform in ('instagram','linkedin')),
  body text not null,
  hashtags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, platform)
);

-- ---------- optional post performance (user-entered) ----------
create table public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null check (platform in ('instagram','linkedin')),
  posted_at timestamptz,
  impressions int, reach int, likes int, comments int, shares int, saves int,
  notes text,
  created_at timestamptz not null default now()
);
create index post_metrics_project_idx on public.post_metrics(project_id);

-- ---------- updated_at triggers ----------
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_brand before update on public.brand_settings for each row execute function public.touch_updated_at();
create trigger t_projects before update on public.projects for each row execute function public.touch_updated_at();
create trigger t_briefs before update on public.content_briefs for each row execute function public.touch_updated_at();
create trigger t_slides before update on public.slides for each row execute function public.touch_updated_at();
create trigger t_captions before update on public.captions for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['brand_settings','projects','content_briefs','keyword_research','keyword_metrics',
                           'slides','generated_assets','captions','post_metrics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner all" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- storage ----------
-- Private bucket; objects live under "<user_id>/..." and are served through /api/assets after an ownership check.
insert into storage.buckets (id, name, public) values ('editsimple', 'editsimple', false)
on conflict (id) do nothing;

create policy "own folder read" on storage.objects for select
  using (bucket_id = 'editsimple' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder insert" on storage.objects for insert
  with check (bucket_id = 'editsimple' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder update" on storage.objects for update
  using (bucket_id = 'editsimple' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete" on storage.objects for delete
  using (bucket_id = 'editsimple' and (storage.foldername(name))[1] = auth.uid()::text);
