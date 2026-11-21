# Audit round 59 — ui.components.Slider

## An endless low end under a log `scale` throws on render
- where: packages/ui/src/components/Slider/Slider.tsx:44 (Slider) → packages/ui/src/components/Slider/useSpan.ts:39 (useScale)
- scenario: `<Slider min={1} max={1000} step={1} endless="min" scale={logScale} …/>`. `endlessTrack` moves the track's low end one step out to 0 (with no step, to 1 − 999/20 ≈ −48.95), SliderBody gets `min: track.min`, and `useScale` calls `scale({ domain: [0, 1000] })`; `logScale` throws "a domain of 0..1000 does not lie above zero" during render, so the whole slider crashes. `endless="max"` works. The low end's infinity stop should be placed somewhere the scale can map (e.g. a fraction beyond the span, not a value), or the combination rejected with a clear message.
- evidence: read (packages/quantity/src/endless.ts:31, packages/scale/src/log.ts:28)
- severity: medium

## `onAddThumb` on an endless slider receives a raw track position, not a value
- where: packages/ui/src/components/Slider/Slider.tsx:79 (Slider, onAddThumb wrapper)
- scenario: `endless="max"`, min 0, max 100, step 10, `onAddThumb` set. A click on the track's end stop (track value 110) calls `onAddThumb(110)`: the wrapper passes `at` through unmapped, while every other outward path (onInput/onChange via `shown`, renderRegion, spokenAt) maps through `fromTrack`, which would give `Infinity`. The consumer is handed a value outside `[min, max]` that is neither a real value nor infinity; it should get `fromTrack(at)`. (A returned thumb is also not mapped with `toTrack`, but `Infinity` is clamped later, so that half is benign.)
- evidence: read
- severity: medium

## A shift-all drag pulls thumbs off `snap: 'strict'` detents and off the step grid under a scale or even spacing
- where: packages/ui/src/components/Slider/useThumbDrags.ts:108 (beginShiftAllDrag) / packages/ui/src/components/Slider/thumbDragValues.ts:36 (shiftedValues)
- scenario: `allowShiftAll snap="strict" stops={[0, 25, 50, 75, 100]}`, thumbs at 25 and 75. Shift-drag by 3% of the track: the linear path snaps the delta to `step` (undefined → no snap), so the thumbs commit at 28 and 78, between detents, although strict promises "every stop a detent the thumb must rest on". With `spacing: 'even'` or a `scale`, `byTrack` moves by raw fraction and never applies `step` either, so `step={1}` with `scale={logScale}` commits 12.3456…. The single-thumb drag routes every value through `valueAt` (strict, step, stops); the shift-all path answers the same question without them. The region drag (useRegionDrag.ts:57, `fractionToValue(f[i] + shift)`) has the same gap. Listed as Open, not ruled, in docs/unruled.md:1844.
- evidence: read
- severity: medium

## A key that cannot move a thumb still commits an edit
- where: packages/ui/src/components/Slider/thumbKeys.ts:41 (onThumbKeyDown)
- scenario: a thumb at `max`; press End, ArrowRight or PageUp. `sliderKey` returns the clamped value, equal to the current one, and the handler calls `onInput` and `onChange` with an identical thumb list (and prevents default). The drags were changed to commit nothing when nothing moved (`finish` in useThumbDrags.ts, "commit nothing for a Slider region drag released where it began"); the key path answers that the other way, so a held key at an end floods `onChange` (and an undo stack fed by it) with no-op commits. Compare with `sameThumbValues` before emitting. docs/conventions.md "Edit callbacks" says `onChange` fires "never … for one that changed nothing"; listed as Open, not ruled, in docs/unruled.md:1835.
- evidence: read
- severity: low

