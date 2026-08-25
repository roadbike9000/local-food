---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-08-25'
storyId: '5.2'
storyKey: '5-2-pickup-slot-creation-rejects-a-past-start-time'
storyFile: '_bmad-output/implementation-artifacts/5-2-pickup-slot-creation-rejects-a-past-start-time.md'
atddChecklistPath: '_bmad-output/test-artifacts/atdd-checklist-5-2-pickup-slot-creation-rejects-a-past-start-time.md'
generatedTestFiles:
  - 'src/app/api/pickup-slots/schema.test.ts'
  - 'tests/dashboard.spec.ts'
inputDocuments:
  - '_bmad-output/implementation-artifacts/5-2-pickup-slot-creation-rejects-a-past-start-time.md'
  - 'src/app/api/pickup-slots/schema.ts'
  - 'src/app/api/pickup-slots/route.ts'
  - 'src/app/api/pickup-slots/schema.test.ts'
  - 'src/components/dashboard/AddSlotForm.tsx'
  - 'tests/dashboard.spec.ts'
  - 'tests/helpers/db.ts'
  - 'playwright.config.ts'
  - 'project-context.md'
---

# ATDD Checklist: Story 5.2 — Pickup slot creation rejects a past start time

## Step 1: Preflight & Context

- **Detected stack:** frontend (Next.js App Router, Playwright configured; no backend-only manifest) — same detection as every prior story in this project.
- **Framework:** Playwright for the direct-API-call path, Vitest for `CreateSlotSchema`'s pure validation logic — small, schema-only story, same split precedent as Story 4.1/5.1.
- **Prerequisites met:** story has 2 clear ACs, `ready-for-dev`; `playwright.config.ts`/`vitest.config.mts` configured; dev environment available.
- **Playwright Utils:** `tea_use_playwright_utils: true` in config, no `playwright-utils` package present — plain `@playwright/test` patterns, same gap as every prior story.
- **Real prior art found and reused, not rebuilt:**
  - `tests/dashboard.spec.ts`'s existing `GET /api/pickup-slots` test (line ~106) already establishes the exact `page.goto("/dashboard")` + `page.request` authenticated-direct-API-call pattern this story's new `POST` test reuses.
  - `tests/helpers/db.ts`'s `deletePickupSlotByLocation()` already exists and covers this story's cleanup need — no new helper required.
- **Regression found and fixed during context-gathering, not deferred:** `src/app/api/pickup-slots/schema.test.ts`'s `validBody` hardcoded a literal ISO date (`"2026-08-10T..."`, written 2026-08-09 — confirmed via `git blame` — "tomorrow" *then*, now 15 days stale). The two "accepts a valid body"/"accepts an explicit capacity and location" tests would have started failing the moment this story's schema change landed, for a reason neither test is actually about. Same decay class as `prisma/seed.ts`'s drift found in Story 5.1's review — now codified as a durable rule in `project-context.md`. Fixed now (`validBody` computed relative to `Date.now()`), not deferred, since it's a prerequisite for this story's own new test to mean anything.
- **Scope boundaries carried from the story file:** no vendor-storefront timezone concept is being added (open, unresolved decision in `deferred-work.md`) — the check is timezone-agnostic by construction (two absolute instants compared server-side). `PickupSlot.capacity` enforcement is unrelated, not touched.
- **Previous stories' learnings applied:** no mocking (real Prisma/dev server); relative-`Date.now()`-based fixtures throughout (the exact discipline this story's own review finding demands); serial-mode `tests/dashboard.spec.ts` describe block requires no new setup — the new test lives inside the existing authenticated block.
- **Execution mode:** sequential, no subagent dispatch — smallest scope yet in this project (one schema refine, one test-fixture fix, two new test cases).

## Step 2: Generation Mode

**Mode: AI Generation.** ACs are clear, scenario is a single well-understood schema-validation addition. No recording — `tea_browser_automation` resolves to `none` in this environment, same as every prior story.

## Step 3: Test Strategy

AC to scenario mapping:

| AC | Scenario | Test Level | Priority |
| --- | --- | --- | --- |
| 1 | `startsAt` already in the past is rejected by `CreateSlotSchema` (schema-level) | Unit (Vitest) | P0 |
| 1 | `POST /api/pickup-slots` with a past `startsAt` returns 400 and creates no row (direct-API-call path named explicitly in the AC) | E2E (API) | P1 |
| 2 | `endsAt > startsAt` stays independently enforced (existing test, now fixture-fixed) | Unit (Vitest) | — (regression proof, not new) |

**Not automated at this level:**
- `AddSlotForm.tsx`'s client-side pre-check — explicitly discretionary per the story's own Task 3, not required by either AC. No scaffold added; if a future dev adds it, that's a separate, self-contained addition.
- Vendor-storefront timezone behavior — out of scope per Dev Notes, nothing to assert.

**Red phase independently executed, not just reasoned about:**
- `npx vitest run src/app/api/pickup-slots/schema.test.ts`: 6 passed (including the two previously-fragile "accepts..." tests, now fixed and still green), 1 failed — exactly the new `"rejects a startsAt already in the past"` case, failing because the schema currently accepts it.
- `npx vitest run` (full suite): 91 passed, 1 failed — same single new test, no other file affected.
- `npx playwright test tests/dashboard.spec.ts -g "rejects a past startsAt"`: failed with `Expected: 400, Received: 201` — the route currently creates the slot. Cleaned up the resulting real DB row after verification (`deletePickupSlotByLocation`).
- Confirmed the 3 dashboard/pickup-slot tests that share this file's serial-mode describe block (`"vendor sees their own pickups tab"`, `"vendor can add a new pickup slot"`, `"add-slot form shows a validation error..."`) still pass when run in isolation — they didn't run in the same batch as the new failing test only because Playwright's serial mode aborts the remainder of a serial block after one failure, an expected artifact of red-phase, not a regression.
- `npx tsc --noEmit` and `npm run lint`: clean throughout.

