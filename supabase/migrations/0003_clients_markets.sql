-- EditSimple v3 — agency clients, international markets, 1–7 slide posts, branded backgrounds.
-- Run once, after 0001 and 0002.

alter table public.projects drop constraint if exists projects_slide_count_check;
alter table public.projects add constraint projects_slide_count_check check (slide_count between 1 and 10);

-- brand_settings now represents a CLIENT of the agency
alter table public.brand_settings
  add column if not exists specialty text,
  add column if not exists market text not null default 'US',
  add column if not exists audience text,
  add column if not exists notes text,
  add column if not exists bg_path text;

alter table public.content_briefs
  add column if not exists market text not null default 'US',
  add column if not exists client_id uuid references public.brand_settings(id) on delete set null;

create index if not exists content_briefs_client_idx on public.content_briefs(client_id);
