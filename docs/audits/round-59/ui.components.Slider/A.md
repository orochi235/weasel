# Audit round 59 — ui.components.Slider

## An endless Slider hands `onAddThumb` the track position, not the value the thumb will report
- where: packages/ui/src/components/Slider/Slider.tsx:80 (Slider, the `onAddThumb` wrapper)
- scenario: `endless: 'max'`, `min: 0`, `max: 5000`, `step: 50` (track runs to the end stop at 5050), `onAddThumb` set. A track press at or near the end stop calls `onAddThumb(5050)`; a press at 5020 calls `onAddThumb(5020)`. Neither number is one the slider ever reports: the returned thumb is handed back through `fromTrack`, so `onChange` gets `Infinity` for the first and `5000` for the second. The consumer is asked to build a thumb at a value outside `[min, max]` and then receives a different one. The wrapper should pass `fromTrack(at)`, as `keyStep` (fixed in 43caa71100), `renderRegion`, `renderReadout`, `spokenAt` and `onChange` already do. This is the one callback that fix missed.
- evidence: read (Slider.tsx:79–88 maps every other callback through `shown`/`fromTrack`; `useSliderPointer.ts` `onTrackPointerDown` calls `props.onAddThumb(v)` with `v` from `valueAt` in track values; `endlessTrack.fromTrack` in packages/quantity/src/endless.ts:39)
- severity: medium

## A thumb added under `constraint: 'ordered'` is appended out of order, and its first drag jumps it past its neighbor
- where: packages/ui/src/components/Slider/useSliderPointer.ts:557 (onTrackPointerDown, the `onAddThumb` branch)
- scenario: `constraint: 'ordered'`, thumbs `[10, 50]`, `onAddThumb: v => ({ value: v })`. A press at 30 commits `[10, 50, 30]`. Ordering is by list index (`clampOrdered` reads `thumbs[index - 1]` and `thumbs[index + 1]`), so thumb 2 now has 50 as its lower neighbor. Its first drag or arrow key clamps it to at least `50 + gap`, so it jumps across thumb 1. Its region (`renderRegion`) runs from 50 to 30, giving `SliderRegion` a negative width. The new thumb should be inserted at its sorted index (or the resulting list ordered) when the slider is ordered. The docs promise that `'ordered'` "keeps thumbs from crossing each other".
- evidence: read (useSliderPointer.ts:554–560; packages/ui-input/src/slider.ts:125 `clampOrdered`; thumbDragValues.ts `draggedValue`)
- severity: medium

## A region drag ignores a thumb drag already running, and a thumb press ignores a running region drag
- where: packages/ui/src/components/Slider/useRegionDrag.ts:630 (useRegionDrag's press handler), packages/ui/src/components/Slider/useThumbDrags.ts:378 (`held`)
- scenario: `renderRegion` + `regionDrag` on a multi-touch screen. Finger A drags thumb 1. Finger B presses the region between thumbs 1 and 2. `isPrimaryPress` checks only the button, so B passes. The region handler checks only its own `sessionRef`, so a second session opens with the thumbs as they stood at B's press. Both sessions then send `onInput` from their own snapshots, and the thumbs flicker between the two. Each release commits its own snapshot, so whichever ends last undoes the other's move. The reverse is the same: during a region drag, `onThumbPointerDown`'s `drags.held()` is false (it reads only the thumb session), so a second finger on a thumb opens a thumb drag, and the region's `onEnd` then commits its `latest`, which carries that thumb's stale value. `held` exists so "a second finger's press is not a new drag", but the two kinds of session answer that question separately.
- evidence: read (useThumbDrags.ts:377–378; useSliderPointer.ts:518/541; useRegionDrag.ts:626–630; packages/gestures/src/ui/pressButton.ts:21)
- severity: medium

## `useBoxes` keeps measuring the old elements when one is replaced and the thumb count stays the same
- where: packages/ui/src/components/Slider/useBoxes.ts:38–39 (useBoxes effect deps `[count, read, untransformed]`), used at SliderBody.tsx:152–153
- scenario: A Slider whose `renderTrack` switches from `undefined` to a painter, or whose layout switches between the straight and the curved branch (which remounts the track, the rail and every thumb), with the same number of thumbs. The effect does not re-run, so nothing is measured after the switch. `watchResize` keeps observing the detached old elements (or none, for the paint layer that did not exist), so no later resize corrects it either. After `renderTrack` appears, `boxes[2]` stays `{0, 0}`. `trackCtxOf` then builds `ctx.shape` from `x = -railW/2` to `railW/2` at `y = 0`, so a painter drawing through `shape` is drawn off the track. A custom thumb's `ThumbRenderCtx` box and `thumbLength` (which sets the curve's inside-fit inset) keep the old elements' sizes.
- evidence: read (useBoxes.ts:28–40; SliderBody.tsx:152–153, 176, 216/229; useSliderGeometry.ts:47–56)
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

<!-- done: 4 findings, files read: 40 -->
