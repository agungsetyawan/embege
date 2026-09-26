# MBG Poisoning Map Indonesia

A map dashboard that tracks food poisoning cases linked to the MBG school meal program across Indonesia. A crawler collects news from credible outlets every hour. An admin reviews each item before it appears on the public map.

Production: https://embege-poisoning.vercel.app

## Features

The public map shows case counts per district (a district is a kabupaten or kota, the second level of local government). Markers group all cases in one district, and nearby markers cluster by zoom level. Clicking a marker opens a side sheet that lists each case with its date, victim count, school and SPPG names when known, and source link. A search bar on the map opens a province-grouped picker covering all 514 districts; picking a district flies the map there and opens the same side sheet, with a case-count badge on districts that have cases. The page supports dark mode. The map has an expand button for a full-viewport view, and the gray basemap follows the light or dark theme. A Linimasa pill on the map opens a dialog of poisoning days with a Mingguan/Bulanan/Tahunan period filter and a Daftar/Grafik view toggle; the Grafik tab shows the chronological bar trend of cases or victims per period. Clicking a district in an expanded day closes the dialog, flies the map to that district, and highlights that date's cases in the side sheet. The drawer header has an icon-only share button for the district link (`?region_id=`), and each case in the side sheet has a Bagikan button that adds `date=` to highlight that date's cases; opening either link reproduces the same flight and highlight.

The crawler runs one Google News RSS search per active keyword every hour (last 3 days, Indonesian edition). It filters items by keyword and stores matches for review. Google News redirect links are resolved to publisher URLs at crawl time (the feed link stays in `raw_url`); unresolvable links keep the Google URL. Duplicate URLs never create a second row. Items with an identical normalized headline are also skipped (earliest published kept), and articles sharing a canonical URL are auto-rejected during enrichment without an LLM call.

The admin dashboard lists pending items with an AI summary, a location guess, and school/SPPG guesses for each item. A debounced search box and a district filter narrow the queue across the Antrean, Ditolak, Laporan, and Terhapus tabs. The admin picks the district, edits the summary, school, and SPPG, then approves, rejects, or — for duplicate-flagged items — applies it as an update to the linked published case. Approved items appear on the public map. A separate `/admin/cases` page lists all cases in a filterable table where the admin can edit, soft-delete, and restore rows; each row links its per-case action history.

Anyone can report a wrong victim count or a wrong date on a published case from a dialog on the map. Reports are anonymous. The submit endpoint runs an invisible bot check, a honeypot field, and an hourly per-case rate limit. The admin reviews reports in a Laporan tab and can apply the suggested values, move the case to another district, or soft-delete a reported duplicate. Soft-deleted cases stay recoverable in a Terhapus tab.

The enrichment step calls the Gemini API for pending items. It writes a short neutral summary, a district guess with a confidence score, and the school and SPPG names mentioned in the article (verbatim, null when absent, never guessed). The code checks the guess against the district table and drops guesses that do not match. It then compares the item against published cases in the same district and date window; same-event news is auto-rejected at high confidence, while suspected victim-count updates stay queued with a duplicate badge. Failures fall back to the RSS snippet and the text match. Each run records whether the LLM saw the full article or only the snippet (`enrich_source`, `fetched_len`); snippet-based items carry a Dari RSS badge in the admin queue.

The settings page edits keywords, batch size, and cron schedules without a new deploy.

## Tech Stack

The list below names each layer and its role:

- Next.js 16 App Router for the web app and the API routes
- Supabase Postgres for data, auth, scheduled jobs, and secret storage
- TanStack Query for client data cache
- Leaflet and react-leaflet-cluster for the map
- shadcn/ui components on the Base UI generation, ReUI components for admin surfaces, and Tailwind CSS v4 for the interface
- Recharts for the bar trend chart in the poisoning-days dialog
- Gemini API for summaries and location guesses
- Cheerio for article text extraction
- Vercel BotID for the invisible bot check on the public report endpoint
- Vercel Web Analytics for page-view tracking

## How It Works

News flows through five stages:

1. The crawl job runs at minute 0 of each hour. It runs one Google News search per active keyword, filters by active keywords, resolves feed links to publisher URLs (capped per run with a delay between calls to stay inside the 60-second budget), and inserts matches into `crawl_items` with status `pending`.
2. The enrich job runs on its schedule every few minutes. It takes up to five pending items without a summary, fetches each article page, and calls Gemini up to twice per item (enrichment, plus a duplicate check when published candidates exist).
3. The admin opens `/admin`, checks each item, and approves or rejects it. Approval creates a row in `cases`, or updates the linked published case for applied updates (superseded older siblings auto-reject).
4. The public map reads published cases from `GET /api/cases`. The response stays cached for five minutes.
5. New approvals appear on the map within five minutes.

Visitors can also report a wrong count or date on any published case. The report lands in the admin Laporan tab for review.

Two pg_cron jobs drive the schedule. The secret lives in Supabase Vault. The jobs call the Next.js endpoints with that secret.

## Getting Started

You need Node.js 20 or later, npm, and a Supabase project.

1. Clone the repo and run `npm install`.
2. Copy the variables below into `.env.local`. The file is ignored by git. Do not commit it.
3. Run `npm run dev` and open http://localhost:3030.
4. Create one admin user in the Supabase dashboard under Authentication, then sign in at `/admin/login`.
5. Turn off public sign-ups in the Supabase dashboard under Authentication providers. Only the admin signs in.

## Environment Variables

The table below lists each variable, its source, and its scope:

