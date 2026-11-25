A failed step on a coalesced entry whose batches came in different orders unwound with the wrong partner ops, leaving the state half-stepped (A+B) — fixed b2eb0ff001

A suspended journal's coalesce window survived the parent's edits made while it was suspended, so undo discarded them (A) — fixed b92a650710

A journal's commit notified the parent's listeners while the journal still counted as active (B) — fixed 07a4eea4cb

The `recordEntry` and `allForwardOps` docs said `Journal.commit` uses them, and it uses neither (B) — fixed 80a9f52b0e (docs only, so no test can fail before it)

Extra: the two `journal.ts` fixes pushed `createJournalInternal` to 123 lines, over check:size's 120. Folding the close sequence that `commit` and `cancel` share into one helper brought it back under — 7f0cac7ee2 (a cap breach these fixes caused, not a defect in the frozen tree, so it is not counted below)

Checks:
- `npx vitest run --maxWorkers=1 packages/history/src/history.reorderedCoalesce.test.ts`: pass (2 passed)
- `npx vitest run --maxWorkers=1 packages/history/src/journal.sealsParent.test.ts`: pass (3 passed)
- `npx vitest run --maxWorkers=1 packages/history/src/journal.commit.test.ts`: pass (6 passed)
- `npx vitest run --maxWorkers=1 packages/history`: pass (250 passed)
- `npm run checks:gate`: pass (all 33 passed; the first run failed check:size, fixed by 7f0cac7ee2)
- `npm run lint -w @weasel-js/history`: not run, because the package has no lint script (npm error: missing script). eslint on the changed files: pass (exit 0).
- No browser tests touched. Tree clean apart from `.skulkr/`.

tally: 4 of 4 fixed, 0 extra fixed