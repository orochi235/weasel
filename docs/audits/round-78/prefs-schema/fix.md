A nested-field condition ignores the omitted defaults of the fields on the way (A): fixed adffa1b1e9

`prefObjectBase` lets a `fromScalar` throw escape, where repair reads it as invalid (B): fixed 90bd3602af. Repair now goes through the same guarded helper, so there is one pathway for this.

An alias's drawn leaf keeps the target's `pair` (B): fixed a33974aa75. It also drops the target's `heading`, and the alias uses its own `pair` or `heading` if it gives one. This was my call, recorded in `docs/unruled.md`.

The once-per-path warning set in `prefConditionHolds` grows without bound (B): fixed 66c978d183. The set is capped at 256 paths and cleared when full.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` on each test file touched, one at a time: `judge.test.ts`, `object.test.ts`, `alias.test.ts`, `condition.test.ts` (new) and `repair.test.ts` all pass. Each new test failed before its fix.
- The whole `packages/prefs-schema` directory passes (26 files, 273 tests).
- Related consumer tests all pass: prefs' `aliasTargets`, `judge.over`, `shown`, `action.activeIf` and `alias`; ui's `PrefsForm.entryConditions`, `BarRootLayout.alias`, `PrefsForm.aliasConditions` and `PrefsForm.over`; routing's `resolveMenu`; labkit's `sectionTree.activeIf`.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/prefs-schema`: not run, because the package has no `lint` script. Instead, `npx eslint` on every changed `.ts` file passes, and the gate's root `npm run lint` passes.
- No browser tests were touched. The tree is clean apart from `.skulkr/`.

tally: 4 of 4 fixed, 0 extra fixed