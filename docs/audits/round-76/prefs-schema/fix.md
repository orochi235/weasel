prefReader reads a stored `null` as the value instead of the default (A): fixed 04d639eaec

A condition on a field an object omits reads the default object's field (A): fixed 6832a1bb7a. This needed a call nobody had made, recorded in `docs/unruled.md`. A field the object omits now reads as its own leaf's default, which is what the form draws. A field no leaf describes reads as absent. The object's `default` answers only when nothing at all is held. `status.fromItem.test.ts` had asserted the old reading, so its test now expects the new one.

An alias under its own name keeps the target's `short` forms (A): fixed 92ad84acfd

prefDisplayBounds returns a unitless leaf's `stops` unsorted and unclamped (A): fixed 12a4f3a312

The switch exemption never matches `from: 'item', path: ''` (A): not a defect. No leaf reaches `prefStatusIn` at an entry's own path, because the item itself is walked without it. A root test on path `''` matches no leaf path either, so the two cases already behave the same.

Union variants sharing a field key share one status (B): fixed 776051c5b1. `applyPrefConditions` now marks a field only from the variants the judge says the value holds, and from every variant when it names none. `prefStatusAt` asks the held variant first. Inside an entry, the tag is read from the entry.

A `minAt`/`maxAt` reading NaN wipes the declared bound (B): fixed a9c2e47085

prefReader recurses without end on a selector cycle (B): fixed 971cf51ae1

The condition-field list is defined twice (B): fixed ab6bb66b1f. This one has no failing test, since nothing a consumer can observe changes yet, and no changeset, since nothing reaches a consumer.

Checks:
- Each touched test file run alone with `--maxWorkers=1`: `alias.test.ts`, `bounds.test.ts`, `helpers.test.ts`, `judge.test.ts`, `status.fromItem.test.ts` and `status.union.test.ts` all pass.
- `packages/prefs-schema`: 262 tests pass.
- Dependent tests: `packages/prefs/src` 770 pass, `packages/ui/src/components/Prefs` 578 pass, `packages/labkit/src/config` 213 pass.
- `npm run checks:gate`: the first run failed `check:proto-index` on `statusAt.ts`. After the fix it reports "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/prefs-schema`: unrun, because the package has no lint script. eslint on every changed source file passes, and the gate's `npm run lint` passes.
- `npm run check:changesets`: pass.
- The tree is clean apart from `.skulkr/`.

tally: 8 of 9 fixed, 0 extra fixed