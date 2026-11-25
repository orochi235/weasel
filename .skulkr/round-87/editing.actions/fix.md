makeBooleanGroup returns a dead id when the scene refuses the batch (A): fixed 9dce6be708
Rotate with pivot 'each' takes a selected derived group apart (A): fixed a91977bfd2
A rotate behavior that returns a pose leaves `gctx.current` stale for later behaviors (A): fixed f22f49d733
Lasso behaviors get no `plane` (A), or `kitSettings` (B): fixed 2ab87e15e0
Clone reports a commit when a behavior answers with an empty op list (A): not a defect (`reduceBehaviorEnd`'s contract says `Op[]` claims the commit, an empty array included, so a behavior can do the commit itself; rotate and move treat `[]` the same way)
Lasso behaviors get no `plane` or `kitSettings` (B): duplicate of the lasso `plane` finding (A)
Make Boolean Group takes page structure into the group (B): not a defect (`rootsAmong` already runs `withoutPageStructure`; a test with a page plus two shapes passed before any change)
Transform Again translates, rotates or resizes page structure (B): fixed bb5df8dc98 (translate was already filtered by `rootsAmong`; rotate and scale went through `shapeSources` and `captureResize`, which don't filter, and the recorded subject kept the page)
Clone copies a selected page (B): not a defect (`translateTargets` and `scratch.ids` both go through `rootsAmong`, which drops page structure)

Extra defect fixed while fixing:
- A live rotate drag turned a selected page, and recorded the page in the repeat's subject (sweep): fixed in bb5df8dc98 along with Transform Again, which shares the code path, so it isn't counted separately.
- Found but not fixed, outside this area: the live resize drag (`resize/session.ts`, `ids = selection.get()`) doesn't drop page structure either. Resize replay is covered now, because Transform Again filters before it calls `resizeSelectionOps`.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: `booleanGroupAction.test.ts` 8 passed, `transformAgain.pages.test.ts` 5 passed, `transformAgain.test.ts` 18 passed, `rotate.each.test.ts` 1 passed, `rotate.behaviorChain.test.ts` 1 passed, `lassoSelect.test.ts` 22 passed. The whole `rotate/` directory also passed (80 tests). Each new test failed before its fix.
- `npm run checks:gate`: "checks:gate: all 33 passed". After that run I only shortened three changeset titles (folded into their own commits), then reran `check:changesets`.
- `npm run lint -w @weasel-js/editing`: fail, `Missing script: "lint"`. The package has no lint script, so I ran eslint on every changed `.ts` file (exit 0) and `npm run typecheck:packages -- editing` ("1/1 editing ok").
- `npm run check:changesets`: "[changesets] OK — 1379 changeset(s), 140 with warnings", none of the warnings from this pass.
- Tree clean.

tally: 5 of 9 fixed, 0 extra fixed