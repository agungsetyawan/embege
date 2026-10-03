# Changelog

This changelog (dated list of changes) records each change to the MBG poisoning map app. A district (kabupaten or kota area) is the second level of local government in Indonesia. Enrichment (AI summary and district step) fills each pending item before human review.

## 2026-10-03

The team released the following changes:

- Added CSV and JSON downloads of all published cases, linked from the home footer.
- Added a static page per district at /wilayah/[slug] with its case list and a link to the map.
- Listed the district pages that have cases in the sitemap.
- Showed extra news sources per case, from curator-approved items and auto-rejected duplicates.
- Fixed the missing top-border reset on the first case in the case list.
- Added Otomatis and Manual tabs to the admin Ditolak page so items rejected by an admin are listed too.
- Showed separate auto and manual rejected counts on the Ditolak sidebar badge.
- Showed the summary, region, victims, school, and SPPG on rejected items in the same order as the queue.
- Retried the article fetch up to three times, an hour apart, for queued items enriched from the RSS snippet only.

## 2026-10-02

The team released the following changes:

- Locked the admin cases table column widths so only the summary column stretches, keeping the summary and region columns resizable.

## 2026-10-01

The team released the following changes:

- Added manual crawl and enrich triggers to the admin queue as an expandable FAB with a per-button cooldown.
- Showed pipeline results as updatable toasts with the raw JSON response.
- Extracted the event date from article text via the curator model and prefilled the queue date field with it, falling back to the publish date.
- Moved the Terhapus queue tab into the admin sidebar as a shortcut to the /admin/cases deleted filter.
- Showed only the district name in the region picker trigger of the edit case dialog and the curation queue.
- Switched the school and SPPG fields to two-line text areas so multi-school values stay visible.
- Capped the edit case dialog height to the viewport with scrolling and renamed its title to Ubah kasus.
- Toggled the active sort direction when clearing sorting in the admin cases table.

## 2026-09-30

The team released the following changes:

- Sent the new item's publish date to the duplicate checker so the model can compare event dates.
- Defined the summary, region, confidence, and reject-reason fields in the curator prompt.
- Clarified the dedup prompt on victim-count updates, re-reports without new info, and mandatory reasons.

## 2026-09-29

The team released the following changes:

- Added a preconnect hint for the Esri tile host to shorten map tile connection setup.
- Mounted the map shell before case data resolves to cut the mobile LCP delay.
- Made the stats strip full-bleed on mobile with edge-to-edge horizontal scrolling.

## 2026-09-28

The team released the following changes:

- Switched the crawl decode cap from a fixed count to a time budget and requeued stale pending items that still pointed at Google News links.
- Placed the source link on the same row as the Report and Share buttons with truncation for long media names.
- Moved the school and SPPG names above the case summary and promoted them to full text while muting the summary.
- Scoped the region chart to the selected week, month, or year bucket.
- Added an all-time default option to the region chart bucket filter.
- Switched the statistics view switcher to the underline tabs style.

## 2026-09-27

The team released the following changes:

- Replaced the admin top navigation with a ReUI sidebar carrying queue count badges.
- Showed the active queue count in the admin breadcrumb.
- Made the admin topbar sticky on scroll.
- Replaced the cron logs list with a ReUI data table.
- Reshaped the admin queue loading skeleton to mirror the filter grid and curation item layout.
- Reshaped the cases loading skeleton to mirror the filter grid and data table.
- Added matching loading skeletons for the admin logs and settings pages.
- Applied a lime-green and pink palette with green-for-case and pink-for-victim coding.
- Blended the map severity into a yellow-to-red gradient with a vertical hover legend.
- Added a top-10 region chart with province and district level toggles to the timeline dialog.
- Guarded the region aggregation against stale cached payloads missing per-area case counts.
- Renamed the Linimasa dialog to Statistik to cover the list, trend, and region views.

## 2026-09-26

The team released the following changes:

