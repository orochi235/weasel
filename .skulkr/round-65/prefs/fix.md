- prefsCss root block written at `default` instead of a selector's starting `auto.value` (A+B): fixed 3b65d7b780
- mergePrefGroups drops the roots' `admits` (A): fixed 769463f61e
- a closed store does not read back writes made after close (A): fixed 10f3377233. It now subscribes again to the cache it holds once closed; this also covers the private copy behind `usePrefsStore`'s lent cache.
- a migration that renames a leaf strands its auto mark (A): fixed b2540bf143. `PrefsMigration` gets an optional second argument, `auto`: the paths marked auto at that migration's version. Where a migration leaves a path in both `records` and `auto`, the value is written. This is new API, so the changeset is `minor`. `auto` is optional because `apps/draw` calls its migrations with one argument, and a required parameter broke its typecheck.
- `stored()` shows an auto mark's internal record as the leaf's value (A): fixed 5decd3d533. Marks are now left out of `stored()`, and its doc points to `auto()` for those leaves.
- the color blend's weight total overflows where the number blend's does not (A): fixed 106ecab47e. Weights are now scaled to the heaviest inside `blendPref` before any blend runs, so a custom `PrefBlend` gets the same protection.
- orderPrefGroup rebuilds an actions leaf that already holds the stored order (A): fixed 72311a77a7. The finding's PrefsBar memo-miss scenario doesn't hold: PrefsBar memoizes nothing on that group. The broken "same object" promise in the doc is real, and that is what was fixed.
- an unreadable stored scope, or an `auto.value` scope, reads as the plain `default` (B): fixed d6ab050f85. Unreadable stored scopes now read as the leaf with nothing stored (its `defaultScope` included), and an unreadable `auto.value` reads `undefined`.
- duplicate pairing: B's prefsCss finding is a duplicate of A's prefsCss finding (both fixed in 3b65d7b780).

Extra defects: none found. To keep `createPrefsStore` under check:size's 120-line function cap, its read of `values` under `at` moved into a `valuesAt` function, folded into commit 10f3377233.

Checks:
- `npx vitest run --maxWorkers=1` on each file touched: css.test.ts, merge.test.ts, store.test.ts, usePrefsStore.test.tsx, migrate.test.ts, store.auto.test.ts, blend.test.ts, order.test.ts and store.defaultScope.test.ts all pass. `apps/draw/src/surfaces/prefsMigration.test.ts` (8) also passes. Every new test failed against the frozen source before its fix.
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/prefs`: fails, because prefs has no `lint` script (npm prints "Did you mean this?"). In its place, `npx eslint` on every changed package file: pass (exit 0).
- No browser test files were touched. The tree is clean apart from `.skulkr/`.

tally: 9 of 9 fixed, 0 extra fixed