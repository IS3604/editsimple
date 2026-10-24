-- EditSimple v2 — doctor/lawyer niches, structured slide kinds, viral-potential signals.
-- Safe to run once on top of 0001_init.sql.

alter table public.slides
  add column if not exists kind text not null default 'statement',
  add column if not exists items jsonb not null default '[]';

alter table public.content_briefs
  add column if not exists niche text check (niche in ('medical','legal')),
  add column if not exists specialty text,
  add column if not exists hook text;

alter table public.keyword_metrics
  add column if not exists news_mentions int;

alter table public.keyword_metrics drop constraint if exists keyword_metrics_origin_check;
alter table public.keyword_metrics
  add constraint keyword_metrics_origin_check
  check (origin in ('google_ads','wikipedia','youtube','ai_suggested','user','news'));

alter table public.brand_settings
  add column if not exists niche text check (niche in ('medical','legal')),
  add column if not exists display_name text,
  add column if not exists handle text;
