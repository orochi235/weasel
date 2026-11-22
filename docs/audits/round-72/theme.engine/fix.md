bake leaves out tokens that don't vary on an axis whose default is bad (A): fixed a166555842

toDtcg compares mode leaves by reference, so equal copies never collapse into one (A): fixed 572a73b8c3

axis value named `by` is accepted though no `by` can select it (B): fixed b1edaff110 (strict call, recorded in `docs/unruled.md`: `derive` reports it, and `defineTheme` and `fromDtcg` throw)

axis value entries aren't checked to be objects, and `scheme` is written into CSS unchecked (B): fixed b1edaff110 (same shared `axisValueProblem` check and the same unruled entry; `emitCss` also throws)

child's seeds change an inherited ramp's steps but its baked `ramps` keeps the parent's list (B): fixed 9daefb55af

child's ramp or scale step loses to an inherited same-named step from another entry in its own layer (B): fixed 5c0fb25e76 (`replaced` is now keyed by entry and step, not by token name)

Extra: `defineTheme` and `fromDtcg` had the same missing axis-value check; fixed in b1edaff110 and counted with the B findings, not as extras.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: axisIssues.shrunk.test.ts pass (6), emit/emit.test.ts pass (26), emit/dtcg.test.ts pass (18), theme.test.ts pass (12), bake.test.ts pass (16), bake.pbt.test.ts pass (2), merge.test.ts pass (15), merge.pbt.test.ts pass (2), merge.shrunk.test.ts pass (2), derive.test.ts pass (59), deps.test.ts pass (25), deps.shrunk.test.ts pass (3), fromDtcg.test.ts pass (10), axes.test.ts pass (11), colorListItems.test.ts pass (2)
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run check:changesets`: "OK — 552 changeset(s)."
- `npm run lint -w @weasel-js/theme`: unrun, because the theme package has no `lint` script (npm answered "Missing script"). The gate's root `npm run lint` passed.
- The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed