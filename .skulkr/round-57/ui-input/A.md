# Audit round 57 — ui-input (blind reviewer)

Note: the brief names frozen commit c068d53f7e; the tree's HEAD is a22801b42b. Findings cite this tree.

## framesSweep counts a numeric `loop` below 1 as that many passes, where the clock it reads makes at least one
- where: packages/ui-input/src/sweep.ts:139 (framesSweep)
- scenario: `FrameSpan` is documented as a `ClockSpec`, and the clock reads `loop` through `passesOf` (`packages/clock/src/place.ts:24`), `Math.max(1, loop)`. framesSweep uses `passes = loop` raw. With `{ duration: 1000, loop: 0 }` and `every: 250`: `passes: 'all'` gives `walked = 0`, `end = 0`, and the walk is `[0]` only, while the clock runs a full 1000 ms pass; `passes: 'first'` gives `walked (1) !== passes (0)`, so `ends` is false and the walk stops short at `[0, 250, 500, 750]`, dropping the run's last frame 1000 that the clock does show. `loop: 0.5` likewise walks half a pass under `'all'` where the clock makes one. Two answers to "how many passes does `loop` make"; framesSweep should read it the clock's way.
- evidence: read
- severity: medium

## sliderKey with stops and `ordered` lands a thumb between stops when the next stop is its neighbor's
- where: packages/ui-input/src/slider.ts:205,217 (sliderKey)
- scenario: with stops, a keystroke "moves by whole stops" (`stepStops`), then `clampOrdered` holds the result a gap short of the neighbor. Ordered thumbs at 0 and 50, stops `[0, 50, 100]`, no step, track 0–100: ArrowRight on thumb 0 picks stop 50, and `clampOrdered` returns `50 - 0.1 = 49.9`, a value on no stop. `@weasel-js/ui`'s Slider passes its stops here for every slider (`thumbKeys.ts:34`), so under `snap="strict"` the keyboard puts the thumb where no pointer or stop could, and under magnetic snap it lands just off the stop. The press should leave the thumb on the last stop that keeps the order (or where it was).
- evidence: read
- severity: medium

## sliderAt returns NaN on a track with an endless `min`, a step and no `origin`
- where: packages/ui-input/src/slider.ts:95 (sliderAt)
- scenario: `SliderAtShape` says either end "may be infinite" and `origin` defaults to `min`. `sliderAt(0.5, { min: -Infinity, max: 100, step: 1, ...spanMap({ from: 0, to: 100 }) })` calls `snapToStep(50, 1, -Infinity)`: `stepsFrom` gives `Infinity` steps, `Infinity * 1 + -Infinity` is NaN, and `clamp(NaN, …)` passes NaN through, so the pointer picks NaN instead of 50. The default origin should fall back to a finite end (or 0) when `min` is not finite.
- evidence: read (quantity's `snapToStep`/`stepsFrom` traced by hand)
- severity: low

## A sweep's `at` answers NaN (or `undefined` from valuesSweep) for a NaN fraction, though documented as clamped
- where: packages/ui-input/src/sweep.ts:99 (valuesSweep), :71 and :86 (rangeSweep), :150 (framesSweep)
- scenario: `Sweep.at` says `u` is "clamped", but geom's `clamp01` passes NaN through. A scrubber reading a zero-width track gets `u = 0/0`: `valuesSweep(['a','b']).at(NaN)` returns `list[NaN]`, `undefined`, typed as `V`; `rangeSweep({from:0,to:10,step:1}).at(NaN)` and the `count` and `framesSweep` forms return NaN. A NaN fraction should read as an end (as `spanFraction` reads an empty span as 0).
- evidence: read
- severity: low

## Files read
packages/ui-input/src/createLiveSelectionModel.ts
packages/ui-input/src/edgeScroll.ts
packages/ui-input/src/grid.ts
packages/ui-input/src/heldAt.ts
packages/ui-input/src/index.ts
packages/ui-input/src/keySteps.ts
packages/ui-input/src/list.ts
packages/ui-input/src/pbt.fixture.ts
packages/ui-input/src/press.ts
packages/ui-input/src/reorder.ts
packages/ui-input/src/scheduler.ts
packages/ui-input/src/selection.ts
packages/ui-input/src/slider.ts
packages/ui-input/src/solo.ts
packages/ui-input/src/span.ts
packages/ui-input/src/spatial.ts
packages/ui-input/src/stepRepeat.ts
packages/ui-input/src/sweep.ts
packages/ui-input/src/tabOrder.ts
packages/ui-input/src/textCommit.ts
packages/ui-input/src/tree.ts
packages/ui-input/src/typeahead.ts
packages/ui-input/src/wheel.ts

<!-- done: 4 findings, files read: 23 -->
