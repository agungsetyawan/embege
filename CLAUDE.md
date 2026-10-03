# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

**Large files**
- Past ~500 lines or 3+ responsibilities, split into a folder (`types`, `api`, one module per concern) with a thin `index` shell. Keep the public import path unchanged.
- Code-split below-the-fold content (`next/dynamic`): drawers, dialogs, and secondary views stay out of the first-paint chunk. One split boundary per lazy subtree, no nested dynamics.
- Memo (`useMemo`/`useCallback`) only when the computation is expensive or a memoized consumer needs stable identity. Otherwise it is ceremony, cut it.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Project Conventions (MBG SIG)

Lessons already paid for in debug time. Follow them.

**Env vars**
- In browser code, read `process.env.NEXT_PUBLIC_*` with a fixed name only. A helper that takes the name as a parameter breaks the build-time replacement and throws at runtime.

**Cron**
- Cron runs in Supabase (`pg_cron` + `pg_net`), not in Vercel. `pg_net` lives in the `net` schema, not `extensions`.
- Cron endpoints must be idempotent (`url_hash` dedup) and answer in under 60 seconds. Cap enrich batch size via `app_settings.enrich_batch` (enrich makes up to 2 Gemini calls per item, so the batch sizes the 60-second budget).
- Google News redirects resolve at crawl, never at enrich (2 extra requests per URL would blow the 60-second budget). Crawl decodes inside a per-run time budget with a delay between calls; a failed decode keeps the feed link and never fails the run, and pending items skipped by the budget are retried on later runs (enrichment columns are cleared so they enrich again with full text). The decode targets Google's internal RPC and can break without warning — symptom is `decoded:0` with rising `enrich_source='rss'`.

**Database**
- RLS: public reads `regions` and published `cases` only. Public writes go only through the `submit_case_report()` RPC (1 report per case per IP per hour). Every other write needs an authenticated admin.
- Public server-side reads use `createAnonClient` (anon key, no cookies) so the route stays static/ISR. The cookie-based `createClient` is for admin/session paths only — `cookies()` forces the route dynamic and kills caching.
- Public server-side queries use the anon key so RLS still applies. Service-role is for cron only.
- `cases.deleted_at` is a soft delete: hidden from all public reads and the `case_summary` view, restorable from the admin Terhapus entry (`/admin/cases?status=deleted`).
- Every admin Server Action that writes to the database must record the actor via the `log()` helper returned by `requireAdmin()` into `admin_audit_log`. Logging is best-effort and never fails the action.
- `centroid_ok=false` means coordinates are unverified. Never treat them as facts.
- Keywords of five letters or fewer match whole words only. Longer ones match substrings.

**LLM**
- Pin the working Gemini model name in `src/lib/enrich.ts`. Models retire without warning.
- Validate every LLM output against the `regions` table before saving. Drop what does not match.
- Duplicate auto-reject needs confidence >= 0.9 and never fires on victim-count updates (`is_update` stays queued with a badge). Identical normalized headlines are skipped at crawl (`title_hash`, earliest kept); canonical URL collisions reject without an LLM call.
- Applied updates link the item to the existing case (`approved` + `case_id`, no new row), auto-reject older pending siblings, and only fill an empty `occurred_on`.
- `school`/`sppg` are verbatim from the article (several joined with `'; '`, max 500 chars), `null` when not mentioned explicitly — never guessed. Applied updates carry them over (`?? target`), same as victims.
- Human curation stays required before anything publishes.
- `fetchArticleText` uses browser-compatible request headers. Some outlets reject non-browser clients with 403 — never simplify it back to a single header.
- `enrich_source='rss'` (Dari RSS badge) means the LLM only saw the snippet, not the article — treat it as thin curation. The batchexecute decode needs exact form-urlencoded headers or Google answers 400 — never simplify them either.

**Language**
- Identifiers and code comments in English. User-facing strings (UI copy, aria-labels, metadata, LLM prompts) stay in natural Indonesian.
- `district` means kabupaten/kota (second-level region). Never `city` (kota-only) or `regency` (kabupaten-only).

**UI**
- shadcn-style primitives in `src/components/ui`, tokens in `globals.css`. Admin routes are Server Components + Server Actions. Admin surfaces use ReUI (Frame for curation flows, data-grid for the `/admin/cases` table).
- Labels in natural Indonesian, Lucide icons only (no emoji, no text arrows, no em dashes in UI copy).
- Fullscreen API does not exist on iPhone Safari (`requestFullscreen` is undefined). Use CSS pseudo-fullscreen (fixed inset-0 card) instead of feature-detect plus prefix.
- Base UI portals mount to `document.body`, so they vanish inside a fullscreen subtree. Pass `container` to mount them inside, or wrap in an outer portal: a nested portal without `container` resolves to the parent portal node.
- Hover-reveal bubbles inside the map card (`group-hover:visible`) must be `absolute`: an `invisible` element still occupies layout space and will block clicks on overlapping controls (paid for by the attribution note covering zoom-out).
- Deep links drive the map through `?region_id=&date=`: validate with `isUuid`/`isDateString`, ignore invalid params, and clear both params when the drawer closes.
- The forwarded `MapContainer` ref only resolves a commit after mount. Never gate a flight on it; report readiness with a `useMap()` probe inside the container instead.
- shadcn primitives need their theme tokens in `globals.css` or they render unstyled: the sidebar ships `bg-sidebar`/`text-sidebar-foreground` classes that resolve to nothing without the `--sidebar-*` vars (paid for by the transparent mobile Sheet).
- Never install a duplicate hook from a registry when one exists: `use-mobile.ts` is only a name alias over the existing `use-media-query` hook because `ui/sidebar` imports that name.
- Interval countdowns must force one final state update on expiry, otherwise the label sticks at the last second (paid for by the FAB cooldown stuck at 1).