- Resolved Google News redirect links to publisher URLs at crawl time so enrichment fetches full article text.
- Requeued stale pending items and regenerated summaries for cases still on Google News links.
- Recorded whether each enrichment used the full article or fell back to the RSS snippet.
- Showed a Dari RSS badge on admin queue items summarized from the RSS snippet.

## 2026-09-25

The team released the following changes:

- Added an admin cron logs page backed by pg_net responses.
- Added a backfill script (repeat run over stored rows) that regenerates case summaries, school names, and SPPG names.
- Added a MapPin icon and improved button accessibility in MonthGrid.
- Updated the User-Agent and request headers for article fetching.
- Improved case display with icons for school and SPPG names.
- Replaced district boundaries and centroids with BIG September 2023 data.
- Fixed misplaced markers in East Java cities, Gresik, Batu, Sampang, and Sumenep.
- Kept the centroid_ok flag false for nine archipelagic districts pending manual review.
- Shrunk the districts GeoJSON from 910KB to 708KB.

## 2026-09-24

The team released the following changes:

- Made article fetch limits configurable through the app_settings table.
- Documented school and SPPG extraction in the README and in AGENTS.
- Extracted school and SPPG names in AI enrichment.
- Sorted admin cases by newest occurred_on date, then by created_at.
- Added debounced search and a district filter to the admin queue.
- Fixed calendar and region picker layering above the edit case dialog.
- Applied queued updates to published cases with one click.
- Used data-grid style numbered pagination for the admin queue.
- Made the admin header sticky.
- Skipped identical headlines at crawl time and rejected canonical duplicates in enrichment.
- Auto-rejected duplicate news against published cases in enrichment.

## 2026-09-20 to 2026-09-23

The team released the following changes:

- Crawled Google News RSS per keyword instead of outlet feeds.
- Moved @types/leaflet to devDependencies.
- Removed padding from the Indonesia map skeleton placeholder.
- Dropped FitToCases auto-fit and kept the Indonesia-wide initial view.
- Rebuilt the home page with a split layout that puts the map first, with distinct mobile and desktop variants.

## 2026-09-19

The team released the following changes:

- Dropped the old stats-cards dialog after the move to the map.
- Synced the README for the Linimasa pill and the timeline endpoint.
- Moved the poisoning-days dialog from the stats card to the Linimasa pill on the map.
- Added a chronological trend chart to the poisoning history dialog.
- Synced README features and fixed the ReUI list in AGENTS.
- Added a period filter to the poisoning history dialog.

## 2026-09-17 to 2026-09-18

The team released the following changes:

- Adjusted padding in the region detail drawer for a consistent layout.
- Used a persistent search bar style on the map.
- Updated the font family to Plus Jakarta Sans in globals and layout.
- Added an icon-only district share button to the drawer header.
- Replaced zoom buttons with a ButtonGroup for an improved layout.
- Fixed map card height shift when region search opens.
- Grouped case actions in a ReUI button group.

## 2026-09-16

The team released the following changes:

- Installed Vercel Web Analytics.
- Removed unused Badge and ThemeToggle components from the home page.
- Fixed the z-index for IconTile in the region search component.
- Deep-linked timeline areas to highlighted cases with per-case share links.
- Updated the planned work section with details for vector tiles and the X crawler.
- Translated Indonesian identifiers and comments to English.
- Opened the search drawer after map flight with polygon-aware zoom.
- Noted the map expand mode and portal lessons in the docs.
- Replaced native fullscreen with a pseudo-fullscreen map mode.
- Added a map toolbar with fullscreen, a theme-aware basemap, and collapsible attribution.
- Updated the README with API endpoint descriptions and feature details.
- Fixed iOS Safari auto-zoom on the map search input.
- Added guidelines for large files and code-splitting.
- Split indo-map into focused modules with drawer code-splitting.
- Improved RegionSearch accessibility and layout.
- Added custom ReUI map zoom and search controls.
- Grouped map region search by province across all 514 regions.

