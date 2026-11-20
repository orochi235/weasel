## A pow or warp scale over a narrow domain away from zero has no ticks at all
- where: packages/scale/src/warp.ts:35 (roundNear), packages/scale/src/warp.ts:48 (warpTicks)
- scenario: `powScale({ domain: [101, 109], range: [0, 100], exponent: 2 }).ticks()`. Every evenly spaced place
  falls in 101..109, `roundNear` only offers candidates from that value's own decade on the fixed mantissas
  (100, 150, 200, ...), none of which lie in the domain, so every place returns null and `ticks()` is `[]`. The same
  for `[1.1, 1.4]` (candidates 1, 1.5). A linear scale over the same domain ticks 102, 104, ...; the warp path has no
  fallback to a finer grid when its round values miss the domain, so the axis draws no ticks.
- evidence: read (traced by hand; could not execute in this tree)
- severity: medium

## A log scale whose domain sits inside one decade between its 1-2-5 values has no ticks
- where: packages/scale/src/log.ts:36 (ticks)
- scenario: `logScale({ domain: [300, 450], range: [0, 100] }).ticks()`. first=2, last=3, steps [1, 2, 5], so the
  candidates are 100, 200, 500, 1000, 2000, 5000; none lie in 300..450 and the result is `[]`. A zoomed-in log axis
  (or any domain like [11, 19], [600, 900]) draws no ticks at all, where a finer grid inside the decade is needed.
- evidence: read (traced by hand)
- severity: medium

## Log ticks for base 2 (or 3, ...) are rounded to 12 significant digits, so large powers are wrong values and labels
- where: packages/scale/src/log.ts:50 (ticks)
- scenario: `logScale({ domain: [1, 2 ** 50], range: [0, 100], base: 2 })`. The tick at p=50 is
  `Number((2 ** 50).toPrecision(12))` = 1125899906840000, not 2^50 = 1125899906842624; p=40 gives 1099511627780, not
  1099511627776. The tick is not at a power of the base, `position` places it off the power, and `tickFormat()`
  (base ≠ 10, `tickDecimals` 0) writes "1099511627780" for 1 TiB. Every power of 2 from 2^40 up, and of 3 from 3^26,
  is affected. The `toPrecision(12)` noise trim only suits base 10's exact powers.
- evidence: read (traced by hand)
- severity: medium

## A linear scale's ticks(NaN) ticks at a step of 1, producing up to millions of ticks or an out-of-memory hang
- where: packages/scale/src/linear.ts:47 (tickStep), linear.ts:166 (ticks)
- scenario: a count computed as `width / spacing` with width 0/0 gives NaN. `Math.max(1, NaN)` is NaN, so `raw` is
  NaN and `tickStep` returns 1 (meant for an overflowing span). `linearScale({ domain: [0, 1e6], range }).ticks(NaN)`
  returns 1,000,001 ticks; a domain of [0, 1e12] loops ~1e12 times. `niceDomain(domain, NaN)` (`nice: NaN`) likewise
  widens to whole units regardless of scale. A NaN count should take the default, as warpTicks' and the log scale's
  paths effectively do (they return few or no ticks).
- evidence: read
- severity: medium

## A time scale's ticks(NaN) falls to the 1-second interval: millions of ticks over any long span
- where: packages/scale/src/time.ts:41 (intervalFor)
- scenario: `timeScale({ domain: [0, 30 * 86400000], range }).ticks(NaN)`. `target` is NaN, every `Math.abs(Math.log(...))`
  comparison is false, so `best` stays `INTERVALS[0]` (1 s) and `gridTicks` emits 2,592,001 ticks for 30 days
  (3e10 for a millennium). `tickFormat(NaN)` likewise picks the 'second' unit. A NaN count should take the default.
- evidence: read
- severity: medium

## A warp/pow scale's `format` labels its own ticks at the linear step's precision, rounding them wrong
- where: packages/scale/src/warp.ts:85 (warpScale format)
- scenario: `powScale({ domain: [0, 4], range: [0, 100], exponent: 0.5 })`: `ticks()` gives 0.15 and 0.6 among
  others (round values evenly spaced along the sqrt), but `format` uses `tickStep(0, 4)` = 1, 0 decimals, so
  `format(0.15)` is "0" and `format(0.6)` is "1", while `tickFormat()` writes "0.15" and "0.6". `Scale.format` is
  documented as "`value` as an axis label reads it, among the ticks `ticks()` gives", and a consumer without
  `tickFormat` (plot's axes fall back to `format`) or one replacing nothing but calling `format` mislabels them. The
  question "how does a warp tick read" is answered two ways (`step()` vs `gridOf`).
- evidence: read (traced by hand)
- severity: low

## Month/quarter ticks vanish for a time domain starting in the first month a Date holds
- where: packages/scale/src/time.ts:76 (gridTicks)
- scenario: `timeScale({ domain: [-8.64e15, -8.64e15 + 1e10], range }).ticks()` picks the 1-month interval. The first
  candidate is April 1 of year -271821, before the earliest Date, so `monthStart` returns NaN and `!(t <= hi)`
  breaks the loop before reaching May, June and July, which a Date holds: `[]`. A NaN before `lo` should `continue`,
  only a NaN past `hi` should end the walk.
- evidence: read
- severity: low

## A log scale whose ends' logarithms are equal inverts every point to an end
- where: packages/scale/src/log.ts:70 (invert)
- scenario: ends so close their logarithms round equal (e.g. `[1e300, 1e300 * (1 + 1e-14)]` in base 10, where the
  log ulp is ~1e-13 relative). `position` handles this with the log1p distance path (line 34), spreading values
  across the range, but `invert` computes `base ** lerp(l0, l1, t)` = `base ** l0` for every t, then clamps, so
  `invert(position(v))` is d0 or d1 for every v inside. The two directions answer the degenerate case two ways.
- evidence: read
- severity: low

## polarScale's axes sanitization lets NaN through, so every angle and point is NaN
- where: packages/scale/src/polar.ts:47 (polarScale)
- scenario: `polarScale({ ..., axes: NaN })`: `Math.max(1, Math.floor(NaN))` is NaN (Math.max propagates NaN), so
  `axes` is NaN, `angle(i)` is NaN and `point` returns `{ x: NaN, y: NaN }`. The clamp exists to hold `axes` to at
  least 1 and misses the one non-number input it most needs to catch.
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

<!-- done: 9 findings, files read: 12 -->
