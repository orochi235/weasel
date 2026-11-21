I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document is below. One more thing: this checkout's HEAD is `a22801b42b`, not the frozen commit `b8bed07d81` the brief names. I read the tree as it is.

## sliderAt returns NaN for a track whose `min` is -Infinity and that has a step but no `origin`
- where: packages/ui-input/src/slider.ts:95 (sliderAt)
- scenario: `sliderAt(0.5, { min: -Infinity, max: 100, step: 1, ...spanMap({ from: 0, to: 100 }) })`. `SliderAtShape` says either `min` or `max` may be infinite, and `origin` defaults to `min`, so the step grid is counted from -Infinity. In `snapToStep(50, 1, -Infinity)`, `stepsFrom` gives ∞, and ∞·1 + (−∞) = NaN. `clamp(NaN, -Infinity, 100)` keeps the NaN, and `attract` returns NaN whatever the stops, because every gap comparison is false. The pointer picks NaN where it should pick 50. The README's example has an infinite high end (`max: Infinity`), which works; the mirror case with an infinite low end breaks.
- evidence: read (slider.ts:95; quantity/src/spin.ts `snapToStep`/`stepsFrom`; quantity/src/places.ts `decimalPlaces` returns 0 for ±Infinity)
- severity: medium

## framesSweep counts a numeric `loop` differently from the clock it claims to mirror (loop 0, or a fraction below 1)
- where: packages/ui-input/src/sweep.ts:139 (framesSweep)
- scenario: `FrameSpan` says "a `ClockSpec` is one". The clock reads passes as `Math.max(1, loop)` (packages/clock/src/place.ts:24 `passesOf`), but framesSweep uses the raw number.
  - `{ duration: 1000, loop: 0 }`: the clock runs one pass and ends at 1000 ms.
  - Same span with `passes: 'first'`: `walked = 1` and `passes = 0`, so `ends` is false and the 1000 ms end frame is dropped as though another pass followed.
  - Same span with `passes: 'all'`: `walked = 0` gives `end = 0`, so the walk is the single frame 0.
  - `loop: 0.5` with `'all'`: the walk stops at 500 ms, where the clock runs to 1000.
- evidence: read (sweep.ts:137-144, clock/src/place.ts:24-25)
- severity: medium

## soloFrom and soloSweepFrom ignore `enabled` in a single selection
- where: packages/ui-input/src/selection.ts:231 (soloFrom), packages/ui-input/src/selection.ts:249 (soloSweepFrom)
- scenario: soloFrom runs `if (model.mode !== 'multiple') return model.press(index);` before it checks `enabled(index)`. So `soloFrom(singleModel, 2, n, (i) => i !== 2)` chooses the disabled item 2, where the multiple path would return with no change. soloSweepFrom's single path returns `sweepFrom(model, from)`, which takes no `enabled`, so `reach(i)` on a refused item chooses it. That breaks the doc's promise that "an item `enabled` refuses is neither reached nor changed". The callers in this repo (ToggleChips, SegmentedBar, and segmentSweep's `keyOf`) filter by `usable`/`sweepable` first, which hides the bug. A direct caller that relies on the documented behavior gets disabled items chosen.
- evidence: read
- severity: low

## sliderAt under `strict` with no stops returns the raw track value, unclamped and unsnapped
- where: packages/ui-input/src/slider.ts:94 (sliderAt)
- scenario: `sliderAt(1.2, { min: 0, max: 100, strict: true, stops: [], ...spanMap({ from: 0, to: 100 }) })` returns 120. `attract(v, [], Infinity)` hands back `v` itself, and the strict branch returns before the `clamp(..., min, max)` and step snap that the non-strict branch applies. The doc promises a value "inside `min` to `max`". So a pointer dragged past the end of a strict slider with an empty stop list (for example, every stop filtered out by `usableStops`) picks a value outside the range. The same branch also skips the clamp when a stop lies outside `min` to `max`.
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