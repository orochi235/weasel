## A log scale's small-count ticks fall back to linear ticks when `every` thins the powers, giving no ticks or ticks crammed at one end
- where: packages/scale/src/log.ts:59 (`linear`), with `powerTicks` at :43
- scenario: `logScale({ domain: [2, 9e9], range: [0, 100] }).ticks(1)`. `powerTicks(1)` has first 0, last 10 and `every = ceil(10/2) = 5`, so it tries 1e0, 1e5 and 1e10, and only 1e5 is inside the domain. One power is "fewer than two", so `linear(1)` holds and `ticks` returns `stepTicks(2, 9e9, tickStep(2, 9e9, 1))`, where the step is 1e10: `[]`. It should return `[1e5]`. Wider domains (e.g. `[2, 9e299]`, count 1) get linear multiples of 1e299 instead, all bunched at the top of a log axis, and `tickFormat(1)` switches to the linear formatter too. The heuristic counts powers after thinning, but it is meant to ask whether the domain holds two powers at all. A count of 1 is what a short axis gets from `width / spacing`.
- evidence: read
- severity: medium

## `ContinuousScaleFactory`'s doc names `powScale`, which is not one
- where: packages/scale/src/types.ts:26 (`ContinuousScaleFactory`)
- scenario: A control is handed `powScale` as its factory, as the doc says it can be. `powScale` requires `exponent`, so this fails to typecheck against `(opts: { domain; range }) => ContinuousScale`. Called anyway with `{ domain, range }`, it throws `powScale: an exponent of undefined does not warp`.
- evidence: read
- severity: low

## A linear scale over a single non-integer value has no ticks (and so does a degenerate log domain off the 1/2/5 values)
- where: packages/scale/src/linear.ts:55 (`tickStep`), used by `linearScale.ticks` at :169
- scenario: `linearScale({ domain: [0.3, 0.3], range: [0, 100] }).ticks()`: `tickStep` returns `|hi - lo| || 1 = 1`, and `stepTicks(0.3, 0.3, 1)` has first 1 and last 0, so it returns `[]`. `[5, 5]` gives `[5]`. A single-valued domain ticks only when its value is a whole number. `[1e300, 1e300]` also gives `[]`, because `a/step` is past counting. Likewise `logScale({ domain: [150, 150] }).ticks()` gives `[]`. The one value the axis shows should be its tick.
- evidence: read
- severity: low

## A band scale with one category, paddingInner 1 and paddingOuter 0 reports a step 1e9 times its range
- where: packages/scale/src/band.ts:39 (`bandScale`)
- scenario: `bandScale({ domain: ['a'], range: [0, 100], paddingInner: 1, paddingOuter: 0 })`: `n - inner + 2*outer = 0` is clamped to 1e-9, so `step = 1e11` and `.step` reads 1e11 on a 100-unit range. Any consumer laying out by `step` (gaps, labels) gets a wild value. Each band's start and size are 0, which is fine, but the step should be the range length or 0.
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

<!-- done: 4 findings, files read: 12 -->