## Step 4: Red-Phase Test Generation

TDD Red Phase Validation: **PASS** — both new/fixed pieces applied to the real files and independently executed; true red confirmed for the one new test, no other test broken.

- **Unit test (Vitest), applied now:**
  - `validBody` (and the `"rejects endsAt before startsAt"` test's own inline dates) fixed to be relative to `Date.now()` instead of a hardcoded literal — a fixture fix, not itself a red-phase test, but a required prerequisite (see Step 1).
  - 1 new case: `"rejects a startsAt already in the past"` — a past `startsAt` with a genuinely valid future `endsAt`, isolating exactly AC #1's condition from AC #2's.

```ts
// src/app/api/pickup-slots/schema.test.ts — validBody fix + new case
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const validBody = {
  startsAt: tomorrow.toISOString(),
  endsAt: new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
};

it("rejects a startsAt already in the past", () => {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const result = CreateSlotSchema.safeParse({ startsAt: past, endsAt: validBody.endsAt });
  expect(result.success).toBe(false);
});
```

- **E2E test (Playwright), applied now:** 1 new case appended to `tests/dashboard.spec.ts`'s existing authenticated describe block.

```ts
// tests/dashboard.spec.ts — new case, same describe block as the existing GET /api/pickup-slots test
test(
  "[P1] POST /api/pickup-slots rejects a past startsAt (400), no slot created — Story 5.2, AC #1",
  async ({ page }) => {
    const vendor = await getVendorBySlug("corner-sourdough");
    const location = `Playwright Past Slot ${Date.now()}`;
    const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await page.goto("/dashboard");
    const response = await page.request.post("/api/pickup-slots", {
      data: { startsAt, endsAt, location },
    });

    expect(response.status()).toBe(400);

    const created = await prisma.pickupSlot.findFirst({
      where: { vendorId: vendor.id, location },
    });
    expect(created).toBeNull();
  },
);
```

Acceptance criteria coverage:
- AC1 (past `startsAt` rejected, both submission paths named in the AC): covered — Vitest (schema path) + Playwright (direct-API-call path)
- AC2 (`endsAt > startsAt` unaffected): covered by the existing (now fixture-fixed) `"rejects endsAt before startsAt"` test staying green, re-verified after the fix

## Next Steps (Task-by-Task Activation)

1. Task 1 (`CreateSlotSchema` gains the past-`startsAt` refine) lands → un-skip is not needed, these are not `test.skip()` scaffolds — re-run both new cases directly; both should flip to green. No `route.ts` change expected per the story's own Task 1 note (the route already collapses every schema failure to a generic `400`).
2. Task 2 (fixture fix) is already applied as part of this ATDD pass, not deferred to `dev-story`.
3. Task 3 (client-side pre-check) is discretionary — if the dev adds it, no scaffold here covers it; a new test would be the dev's own addition.
4. Run the full `tests/dashboard.spec.ts` file (not just the two touched tests) once Task 1 lands, to confirm the serial-mode block completes normally end-to-end — it was truncated during red-phase verification by the expected failure.

## Implementation Guidance

New: none. Modified: `src/app/api/pickup-slots/schema.ts`, `src/app/api/pickup-slots/schema.test.ts` (already touched by this ATDD pass), `tests/dashboard.spec.ts` (already touched by this ATDD pass). Optionally `src/components/dashboard/AddSlotForm.tsx` (Task 3). Full contracts are in the story's own Tasks/Subtasks — see `_bmad-output/implementation-artifacts/5-2-pickup-slot-creation-rejects-a-past-start-time.md`.

## Step 5: Validation & Completion

Validation checklist:
- [x] Prerequisites satisfied
- [x] Test files created and applied to the real repo (not draft-only); `tsc --noEmit` and lint clean
- [x] Checklist matches acceptance criteria (AC1, AC2 both addressed)
- [x] Tests generated and independently executed — true red confirmed for the new test, no other test broken (fixture fix verified green)
- [x] Story metadata and handoff paths captured
- [x] No CLI/MCP browser sessions opened (`tea_browser_automation` resolved to `none`); a local dev server was started/stopped only to run the new Playwright test, then torn down
- [x] Temp artifacts: none retained (1 orphaned test pickup slot created by the red-phase Playwright run's real side effect was cleaned up via `deletePickupSlotByLocation` after verification). Durable artifacts: this checklist plus the actual edits to `src/app/api/pickup-slots/schema.test.ts` and `tests/dashboard.spec.ts`

**Completion summary:**
- Applied and verified: 1 Vitest case (new) + 1 Vitest fixture fix (`schema.test.ts`), 1 Playwright case (`dashboard.spec.ts`) — 2 red-phase tests total, 1 regression pre-empted
- Checklist: this file
- Story: `_bmad-output/implementation-artifacts/5-2-pickup-slot-creation-rejects-a-past-start-time.md`
- Next recommended workflow: `dev-story`
