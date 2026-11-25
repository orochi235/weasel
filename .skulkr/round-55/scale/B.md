## timeScale.ticks hangs on a domain whose span overflows to Infinity
- where: packages/scale/src/time.ts:43 (intervalFor), :70 (gridTicks)
- scenario: `timeScale({ domain: [-1e308, 1e308], range: [0, 100] }).ticks()`. `span = d1 - d0` is `Infinity`, so `target` is `Infinity` and every `Math.abs(Math.log(spanOf(i) / target))` is `Infinity`; no interval beats the first, so `best` stays `SECOND` and the year branch is never taken. `gridTicks` then clamps the ends to ±8.64e15 and steps one second at a time across 1.7e16 ms: about 1.7e13 pushes, a hang ending in OOM. Should pick whole years (as a finite huge span does) or the double-range-safe halves `proportion` already uses for this domain. The package's own `anyFinite` fixture generates exactly these ends.
- evidence: read
- severity: medium

## warp/pow scales give no ticks for a narrow domain away from zero
- where: packages/scale/src/warp.ts:36 (roundNear), :52 (warpTicks)
- scenario: `powScale({ domain: [1.1, 1.3], range: [0, 100], exponent: 0.5 }).ticks()`. `whole` is false, every warped place falls in 1.1..1.3, and `roundNear` only offers candidates `m * 10^floor(log10 v)` for the mantissas 1, 1.5, 2 … 10, i.e. 1, 1.5, 2, …, none of which lie inside the domain, so every tick is null and the axis gets `[]`. `[100, 110]` gets only `[100]`. A linear scale on the same domain ticks 1.10, 1.15, … 1.30. Candidates should come from a finer decade when the domain is narrower than the value's own decade (or fall back to `stepTicks`).
- evidence: read
- severity: medium

## warp/pow `format` labels its own ticks at the wrong precision, disagreeing with `tickFormat`
- where: packages/scale/src/warp.ts:89 (warpScale format)
- scenario: `powScale({ domain: [0, 1], range: [0, 100], exponent: 0.5 })`. `ticks()` gives values like 0.04 and 0.15 (round values placed along the warped spacing), but `format` rounds to the decimals of the *linear* `tickStep(0, 1)` = 0.2, i.e. one place: `format(0.04)` is "0" (same as the 0 tick) and `format(0.15)` is "0.1" or "0.2". `tickFormat()` answers the same question through `gridOf` and gives "0.04" / "0.15". `Scale.format` is documented as how a value reads "among the ticks `ticks()` gives", so a consumer labelling with `format` (any scale without `tickFormat`, or code that calls `format` directly, e.g. a hover readout matching the axis) shows duplicate and wrong labels. One decision, two answers.
- evidence: read
- severity: medium

## logScale gives no ticks for a domain inside one decade that holds no 1, 2 or 5 multiple
- where: packages/scale/src/log.ts:38 (ticks)
- scenario: `logScale({ domain: [6, 9], range: [0, 100] }).ticks()` → candidates are 1, 2, 5, 10, 20, 50 — none in 6..9, so `[]`; `[1.1, 1.9]` also `[]`. Any other base with a domain between two consecutive powers (`base: 2, domain: [3, 3.5]`) is empty too, since only `[1]` mantissas are used off base 10. An axis drawn from this has no ticks or labels at all; a linear fallback (as `warpTicks` uses for its degenerate case) would mark it.
- evidence: read
- severity: low

## logScale.invert disagrees with position for ends too near for their logarithms to differ
- where: packages/scale/src/log.ts:63 (invert)
- scenario: a domain like `[1, 1 + 2e-16]` (or any pair whose `log` rounds equal but values differ). `position` uses the `log1p` distance form and spreads values across the range, but `invert` computes `base ** lerp(l0, l1, t)` with `l0 === l1`, so every interior point inverts to the same `base ** l0` (then clamped), never `d1`-side values: `invert(position(v)) !== v`. The `along` fallback has no inverse counterpart.
- evidence: read
- severity: low

## Tick labels at or above 1e21 print the double's float-noise digits
- where: packages/scale/src/tickFormat.ts:31 (toFixedPlain), reached from formatTick / formatNumber
- scenario: `linearScale({ domain: [0, 1e23], range: [0, 100] })` or a log scale reaching 1e23: the tick 1e23 is formatted with `BigInt(1e23).toString()` = "99999999999999991611392", and other round ticks past 1e21 likewise read as long strings of noise digits instead of the round value they were placed on (or `1e+23`). Label should round to the value's significant digits (e.g. via `toPrecision`/exponent) rather than the binary expansion.
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

<!-- done: 6 findings, files read: 12 -->
