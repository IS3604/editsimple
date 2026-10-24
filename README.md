# EditSimple — AI Carousel Studio (MVP)

Enter a topic → research real keywords → generate 6–7 slide copy → generate text‑free visuals → render slides with exact typography → edit → caption → export PNG/JPEG ZIP or PDF → reopen anytime.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind + shadcn‑style UI · Supabase (Auth, Postgres + RLS, Storage) · Groq / OpenAI (text) · OpenAI Images · YouTube Data API · Google Ads API (optional) · Wikimedia APIs.

---

## 1. Architecture

```
Browser (Next.js client)                      Next.js server (route handlers, Node runtime)
──────────────────────────                    ───────────────────────────────────────────────
Create form ──POST /api/projects──────────▶  insert projects + content_briefs (RLS: user)
          ──POST /api/keywords────────────▶  research/index.ts
                                               ├─ Google Ads KeywordPlanIdeaService (if configured) → volume, competition, 12‑mo series
                                               ├─ Groq/OpenAI → related & long‑tail ideas, hashtags (labelled AI)
                                               ├─ Wikimedia pageviews → daily interest series + trend direction (proxy)
                                               ├─ YouTube Data API → median views / engagement of recent videos
                                               └─ Groq/OpenAI → opportunity score 0–100 (labelled estimate)
Keyword picker ──PUT /api/projects/:id/keywords
Editor pipeline (resumable, state in projects.stage)
  2–3 ─POST /content──────────────────────▶  strategy + slide copy (JSON‑validated with zod, auto‑retry)
  4   ─POST /slides/:sid/background (×N)──▶  OpenAI image → Supabase Storage (private bucket)
  5   render slides in the browser (DOM → PNG via html‑to‑image) ─POST /renders──▶ Storage
  6   ─POST /caption (per platform)───────▶  caption + hashtags
  7   ready → exports are generated client‑side from the same DOM nodes (PNG/JPEG ZIP, PDF)
Private images ◀─GET /api/assets?path=──────  ownership check + Storage download (same origin, no CORS)
```

**Rendering.** Image models never draw text. Each slide is a React component (`SlideCanvas`) at native 1080 px size: text, logo, progress dots and accents are DOM/CSS over an optional AI background. An auto‑fit loop shrinks type in 4% steps until copy fits its box (warning shown if it still overflows at 62%). The *same* nodes are rasterised for export, so downloads == preview. Fonts are self‑hosted (Fontsource) so they embed reliably.

**Providers are swappable**: `lib/ai/llm.ts` (any OpenAI‑compatible chat API), `lib/ai/image.ts` (image provider), `lib/research/*` (one file per data source).

## 2. What each service does

| Service | Used for | Key |
|---|---|---|
| **Groq** (`openai/gpt-oss-120b`, auto-fallback to `gpt-oss-20b`) | Default fast text: keyword ideas, scoring, slide copy, captions (JSON mode) | `GROQ_API_KEY` |
| **OpenAI** text (`gpt-4o-mini`) | Fallback / alternative text provider (`TEXT_PROVIDER=openai`) | `OPENAI_API_KEY` |
| **OpenAI Images** (`gpt-image-2.5-flare` (auto-falls back to `gpt-image-2.5-sunburst`, `gpt-image-2`)) | Text‑free backgrounds/illustrations (1024×1536 or 1024×1024) | `OPENAI_API_KEY`, `IMAGE_PROVIDER=openai` |
| **YouTube Data API v3** | Engagement of recent videos per keyword; trending videos by region | `YOUTUBE_API_KEY` |
| **Google Ads API – Keyword Planner** | Real avg monthly searches, competition, 12‑month volumes | developer token + OAuth (optional) |
| **Wikimedia REST** | Daily article pageviews (interest proxy), “most read” trending list | none |
| **Supabase** | Auth, Postgres (RLS), private Storage | URL + anon key |

