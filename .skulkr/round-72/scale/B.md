# Audit round 72 — scale — reviewer findings

## warpTicks returns no ticks, or one, for a narrow domain away from zero: the offset decade has no 7s or 9s
- where: packages/scale/src/warp.ts:44-46 (roundNear)
- scenario: `powScale({ domain: [1265, 1279], range: [0, 100], exponent: 0.5 }).ticks()` — span 14 gives `narrow = 10`,
  smaller than v's own decade 1000, so `p = 10` and `base = 1200`. The candidates are `1200 + m·10` for the MANTISSAS
  (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10): 1210 … 1260, 1280, 1300. None lies in 1265..1279 (1270 would be `m = 7`, which
  the list lacks), so every tick is null and `ticks()` returns `[]` for a 15-integer domain. `[1265, 1295]` yields
  only `[1280]` for 5 requested. The mantissa list is shaped for a leading digit on v's own decade; on the
  `narrow < own` path the values are an offset from `base`, where the warp is nearly linear, and the uneven gaps
  (6→8, 8→10) drop every value there. Should give round ticks (1265? 1270, 1275 …) as a linear scale would.
- evidence: read (traced by hand through roundNear)
- severity: high

## tickDecimals counts places to an absolute 1e-9, so a given column of small ticks all label "0"
- where: packages/scale/src/tickFormat.ts:20 (tickDecimals)
- scenario: Plot2D's explicit ticks (`packages/ui/src/components/Plot2D/PlotTicks.tsx:36`) pass
  `tickDecimals([1e-10, 2e-10, 3e-10])`; each `|toFixed(0) − v|` is below `1e-9 · max(1, |v|) = 1e-9`, so it returns 0,
  and `formatTick(v, { decimals: 0, step: 1e-10 })` writes "0" for every label (step is above FINEST_STEP, so the
  exponent path is not taken). Same for `[0.0000000001, 0.0000000005]`. The tolerance should be relative to the
  value (log.ts:68 and warp.ts:77 already work around it by normalizing to the decade first — the same question
  answered two ways).
- evidence: read
- severity: medium

## Weekly time ticks fall on Thursdays
- where: packages/scale/src/time.ts:33, 70 (INTERVALS / gridTicks)
- scenario: a span of about five weeks picks `{ ms: 7 * DAY }`, and gridTicks lays multiples of 7 days from the
  epoch, which was a Thursday; every weekly tick and label ("2026-11-19", "2026-11-26") is a Thursday, where a
  calendar week starts Sunday or Monday (as month ticks start on the 1st). Nothing documents the Thursday choice.
- evidence: read
- severity: low

## Files read
packages/scale/src/band.ts
packages/scale/src/index.ts
packages/scale/src/linear.ts
packages/scale/src/log.ts
packages/scale/src/ordinal.ts
packages/scale/src/pbt.fixture.ts
packages/scale/src/polar.ts
packages/scale/src/replacedFormat.ts
packages/scale/src/tickFormat.ts
packages/scale/src/time.ts
packages/scale/src/types.ts
packages/scale/src/warp.ts

<!-- done: 3 findings, files read: 12 -->