## On an endless slider whose range is not a whole number of steps, a drag can never reach the finite end
- where: packages/ui/src/components/Slider/useSpan.ts:47 (useScale valueAt) with packages/ui/src/components/Slider/Slider.tsx:74
- scenario: `min={0} max={100} step={30} endless="max"`, no stops. The track runs to `track.max` 130 and `sliderAt` snaps to the grid from 0 and clamps to the *track* (0..130), not to the range. A pointer at 95–105 lands on 90, one at 105–130 lands on 120, which `fromTrack` reports as `Infinity` (20 ≥ gap/2) although the thumb is drawn at 120 and then jumps to 130 when the value comes back. 100, the finite max, is unreachable by drag (the keyboard's `crossEnd` does reach it). Without `endless` the same slider reaches 100, because there the clamp to `max` is the clamp to the range. The drag path should clamp a snapped value to `range` before the end stop, as the key path does.
- evidence: read (packages/ui-input/src/slider.ts:95, packages/quantity/src/endless.ts:39, packages/quantity/src/spin.ts:30)
- severity: medium

## A region drag and a thumb drag can run at once, each writing its own snapshot
- where: packages/ui/src/components/Slider/useRegionDrag.ts:47 (useRegionDrag) / packages/ui/src/components/Slider/useSliderPointer.ts:34,57
- scenario: touch, `regionDrag` on, three thumbs. Finger one drags thumb 0; finger two presses region 2. The thumb press and track press refuse a second finger through `drags.held()`, but the region handler checks only its own `sessionRef`, and `held()` does not know about region sessions either way (a thumb press during a region drag also starts). Both sessions call `onInput` each move with lists built from their own start snapshot, so every frame one overwrites the other's thumbs and the two releases commit conflicting lists. One press should own the slider, as useThumbDrags.ts:127 states for the thumb drags.
- evidence: read
- severity: low

## `useBoxes` never measures an element that appears without the thumb count changing
- where: packages/ui/src/components/Slider/useBoxes.ts:43 (useBoxes) as used by packages/ui/src/components/Slider/SliderBody.tsx:59
- scenario: a slider first rendered without `renderTrack` that is later given one (or one that moves into or out of an `Along`, which swaps the track, rail and thumb elements). The effect reruns only on `count` (`thumbs.length`), so the new paint layer (or rail) is never measured nor observed: `boxes[2]` stays `{0, 0}` and `trackCtxOf` hands the painter a `shape` running from `-railW/2` at y 0 with the layer's size 0, and on the curve-to-line switch `boxes[1]` (the rail) and the thumbs' `ThumbRenderCtx` box stay at whatever the old elements last read. The effect should rerun when the element set changes, not only its length.
- evidence: read
- severity: low

## A thumb's `aria-valuemin`/`aria-valuemax` ignore its own `bounds`
- where: packages/ui/src/components/Slider/SliderThumb.tsx:49 (SliderThumb)
- scenario: `thumbs={[{ value: 50, bounds: [20, 80] }]}` on 0..100. The thumb publishes `aria-valuemin="0" aria-valuemax="100"`, but Home moves it to 20 and End to 80 (`sliderKey` reads `bounds`), and no drag passes them. A screen reader announces a range the thumb cannot reach. Same for `constraint: 'ordered'` neighbors, where APG's multi-thumb pattern has each thumb publish the limits its neighbors set.
- evidence: read
- severity: low

## Escape after a thumb drag has come back to its start sends no `onCancel`, while a region drag sends one
- where: packages/ui/src/components/Slider/useThumbDrags.ts:21 (finish) vs packages/ui/src/components/Slider/useRegionDrag.ts:72
- scenario: drag a thumb away (several `onInput`s) and back to where it began, then press Escape. `finish` sees the buffer equal to `start` and returns: no `onCancel`. The same sequence on a region drag calls `onInput(moved(0))` and `onCancel()`. A caller that opens a transaction or overlay on `onInput` (the convention's stated use of `onCancel`) is left with it open after the thumb drag; the two drags answer "was this edit canceled" two ways.
- evidence: read
- severity: low

## A thumb added by a track click is appended last, breaking `constraint: 'ordered'`
- where: packages/ui/src/components/Slider/useSliderPointer.ts:73 (onTrackPointerDown)
- scenario: `constraint="ordered" onAddThumb={v => ({ value: v })}`, thumbs at 30 and 70; click the track at 10. The new list is `[30, 70, 10]`: the created thumb goes to the end whatever its value. From then on `clampOrdered` for index 2 has a neighbor above it at 70 and none above, so dragging it holds it at ≥ 70 + gap and it jumps there on the first move; regions (documented as suiting ordered thumbs) draw region 2 from 70 to 10, a negative-width box, and region drag reads `f[index+1]` out of order. Under `ordered` the thumb should be inserted at its sorted index (and the index reported to the caller), or the value clamped.
- evidence: read (packages/ui-input/src/slider.ts:125, packages/ui/src/components/Slider/SliderRegion.tsx:42)
- severity: medium

## An end stop's label is pulled off center when that stop is not at the track's end
- where: packages/ui/src/components/Slider/SliderMarks.tsx:39 (edgeOf) with Slider.module.css:245
- scenario: `min={0} max={100} stops={[{ value: 40, label: 'Forty' }, { value: 60, label: 'Sixty' }]}`. `edgeOf` marks the first and last *stops* as `left`/`right` edges by their index alone, and the stylesheet's `translateX(max(-50%, -inset))` then shifts "Forty" right so its left edge sits at most an inset left of its stop, though the stop sits 40% in and nowhere near the track edge. The rule exists to keep a label at `min`/`max` inside the control; it should apply only when the stop's fraction is 0 or 1.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Slider/ReadoutsAlong.tsx
packages/ui/src/components/Slider/ReadoutsBelow.tsx
packages/ui/src/components/Slider/Slider.detents.stories.module.css
packages/ui/src/components/Slider/Slider.detents.stories.tsx
packages/ui/src/components/Slider/Slider.module.css
packages/ui/src/components/Slider/Slider.stories.module.css
packages/ui/src/components/Slider/Slider.stories.tsx
packages/ui/src/components/Slider/Slider.tsx
packages/ui/src/components/Slider/SliderBand.tsx
packages/ui/src/components/Slider/SliderBody.tsx
packages/ui/src/components/Slider/SliderMarks.tsx
packages/ui/src/components/Slider/SliderRegion.tsx
packages/ui/src/components/Slider/SliderThumb.tsx
packages/ui/src/components/Slider/index.ts
packages/ui/src/components/Slider/lab/SliderArc.stories.module.css
packages/ui/src/components/Slider/lab/SliderArc.stories.tsx
packages/ui/src/components/Slider/lab/SliderArcView.tsx
packages/ui/src/components/Slider/lab/sliderArcConfig.ts
packages/ui/src/components/Slider/lab/useTwinMeasure.ts
packages/ui/src/components/Slider/paintGradientCurve.tsx
packages/ui/src/components/Slider/paintGradientTrack.module.css
packages/ui/src/components/Slider/paintGradientTrack.tsx
packages/ui/src/components/Slider/sliderGeometry.ts
packages/ui/src/components/Slider/sliderSlop.module.css
packages/ui/src/components/Slider/staggerRows.ts
packages/ui/src/components/Slider/stops.ts
packages/ui/src/components/Slider/tagged.ts
packages/ui/src/components/Slider/testing/stubRect.ts
packages/ui/src/components/Slider/thumbDragValues.ts
packages/ui/src/components/Slider/thumbKeys.ts
packages/ui/src/components/Slider/types.ts
packages/ui/src/components/Slider/useBoxes.ts
packages/ui/src/components/Slider/useDetents.ts
packages/ui/src/components/Slider/useLatestHandlers.ts
packages/ui/src/components/Slider/useRegionDrag.ts
packages/ui/src/components/Slider/useSliderGeometry.ts
packages/ui/src/components/Slider/useSliderHold.ts
packages/ui/src/components/Slider/useSliderPointer.ts
packages/ui/src/components/Slider/useSpan.ts
packages/ui/src/components/Slider/useThumbDrags.ts

<!-- done: 11 findings, files read: 40 -->