### Google APIs — what's actually usable (checked Oct 2026)
- **Google Trends API**: official, but an *application‑only alpha* (no self‑serve key). Not used. If you get alpha access, add `lib/research/googleTrends.ts` and return `interest_series` — the UI already renders it.
- **Custom Search JSON API**: closed to new customers; retiring 1 Jan 2027. Not used.
- **Google Ads API (KeywordPlanIdeaService.GenerateKeywordIdeas)**: the only official Google source of search volume. Needs an Ads account and an approved developer token (Basic access). Optional here.
- **YouTube Data API v3**: self‑serve API key. Used. Quota: 10,000 units/day; `search.list` = 100 units, so research checks max 6 keywords per run.
- A plain Google API key does **not** grant Trends or Instagram data.

### Which requested statistics are genuinely available
| Statistic | Status |
|---|---|
| Search volume, competition, monthly history | ✅ only with Google Ads API configured; otherwise shown as **n/a** |
| Search interest over time | ✅ Ads monthly volumes, else Wikipedia daily pageviews (**labelled as proxy**) |
| Trend direction | ✅ computed from the above series (last 3 vs prior 3 months / last 28 vs prior 28 days, ±15%) |
| Engagement stats | ✅ YouTube recent‑video median views & (likes+comments)/views — not Instagram |
| Instagram/LinkedIn keyword or hashtag reach | ❌ not exposed by official APIs (Instagram Graph hashtag search only returns media for business accounts, no volume). Not scraped. |
| Opportunity score | 🟣 AI estimate, always labelled, rationale shown |
| Related / long‑tail keywords, hashtags | 🟣 AI suggestions (Ads ideas are real when configured) |

UI colour code: **green = measured**, **violet = AI estimate**. Every research run stores per‑source status and timestamps.

## 3. Database (supabase/migrations/0001_init.sql)

`profiles` (auto‑created on signup) · `brand_settings` (kits: theme, colours, fonts, logo, tone) · `projects` (platform, size, design JSON, **stage/status/stage_error** for resume) · `content_briefs` (1:1 project; topic, audience, objective, strategy JSON) · `keyword_research` (run + per‑source status) · `keyword_metrics` (real columns vs `ai_*` columns, selected flag) · `slides` (copy, layout, style overrides, background/render paths) · `generated_assets` (every stored file + provider/prompt) · `captions` (unique per project+platform) · `post_metrics` (optional, user‑entered performance).

All tables: UUID PKs, timestamps, FKs with cascade, indexes, RLS `user_id = auth.uid()`. Storage bucket `editsimple` is private; objects live under `<user_id>/…` with folder‑scoped policies.

## 4. Setup

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev                  # http://localhost:3000
```

**Supabase**
1. Create a project → *Project Settings → API*: copy URL + anon key.
2. *SQL Editor* → run `supabase/migrations/0001_init.sql` (or `supabase db push` with the CLI).
3. *Authentication → URL configuration*: add `http://localhost:3000/auth/callback` (and your prod URL) to redirect URLs. Disable "Confirm email" for faster local testing if you like.

**Groq**: console.groq.com → API keys → `GROQ_API_KEY`.
**OpenAI**: platform.openai.com → API key → `OPENAI_API_KEY`. `gpt-image-2.5-flare` (auto-falls back to `gpt-image-2.5-sunburst`, `gpt-image-2`) may require organisation verification; set `OPENAI_IMAGE_MODEL=dall-e-3` as an alternative, or `IMAGE_PROVIDER=none` for designed text‑only slides.

**YouTube Data API**
1. console.cloud.google.com → create/select project.
2. *APIs & Services → Library* → enable **YouTube Data API v3**.
3. *Credentials → Create credentials → API key*; restrict it to YouTube Data API v3 → `YOUTUBE_API_KEY`.

**Google Ads Keyword Planner (optional, adds real search volume)**
1. Google Ads manager account → *Tools → API Center* → apply for a developer token (Basic access needed for production data).
2. Cloud console: enable **Google Ads API**; create an OAuth client (Web/Desktop).
3. Generate a refresh token for a user with access to the Ads account (OAuth Playground with scope `https://www.googleapis.com/auth/adwords`).
4. Fill `GOOGLE_ADS_*` (customer id digits only; `LOGIN_CUSTOMER_ID` = manager id if using an MCC). Geo `2356` = India, `2840` = US; language `1000` = English.

