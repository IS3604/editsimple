# EditSimple Website section: setup (moved from CAS)

The **Website** item in the sidebar manages editsimple.in: leads, AI blog posts, weekly schedule, maintenance mode, settings and team.
It only shows for emails on the Website team (`eds_is_admin`).

## 1. Database (EditSimple Supabase: jikqhnmhzuvhjvdweoah)
1. Supabase → Database → Extensions: turn on **pg_cron** and **pg_net**.
2. Open `supabase/migrations/0004_website_module.sql`, owner email is already set to ishpreet@editsimple.in.
3. Paste the whole file into SQL Editor → Run. (`supabase_url` is already set to this project.)

## 2. Edge functions (Verify JWT **OFF** for each)
All four are in `supabase/functions/`.
Deploy each one
(Supabase → Edge Functions → Deploy new function → paste code → turn off "Verify JWT").

## 3. Vercel environment variables (then Redeploy)
| Name | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key (secret) |
| `VAPID_SUBJECT` | `mailto:contact@editsimple.in` |
| `PUSH_WEBHOOK_SECRET` | any random text, 32+ characters (secret) |

VAPID keys: run `npx web-push generate-vapid-keys` once (or any VAPID key generator). Never put secrets in chat or GitHub.

Then in SQL Editor (separately, don't commit):
```sql
insert into public.push_config (id, app_url, secret)
values (1, 'https://YOUR-APP.vercel.app', '<same PUSH_WEBHOOK_SECRET>')
on conflict (id) do update set app_url = excluded.app_url, secret = excluded.secret;
```

## 4. Move the data (do this yourself)
- [ ] Old CAS Supabase → Table Editor → `eds_leads` → Export CSV.
- [ ] Old CAS → `eds_posts` → Export CSV.
- [ ] Here → Table Editor → `eds_leads` → Import CSV, **untick/skip the `id` column**.
- [ ] Here → `eds_posts` → Import CSV (keep `id`).
- [ ] Studio → Website → Settings: re-enter OpenAI key (+ model), GitHub token, repo `IS3604/EDS-Web`, branch, website address, Resend key, lead to/from emails, Search Console property + JSON key. Save.
- [ ] Website → Team: add the other team members.

## 5. Switch the website (repo IS3604/EDS-Web)
`assets/config.js`, line 3:
```diff
- window.ES_LEAD_ENDPOINT = "https://uhcbghfahdrlijawpxhy.supabase.co/functions/v1/eds-send-lead";
+ window.ES_LEAD_ENDPOINT = "https://jikqhnmhzuvhjvdweoah.supabase.co/functions/v1/eds-send-lead";
```
No file in EDS-Web calls `eds-site-status` today, so there is nothing else to change. The maintenance switch only affects the
site once a page checks `https://jikqhnmhzuvhjvdweoah.supabase.co/functions/v1/eds-site-status` (returns `{"maintenance":true|false}`).
Optional: README.md line 21 still says "CAS dashboard".

## 6. Check before removing anything from CAS
- [ ] Vercel build passes.
- [ ] Website → Settings → Notifications: Turn on → Send test (arrives).
- [ ] Submit a test form on editsimple.in → lead shows in Website → Leads, email arrives, push notification fires.
- [ ] Blog posts → Generate post → becomes "To review" in 1–2 min → Publish → View works → Unpublish.
- [ ] Settings → Test connection says connected.

**Only after every box above is ticked:** run `20261120000028_remove_website_module.sql` in the OLD CAS Supabase and delete its
four `eds-*` edge functions.
