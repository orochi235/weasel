- Log scale with a small tick count falls back to linear ticks once `every` thins the powers (A): fixed 200cac5ee4
- `ContinuousScaleFactory` doc names `powScale`, which needs an exponent (A): fixed 12c235a370 (doc only, so no test and no changeset)
- A single-valued linear or log domain off a whole number gets no ticks (A): fixed ca018807d4. It also covers power and warp scales, and its tick is now labeled with its own digits ("0.3", not "0").
- Band scale with one category, paddingInner 1 and paddingOuter 0 reports a step of 1e11 (A): fixed eeadd431aa. The step is now the range length with the band centered, and the same goes for a tiny nonzero outer padding (a property test found that case).
- warpTicks gives no ticks, or one, for a narrow domain away from zero (B): fixed d55363f523. A domain narrower than its distance from zero now ticks on a linear grid. The existing test for `[101, 109]` and `[100, 110]` now expects even steps (`[102, 104, 106, 108]`) instead of the old uneven ones.
- tickDecimals counts places to an absolute 1e-9, so a column of small ticks all label "0" (B): fixed d0858cc02a. The tolerance is now relative to each value. Log's decade normalization stays, because `tickDecimals` stops at 20 places; I corrected the comment there to say so.
- Weekly time ticks fall on Thursdays (B): fixed 67fd3a3650. Nobody had ruled on this, so I made the call: weekly ticks fall on Mondays (UTC, ISO 8601). It is recorded in `docs/unruled.md` under a new "Audit round seventy-two (2026-11-22): scale" section.

No extra defects found.

Checks:
- Every scale test file, one at a time, `--maxWorkers=1`: ticks.test.ts pass (23), scales.test.ts pass (40), warp.test.ts pass (10), mirror.pbt.test.ts pass (8), scales.pbt.test.ts pass (9). Each new test failed before its fix.
- packages/ui/src/components/Plot2D/Plot2D.test.tsx (uses `tickDecimals`): pass (25). Plot2D.browser.test.tsx not run (browser).
- `npm run check:changesets`: pass ("OK — 552 changeset(s)").
- `npm run checks:gate`: pass ("all 33 passed").
- `npm run lint -w @weasel-js/scale`: the package has no lint script. `npx eslint packages/scale/src`: pass, no output.
- The tree is clean.

tally: 7 of 7 fixed, 0 extra fixed