- `NEXT_PUBLIC_SUPABASE_URL`: Project Settings, API in Supabase. Public.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Project Settings, API in Supabase. Public.
- `SUPABASE_SECRET_KEY`: Project Settings, API in Supabase. Server only.
- `GEMINI_API_KEY`: Google AI Studio. Server only.
- `CRON_SECRET`: Generate it with `openssl rand -hex 32`. Server only. It must match the secret stored in Supabase Vault under the name `crawl_cron_secret`.

## Database Schema

The schema has eight tables:

- `regions`: 514 districts with province, centroid coordinates, and a `centroid_ok` flag. Boundaries and centroids come from BIG September 2023 data; each marker sits on the district's largest island. The flag is false for 9 archipelagic districts where the largest island holds under 40 percent of the area. Those districts need manual coordinate checks.
- `crawl_sources`: legacy table, no longer read by the crawler (kept for history).
- `crawl_keywords`: filter words with active flag. Words of five letters or fewer match whole words only. Longer words match substrings.
- `crawl_items`: raw crawl results with status `pending`, `approved`, or `rejected`, plus AI summary, guessed district, confidence score, school/SPPG guesses (`llm_school`, `llm_sppg`), duplicate hints (referenced case, confidence, reason), headline hash, canonical URL hash, the original feed link (`raw_url`), and the enrichment text source (`enrich_source`, `fetched_len`).
- `cases`: approved public cases linked to a district, with optional school (`school`) and SPPG (`sppg`) names. A soft delete through `deleted_at` hides a case from the map without removing the row. `updated_at` and `updated_by_email` record the last admin edit.
- `admin_audit_log`: append-only trail of every admin write (actor, action, row, before/after diff) for multi-admin accountability. Authenticated admins only.
- `case_reports`: public correction reports per case, with a reason, suggested values, and a status of `open`, `resolved`, or `dismissed`.
- `app_settings`: runtime configuration such as batch size and cron schedules.

Row Level Security allows public reads of `regions` and published `cases` only. The public writes only through the `submit_case_report()` function, which validates the target case and allows one report per case per visitor per hour. Every other write needs an authenticated admin user. The `apply_cron_schedules()` function reads the schedule keys and updates both cron jobs. It rejects schedules that are not valid five-field cron strings.

## API Contract

The app exposes five JSON endpoints:

- `GET /api/cases`: public. Without params it returns the per-region summary of all 514 districts ordered by province and district, including zero-case rows used by the markers and the search picker. With `?region_id=` it returns that district's published cases. The response carries `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.
- `GET /api/timeline`: public. It returns the per-day timeline of poisoning days (case and victim counts with districts per date) used by the Linimasa dialog on the map. The response carries `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.
- `POST /api/reports`: public. It stores a correction report for a published case after a bot check. It returns 201 on success, 400 for invalid input, 403 for bots, and 429 when the same visitor already reported the case within an hour.
- `GET /api/cron/crawl`: needs `Authorization: Bearer <CRON_SECRET>`. It runs one Google News search per active keyword and returns counts of keywords, fetched items, new rows, and resolved publisher URLs.
- `GET /api/cron/enrich`: needs `Authorization: Bearer <CRON_SECRET>`. It enriches pending items and returns counts of processed, enriched, auto-rejected, duplicate-rejected, and failed items.

The `/admin` pages need a signed-in admin. They use Server Components and Server Actions. No browser code talks to Supabase with write access.

## Scripts

The list below describes each npm script:

- `npm run dev`: starts the dev server on port 3030.
- `npm run build`: creates the production build.
- `npm run start`: serves the production build on port 3030.
- `npm run lint`: runs Biome checks.
- `npm run format`: rewrites files with Biome formatting.

## One-off Scripts

- `npx tsx scripts/backfill-summaries.ts`: regenerates `cases.summary`, `school`, and `sppg` with the current curator prompt. It never touches `victims`, `occurred_on`, or `region_id`. Back up `cases` first. Useful flags: `--dry-run --limit=10` to preview, `--retry-report=PATH` to rerun failed rows, `--fallback-report=A,B` to rerun rows that previously fell back to stored text.

## Deployment

The app runs on Vercel. Set the five environment variables in the Vercel dashboard. The cron jobs run in Supabase, not in Vercel, because the Vercel Hobby plan limits cron frequency.

After deploy, point both pg_cron jobs at the production URL and test each endpoint with the secret. If the domain changes later, update the two job definitions and test again.

## Troubleshooting

The list below pairs each known problem with its fix:

- Map shows "failed to load" in the browser with an env error: client code reads `process.env.NEXT_PUBLIC_*` through a fixed name only. A helper that takes the name as a variable breaks the build-time replacement. Use the fixed name.
- Gemini returns 404 for a model name: the model retired for new accounts. List models with `GET /v1beta/models`, then pin a working flash model in `src/lib/enrich.ts`.
- A cron job fails with "function does not exist": `pg_net` lives in the `net` schema, not in `extensions`. Call `net.http_get`.
- A cron HTTP call times out at five seconds: the crawl takes longer. Set `timeout_milliseconds` to 60000 in the job definition.
- A district marker sits in the wrong place: its `centroid_ok` flag is false. Fix the coordinates with one `UPDATE` on `regions`.
- An article fails to fetch with 403: the outlet rejects non-browser clients. `fetchArticleText` in `src/lib/enrich.ts` must keep its browser-compatible headers.

## Backlog

The list below holds planned work:

- Vector tiles when the boundary file grows too large for a single download (one PMTiles file on Supabase Storage, no tile server needed)
- X/Twitter crawler when API access exists (X API access is paid, so this stays on hold)

## License

All rights reserved.