## 5. Deploy (Vercel)
1. Push to GitHub → import in Vercel.
2. Add every variable from `.env.example` (never prefix secrets with `NEXT_PUBLIC_`).
3. Add `https://<your-domain>/auth/callback` to Supabase redirect URLs.
4. Image generation can take 20–60 s: route `maxDuration` is set to 120 s for backgrounds (Vercel Pro allows this; on Hobby keep `dall-e-3` or reduce to cover‑only images).

## 6. Using it
Create → fill brief & design (or load a saved brand kit) → **Research keywords** → tick keywords / add your own → **Generate carousel**. The editor shows the 7 stages live; if anything fails the project is saved with the error and a **Resume** button continues from that stage. Edit text, layout, colours, fonts, logo, per‑slide style; rewrite or re‑image single slides; reorder/add/delete. Captions per platform (edit, regenerate, copy caption / hashtags separately). Export: this slide (PNG), PNG ZIP, JPEG ZIP, PDF (LinkedIn document post). Everything autosaves.

## 7. Known limits / next steps
- Reference URLs: public pages only; Instagram/LinkedIn posts need login and aren't fetched.
- Post‑performance table exists; no UI yet (would come from Instagram Graph / LinkedIn APIs for business accounts).
- Add rate limiting per user on AI routes (e.g. Upstash) before opening to the public.

---

## v2 — doctors & lawyers edition (Oct 2026)

**Run once in Supabase → SQL Editor:** `supabase/migrations/0002_niches_templates.sql`.

- **Niche-first**: Doctors / Lawyers switch in the sidebar (recolours the app). Prompts carry niche playbooks and compliance rules (NMC conduct norms; Bar Council of India Rule 36 — no solicitation CTAs).
- **Trending** (`/api/trending?niche=`): real Google News RSS headlines (India, 7 days) + YouTube most-viewed niche videos → AI post ideas with source links. Cached 1 h.
- **Viral potential**: measured signals per keyword (news mentions 7d, YouTube views/day + engagement, Wikipedia trend, Ads volume if connected) + an AI-estimated viral score grounded on them. Instagram exposes no search/reach data.
- **Better copy**: angle-first prompt, 9 slide types (cover, single point, list, steps, checklist, myth vs fact, do vs don't, big statement, CTA), then an editor pass. gpt-oss-120b on Groq.
- **AI help while filling the brief** (`/api/suggest`): topic ideas, sharper title, cover hooks, audiences, keywords, tip.
- **Image alignment**: images generated in the frame's aspect (portrait full-bleed/side, landscape inline), composition rules, JPEG output, focus slider.
- **7 templates**: Studio, Clinic, Counsel, Editorial, Aura, Poster, Night.
- **New UI**: 3-step create flow with live phone preview; redesigned dashboard, trending, keywords, editor, brand kit, login.

---

## v3 — agency studio, international clients (Oct 2026)

**Run once in Supabase → SQL Editor:** `supabase/migrations/0003_clients_markets.sql` (after 0002).

- **Clients**: each doctor or law firm the agency manages has a profile — type, specialty, market, audience, voice/account notes, tone, language, name/handle/logo, template, colours and an optional branded background. Starting a post from a client fills everything in, and their notes go to the AI on every post.
- **International markets**: US, UK, Canada, Australia, UAE, Singapore, India, Global. Market drives news and YouTube region, spelling, currency, local context (NHS vs CDC, state vs federal law) and advertising rules (ABA 7.1–7.3, SRA, GMC/ASA, AHPRA, SMC, BCI Rule 36 for India only).
- **1–7 slides**: single-image posts, 2-slide hook + payoff, 3-slide, and full carousels — prompts and structure adapt.
- **Import template**: (1) match a design from a screenshot (colours extracted in the browser, closest layout picked), (2) branded background image drawn under every slide with an adjustable text margin, (3) EditSimple `.json` template files — plus "Export current look as a file".
- **Typography**: UI is now Geist throughout (the serif display face is retired, including the Editorial template).
- **Unit tests**: `npm test` (Vitest) — 62 tests across research parsing, trends, palette/template import, schemas, slide structure, market-aware prompts, LLM fallback and slide rendering.
