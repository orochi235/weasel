All seven distinct findings are handled: six fixed in code, and the distribute one fixed in its docs only. The clone `applyOps` finding is not a defect.

- Rotate records a repeat of `frame.delta` after a behavior's own ops committed (A+B): fixed 30f6ea021a. `commitRotate` now says whether the commit was its own rotation. When it was a behavior's ops, rotate forgets the last transform, as clone and resize already do.
- Same rotate finding, B's wording: duplicate of the line above.
- `selectFromLasso` aborts the lasso when the adapter has no `hitTestLasso` (A): fixed 1705217ef5. Without `hitTestLasso` it now asks `hitTestArea` over the lasso's bounds, using the same bounds helper as the action. A tiny lasso still clears. With neither hit test, a real lasso falls through to the next behavior instead of aborting. The old test that expected `null` was rewritten.
- Lasso docs promise `params.mode`, but `UseLassoSelectOptions` has no `mode` (A): fixed 6ddae24d7f. `mode` moved from `UseLassoToolOptions` onto `UseLassoSelectOptions`, which the tool's options extend. The changeset is `minor` because this adds API.
- Reorder's `enabled` is true with no scene while `run` does nothing (A): fixed 5cb0c910e0. It now answers `NotApplicable`. Two tests that expected `true` with no scene were updated.
- Flip with `pivot: 'union'` on a lone path-effect node mirrors about its sources' box (B): fixed 3b3ee452a9. It now uses `derivedBoxOwner`'s own box, as rotate does.
- `useDistribute` docs say both extremes stay put, but `'gaps'` can move the box with the greatest far edge (B): fixed 06c1307ca9, docs only. The docs now say what `planDistribute` already did: `'centers'` keeps the first and last by center, `'gaps'` the first and last to start. A doc fix has no failing test to write.
- Clone's `applyOps` path always reports a commit (B): not a defect. `applyOps` returns nothing, and core's `commitRunOps` documents that a consumer's `applyOps` "is taken at its word". Rotate, move, and resize behave the same way.

Extra (sweep):
- The move action has the same Transform Again gap as rotate (`move/action.ts:88`): left alone. It is outside this area, and some move behaviors, such as reparent-on-drop, really do translate by the drag, so whether to forget is a behavior call.
- `edit/createPaintAction.ts:201` answers `enabled` true with no scene, the reorder mistake: left alone, also outside this area.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass.
  - `selectFromLasso.test.ts` 10/10, `lassoSelect.test.ts` 21/21, `options.test.ts` 1/1
  - `rotate.repeat.test.ts` 2/2, `rotate.test.ts` 19/19
  - `reorder.test.ts` 38/38
  - `flip.derived.test.ts` 1/1, `flip.test.ts` 27/27
  - `distribute.test.ts` 16/16
  - `tools/lasso` 11/11
- Each new test failed before its fix:
  - lasso, 2 failed
  - rotate, 1 failed
  - reorder, 1 failed
  - flip, 1 failed
  - the options type test failed `typecheck:packages` with TS2353
- `npm run checks:gate`: pass, "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/editing`: not run. The package has no `lint` script, and npm printed "Missing script". The gate's root `npm run lint` passed.
- `npm run check:changesets`: pass, "OK — 1252 changeset(s), 104 with warnings".
- No browser test files were touched, and the tree is clean.

tally: 6 of 8 fixed, 0 extra fixed