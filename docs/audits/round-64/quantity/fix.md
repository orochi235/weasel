Unit display's `accepts` kept through `QuantityView.to`, so typed text reads in the old unit (A+B): fixed d452620231
Typed text with a line break throws a TypeError in `readInfinity` (A): fixed 7f82494f68
`INF`/`Infinity` not read under `tr-TR`/`az` locales (A+B): fixed fbaff547be
`percent` speaks a different number than it shows, e.g. 0.145 (A+B): fixed dc46ebd129
`spinKey` with an endless max sends ArrowDown from a value above max to Infinity, and the mirror case for min (A): fixed 330a9de12c
Fraction counted in a constant reads `1e308π` as Infinity (A): fixed bbee3b4a34
`multiplier({ symbol: '' })` reads every typed value as NaN (B): fixed 28e27e703b
`scientific` shows NaN as `NaN × 10⁰`, with MathML of 10 to the 0 (A+B): fixed 9a36c88a77
Per-locale caches in `number.ts` and `fieldLocale.ts` have no bound (A+B): fixed 3057968dd1 (a shared least-recently-used cap of 64 in a new `memo.ts`)

Extra defects:
`zoom` at 2x or below rounded `z * 100` in binary, so 1.005 showed `100%` where `percent` shows `101%` (sweep, the same mistake as the percent finding): fixed 7a7590900e

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: present.test.ts pass (149), spin.test.ts pass (14), kinds/proportion.test.ts pass (13), kinds/scientific.test.ts pass (32), memo.test.ts pass (3), fieldLocale.test.ts pass (4), number.test.ts pass (56), localeParse.test.ts pass (31), present.pbt.test.ts pass (17), spin.pbt.test.ts pass (6), number.pbt.test.ts pass (9), parse.long.pbt.test.ts pass (8), endless.test.ts pass (2)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/quantity`: fail, "Missing script: "lint"". The package has no lint script; the root `npm run lint` inside the gate passed.
- `npm run typecheck:packages -- quantity`: pass, "1/1 quantity ok"
- `npm run check:changesets`: pass, "OK — 3440 changeset(s)"
- The tree is clean, and no browser test files were touched.

tally: 9 of 9 fixed, 1 extra fixed