- tileCull drops a group whose composite clears what it leaves empty, using its children's box (A): fixed 68cd1da2b7
- commandBox bounds a clearing-composite group by its children, which skews `commandsBounds` (A): fixed 68cd1da2b7. The fix in `commandBox` covers both: such a group now reaches everywhere inside its own clip.
- A clearing-composite group is bounded by its children, so culling and tiles drop its clearing (B): duplicate of the two A findings above, fixed in 68cd1da2b7
- rasterizeTile's `<canvas>` fallback draws the whole tile and then returns null (A): fixed d303a0d493
- uninstallFakeOffscreenCanvas with no install left deletes the real OffscreenCanvas (A): fixed 66db79259e. It is a test helper, so it has no changeset.
- A `'bounds'` paint lands on the wrong box for centered or right-aligned text with no width (B): fixed c5a4f58451
- createPaintResources.release stops at the first release that throws (B): fixed ec8f53dd07. Every release now runs, then the error is rethrown: the single error alone, or an `AggregateError` when several throw.
- A lazily loaded paint kind's `'bounds'` paint stays unconverted in memoized commands (B): not a defect. Core's `nodePaint.ts:14` subscribes to `paintDrawKindRegistry` and bumps the node memo generation when a kind registers, so memoized node commands are rebuilt once it lands. `paintToBoundsUnits` hands back the fill in its own units rather than mislabeling it.

Extra: 4f0e6e0 (not a defect) shortens the first changeset's title. `check:changesets` warned that it ran past 140 characters.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: `tileCull.test.ts` 3 passed, `contentBounds.composite.test.ts` 1 passed, `rasterizeTile.test.ts` 1 passed, `fakeOffscreenCanvas.test.ts` 1 passed, `textCommand.alignedBounds.test.ts` 2 passed, `textCommand.test.ts` 25 passed, `paintResources.test.ts` 4 passed. Each new test failed before its fix.
- Related tests (renderer `paintedBounds*`, `cullDrawCommands*`, `retain/`, `patterns/`, `draw/`, `WeaselRenderer.paintResources`, and `packages/pdf/src`): 796 passed.
- `rasterizeTile.browser.test.ts` is related but unrun: it needs a browser.
- `npm run checks:gate`: all 33 passed.
- `npm run lint -w @weasel-js/renderer`: the package has no `lint` script. eslint on every changed file: pass, exit 0.
- `npm run check:changesets`: OK, and the new changesets raise no warnings.

tally: 7 of 8 fixed, 0 extra fixed