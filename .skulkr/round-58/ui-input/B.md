# Audit round 58 — ui-input findings

## sliderAt returns NaN for a stepped track whose min is -Infinity
- where: packages/ui-input/src/slider.ts:95 (sliderAt)
- scenario: `SliderAtShape` documents that "Either [min or max] may be infinite", and the step grid's `origin` defaults to `min`. With `min: -Infinity`, `step: 1`, no `origin`, `sliderAt(0.5, …)` calls `snapToStep(v, 1, -Infinity)`; quantity's `stepsFrom` computes `(v - -Infinity) / 1 = Infinity`, and `Infinity * step + -Infinity` is `NaN`, so the pointer picks `NaN` (geom's `clamp` passes NaN through). It should snap from a finite origin (`max`, or 0) or skip snapping when the default origin is infinite. Today's callers (`useKeyDrag`, `useSpan`) pass a finite `min`, so it bites the first caller with an endless low end.
- evidence: read (slider.ts:95, quantity/src/spin.ts:30-44, geom/src/scalar.ts:25)
- severity: low

## framesSweep counts a clock's passes differently from the clock: loop 0, a fraction below 1, or a negative count
- where: packages/ui-input/src/sweep.ts:138-144 (framesSweep)
- scenario: `FrameSpan` says "a `ClockSpec` is one", and labkit's `HeldClock` passes a clock's declaration straight in. The clock reads `loop` through `passesOf` (`packages/clock/src/place.ts:24`), `Math.max(1, loop)`, and `checkLoop` only rejects NaN. framesSweep uses `loop` raw. With `{ duration: 1000, loop: 0 }`, the clock runs one 1000 ms pass and ends; framesSweep with `passes: 'all'` walks `[0]` alone (end = 0), and with `'first'` walks 0…1000−every, stopping short of the end as though the run looped (`ends` is false since walked 1 ≠ passes 0). `loop: 0.5` gives the clock a full pass but the sweep half of one. `loop: -1` is a valid one-pass clock, but framesSweep throws `RangeError: a run loops 0 times or more`, so a `HeldClock` given that spec throws in render. framesSweep should take its pass count from the same rule (`Math.max(1, loop)`).
- evidence: read (sweep.ts:132-164, clock/src/place.ts:24, clock/src/validate.ts:34, labkit/src/clock/HeldClock.tsx:103)
- severity: medium

## movedIndex and isNoopDrop read a gap past the end differently from moveItems
- where: packages/ui-input/src/reorder.ts:22 (movedIndex), :28 (isNoopDrop)
- scenario: `moveItems` documents that "a gap past either end is that end" and that an index outside `items` names nothing, and clamps/filters accordingly before calling `movedIndex`. The exported `movedIndex` and `isNoopDrop` do neither (they have no length to clamp against). For a 3-item list, `moveItems(items, [0], 10)` puts the item at index 2, but `movedIndex([0], 10)` answers 9; for a 5-item list, `moveItems(items, [4], 7)` leaves the list unchanged while `isNoopDrop([4], 7)` answers false. Callers that pair them (`TokenField/tokenDrag.ts:28` reports `moveItems(...)` with `movedIndex(...)` for the same target) get an index that names no item whenever the target overshoots. Today's callers appear to pass gaps within `0..length`, so this bites only an unclamped caller.
- evidence: read (reorder.ts:12-34, ui/src/components/TokenField/tokenDrag.ts:28)
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

<!-- done: 3 findings, files read: 23 -->