**Changelog**
- Keep `CHANGELOG.md` current: one dated section per release (newest first), one bullet per change, one short past-tense sentence per bullet, entries in plain English.
- Follow the existing entries as the pattern. Never rewrite past sections, only add new ones on top.

**Verification bar**
- `npm run lint` and `npm run build` stay green. Check browser output with chrome-devtools (clean console plus screenshot). Test cron endpoints with and without the secret.
- Lint runs on Biome (`npm run lint`), never `rtk lint`: the rtk wrapper assumes ESLint and this repo has no ESLint config, so it fails with a JSON parse error (paid for by the repeated lint loop).

## 6. Tech Stack (pinned)

# agent-skills

This is the agent-skills project — a collection of production-grade engineering skills for AI coding agents.

> **Scope:** This file configures agents working on the [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) repository itself, not other projects. Don't copy it into another project or a global agent configuration; the reusable assets are the skills in `skills/`.

## Project Structure

```
skills/       → Core skills (SKILL.md per directory)
agents/       → Reusable agent personas (code-reviewer, test-engineer, security-auditor, web-performance-auditor)
hooks/        → Session lifecycle hooks
.claude/commands/ → Slash commands (/spec, /plan, /build, /test, /review, /code-simplify, /ship; plus /webperf specialist audit)
references/   → Supplementary checklists (testing, performance, security, accessibility, observability)
evals/        → Skill eval cases + framework (see evals/README.md)
docs/         → Setup guides for different tools
```

## Skills by Phase

**Define:** interview-me, idea-refine, spec-driven-development
**Plan:** planning-and-task-breakdown
**Build:** incremental-implementation, test-driven-development, context-engineering, source-driven-development, doubt-driven-development, frontend-ui-engineering, api-and-interface-design
**Verify:** browser-testing-with-devtools, debugging-and-error-recovery
**Review:** code-review-and-quality, code-simplification, security-and-hardening, performance-optimization
**Ship:** git-workflow-and-versioning, ci-cd-and-automation, deprecation-and-migration, documentation-and-adrs, observability-and-instrumentation, shipping-and-launch

## Conventions

- Every skill lives in `skills/<name>/SKILL.md`
- YAML frontmatter with `name` and `description` fields
- Description starts with what the skill does (third person), followed by trigger conditions ("Use when...")
- Every skill has: Overview, When to Use, Process, Common Rationalizations, Red Flags, Verification
- Shared references are in the root `references/` directory; the emerging convention for self-contained, distributable skills keeps a skill's own references inside `skills/<name>/references/`
- Supporting files only created when content exceeds 100 lines

## Contributing

Before adding a new skill or significantly reworking an existing one, run the pre-flight checks in [CONTRIBUTING.md](CONTRIBUTING.md#before-proposing-a-new-skill): search the catalog, check open PRs, confirm the idea fits [docs/skill-anatomy.md](docs/skill-anatomy.md), and justify the gap. Prefer extending an existing skill over adding a near-duplicate. CONTRIBUTING.md is the single source of truth for this workflow; do not restate its checklist here or elsewhere, link to it.

## Commands

- `npm test` — Not applicable (this is a documentation project)
- Validate: Check that all SKILL.md files have valid YAML frontmatter with name and description
- Evals: `node scripts/run-evals.js` — trigger/routing evals for every skill (CI); `--behavioral <skill>` for graded runs

## Pull Requests

PRs target the upstream repository's default branch. In a typical fork setup the upstream remote is `upstream` and your fork is `origin`, but the exact remote names are not what matters here.

- Before opening a PR, search the upstream repository's open PRs and issues for work that touches the same files or rules. If any overlaps, coordinate (build on it, align your rules with it, or rebase after it merges) instead of opening a conflicting PR.
- Prefer small, focused PRs over large refactors of widely shared files (for example, files under `scripts/`), which are more likely to collide with in-flight work.

## Boundaries

- Always: Run the CONTRIBUTING.md pre-flight checks before creating a new skill directory
- Always: Follow the skill-anatomy.md format for new skills
- Always: Check the upstream repo's open PRs and issues for overlap before opening a new PR
- Never: Add skills that are vague advice instead of actionable processes
- Never: Duplicate content between skills — reference other skills instead

# graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