## 2026-09-13 to 2026-09-14

The team released the following changes:

- Covered the cases table, audit trail, and installed ReUI set in the docs.
- Added an admin cases table with an actor audit trail.
- Isolated enrichment per article with parallel Gemini calls and dropped batch mode.
- Batched the enrich cron into a single Gemini call with parallel fetch and updates.
- Updated the badge label and improved footnote message clarity.
- Adjusted the height of map components.
- Added loading feedback for navigation and slow data.
- Shortened admin button labels.
- Used an Indonesia silhouette for the map loading skeleton.
- Added a dynamic Open Graph image with live stats and a map watermark.
- Trimmed timeline helpers and dialog columns.
- Made StatsCards a server component with ISR caching.
- Added a click handler to GeoJSON for region selection.
- Replaced Dialog with Drawer for report submission and improved form fields.
- Added a RegionPreview component and improved case details display with icons.
- Implemented a Drawer component and a useMediaQuery hook.

## 2026-09-12

The team released the following changes:

- Removed unused Autocomplete, Timeline, and Avatar components.
- Renamed the admin auto-reject tab URL slug to rejected.
- Aligned the README and AGENTS with the UI rebuild.
- Documented public case reports and soft delete.
- Added public case correction reports with an admin review queue.
- Rebuilt stats cards with Card composition and status badges.
- Fixed wording in the description of poisoning cases.
- Used the Skeleton component for the loading state in IndoMapLazy.
- Removed the header from the admin login page and cleaned up the layout.
- Added an editorial public page, a compact KPI strip, a case sheet, and a unified admin navigation.
- Rebuilt the UI with ReUI and moved to Base UI.
- Dimmed the map area outside Indonesia to highlight districts.
- Removed redundant text in victims display.
- Simplified day counter logic.
- Added day counters with a per-date timeline dialog.
- Translated code comments to English.
- Added language guidelines for identifiers and user-facing text.
- Updated metadata and Open Graph details for consistent branding.
- Hardened public and admin input boundaries and added security headers.
- Added react-leaflet-cluster for map marker clustering.
- Added structured data, Open Graph tags, and a manifest for metadata and SEO.

## 2026-09-11

The team released the following changes:

- Excluded graphify-out in biome.json.
- Replaced Button with SubmitButton in AdminPage, PendingItem, RejectedItem, and SettingsPage for improved form handling.
- Moved action buttons to CardFooter in PendingItem and RejectedItem.
- Added the llm_victims field to enrichment and updated related components.
- Added restore for rejected items in the admin page.
- Improved data fetching setup in IndoMap and QueryProvider.
- Added a sheet component and showed case details in IndoMap.
- Improved layout and spacing in PendingItem.
- Added pagination and a total item count to the admin page.
- Adjusted CircleMarker radius calculation for visibility.
- Added FitToCases to fit the map view to active case regions and updated TileLayer attribution.
- Added region-specific case queries and case summaries in IndoMap.
- Fixed case query ordering for correct data retrieval.
- Documented runtime, data, map, UI, and LLM components in the AGENTS tech stack section.
- Added a date selection component and calendar UI and updated dependencies.
- Documented project conventions for environment variables, cron, database, LLM, UI, and verification in AGENTS.
- Documented the project overview, features, tech stack, and deploy steps in the README.
- Rebuilt the UI with shadcn, added dark mode and natural labels, and used Lucide icons.
- Improved the admin configuration page with new UI components and a theme toggle.
- Added source and keyword management to the configuration page.
- Displayed cases by region with victim details in IndoMap.
- Removed unused SVG files from public.
- Added an API for cases and regions and updated headers in next.config.
- Added cheerio for article text extraction and built configuration management.

## 2026-09-10

The team released the following changes:

- Removed the Vercel configuration file.
- Initialized the project.
- Created the app from Create Next App.
