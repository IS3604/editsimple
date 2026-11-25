-- 0006 · Who a post is for: the client's patients/clients ('public') or the professionals themselves ('pros').
alter table public.content_briefs
  add column if not exists audience_type text not null default 'public' check (audience_type in ('public', 'pros'));
notify pgrst, 'reload schema';
