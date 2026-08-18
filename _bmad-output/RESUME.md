# Resume Point — local-food BMad session

**Load this file first in a fresh conversation.** Written 2026-08-18, mid-session pause requested by user.

## Two active tracks, two branches

### Track A: `epics-and-stories` branch (Admin & Inventory Expansion)

Full BMad chain complete: PRD (`_bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/prd.md`, final) → Architecture (`_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md`, final, 9 ADs) → Spec (superseded by direct epics/stories flow, not used downstream) → Epics/Stories (`_bmad-output/planning-artifacts/epics.md`, 3 epics, 11 stories, all approved).

**PR open:** https://github.com/roadbike9000/local-food/pull/2 (epics-and-stories → main)

**Sprint tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Story 1.1** (verify cart removal/total) — `status: review`. Implemented, code-reviewed (Opus), fixes applied and pushed. Effectively done, just needs a final "approve and move on" or another review pass if you want one.

**Story 1.2** (stock quantity: creation, backfill, editing) — `status: review`. **THIS IS THE PAUSE POINT.** Implemented (migration, `src/lib/inventory.ts`, new PATCH endpoint, new UI), pushed at commit `fc05050`. Independent Opus code review just landed in the story file's `### Review Findings` section and in `deferred-work.md`, with:
- **2 decision-needed items requiring your input** (not yet resolved):
  1. `PLACEHOLDER_LOW_STOCK_THRESHOLD = 0` is indistinguishable from a vendor deliberately choosing 0 — breaks Story 1.6's placeholder-detection premise. Needs a design call (e.g. a separate `thresholdIsPlaceholder` boolean, or a different sentinel value) before Story 1.6 can be built correctly.
  2. The one E2E test for the edit feature (AC #4/#5) is a tautology — passes even with the endpoint deleted, because it asserts a controlled `useState` value that survives `router.refresh()` regardless of server response. Real verification of "editing actually works" is currently zero.
- **12 patch-level bugs** documented in the story file (409 silently drops the threshold edit + infinite retry loop, integer-overflow 500, empty-input writes `0` unvalidated, etc.)
- **2 deferred items** in `deferred-work.md` (ABA race in `setStock()`, needs a `version` column — push to Story 1.4; and the stale Clerk auth fixture, now blocking 15 e2e tests, flagged as a growing bottleneck before Epic 2 starts)

**Next action when resuming:** read the story file's `### Review Findings` section in full (`_bmad-output/implementation-artifacts/1-2-stock-quantity-captured-at-creation-backfilled-for-existing-products.md`), decide how to handle the two decision-needed items and which patches to apply now vs. defer, then continue `dev-story` to address them (story status will need to go back to `in-progress` while fixing, per the dev-story workflow's review-continuation handling — it auto-detects the `### Review Findings`/action-items section and prioritizes those tasks).

**After Story 1.2 is truly done:** repeat the same pipeline (`bmad-create-story` → `bmad-testarch-atdd` → `bmad-dev-story` → `bmad-code-review`, one subagent dispatch each with `model: opus` for the review step) for Stories 1.3 through 1.6, then Epic 2 (Stories 2.1–2.3), then Epic 3 (Stories 3.1–3.2). `sprint-status.yaml` tracks exactly which is next (`create-story` auto-discovers the first `backlog` story).

### Track B: `vendor-application-prd` branch (Vendor Application & Monetization)

PRD only (`_bmad-output/planning-artifacts/prds/prd-local-food-2026-08-16/prd.md`, final, pushed). Nothing downstream started.

**Next action when resuming:** decide whether to run `bmad-ux` first (optional — this PRD has real UI: application form, status page, disclosure page) or go straight to `bmad-architecture` (required next gate, same coaching-path treatment as the other PRD got).

## Working agreements established this session (also saved to persistent memory, but repeating here for a fresh-context resume)

- **Git workflow for implementation work:** branch → commit at each meaningful checkpoint (not just at the end) → test → merge. Don't wait to be asked each round.
- **Review content in a file, not chat:** write drafts to the actual output file first, then point the user there — don't dump long content in a chat message before it's saved anywhere.
- **Code review uses a different model than implementation** (Opus reviewing Sonnet's work) — dispatch via the `Agent` tool with `model: "opus"`, instruct it to invoke the `bmad-code-review` skill itself.
- User is in **caveman mode (full)** — terse responses, articles/filler dropped, except code/commits/security stay normal prose.

## Key file index

- PRD 1 (final): `_bmad-output/planning-artifacts/prds/prd-local-food-2026-08-10/prd.md`
- PRD 2 (final): `_bmad-output/planning-artifacts/prds/prd-local-food-2026-08-16/prd.md`
- Architecture spine (final, 9 ADs): `_bmad-output/planning-artifacts/architecture/architecture-local-food-2026-08-10/ARCHITECTURE-SPINE.md`
- Epics/stories (3 epics, 11 stories): `_bmad-output/planning-artifacts/epics.md`
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Story files: `_bmad-output/implementation-artifacts/{epic}-{story}-{slug}.md`
- Deferred work log: `_bmad-output/implementation-artifacts/deferred-work.md`
- ATDD checklists: `_bmad-output/test-artifacts/atdd-checklist-*.md`
