## An edge drag cannot snap to a tick outside the current range, and ticks beyond it pull the edge back to where it started
- where: packages/ui/src/components/BandEditor/useTrackPointer.ts:20 (snapped), with packages/ui/src/components/BandEditor/scale.ts:14 (trackOf.toUnit)
- scenario: `onRangeChange` set, `ticks` include values beyond `max` (the story's `RescaleTheRange` has `limits: [1/256, 1]` and ticks up to 1/3 with max 1/2; any tick past max qualifies). `snapped` maps tick values through the drawn axis's `toUnit`, which is `clamp01(unit.position(v))`, so every tick past `max` lands at exactly 1 and every tick below `min` at 0. Dragging the max edge outward: within the snap radius of the track end, the pointer is attracted to 1, which is the current max, so the edge sticks in place; further out, no tick ever attracts because they all sit at 1. Expected: outward ticks are snap targets at their real (unclamped) track positions, as `pointerUnit`'s doc says ("unclamped and snapped").
- evidence: read
- severity: medium

## A custom `splitBand` gives the new band the first tagged band's unit and display, not its parent's
- where: packages/ui/src/components/BandEditor/retag.ts:17-20 (retagBands)
- scenario: bands with differently tagged `from`s (band 0 tagged in one display/unit, band 2 in another) and a `splitBand` that mints fresh data (as the `SplitMintsAPayload` story does). After a split the count changes, so the source band is looked up by `b.data === band.data`; the new payload matches nothing and falls back to `firstTagged`, so the split-off band takes band 0's tag. The doc on the same function says "a split band inherits its parent's presentation", and `BandEditorProps.value` promises a tagged `from` keeps its display through every edit. The same lookup-by-data also picks the wrong source whenever two bands share a payload (the default `keepData` split makes both halves share one): after a later merge or split, the second of them takes the first's tag.
- evidence: read
- severity: low

## An empty `value` throws during render
- where: packages/ui/src/components/BandEditor/BandStrip.tsx:71-78 (renderRegion), via packages/ui/src/components/BandEditor/bands.ts:40 (bandBounds)
- scenario: `value={[]}` (e.g. a consumer that has not loaded its bands yet). `Slider` always draws the region after the last thumb (`regionAt(thumbs.length)` in SliderBody), so with zero thumbs it calls `renderRegion({ index: 0 })`. `bandBounds([], 0, lo, hi)` reads `bands[1].from` (0 is not `length - 1 === -1`), which throws a TypeError, and `bands[i]!.locked` / `bandName`'s `bands[index]!.from` would too. Expected: an empty strip, or a documented requirement that `value` is non-empty; neither the props doc nor `normalizeBands` (which handles length 0) suggests empty input is invalid.
- evidence: read
- severity: low

## A range edge advertises an `aria-valuemin`/`aria-valuemax` it can never reach, and Home/End on it does nothing
- where: packages/ui/src/components/BandEditor/RangeEdgeHandle.tsx:67, 99-108, 120-121 (onKeyDown, aria attrs), with packages/ui/src/components/BandEditor/bands.ts:126-131 (edgeReach)
- scenario: no band locked, `onRangeChange` set. For the max edge `edgeReach` gives an inward reach of `edges[0] + lockedSpan = 0`, the point where the range collapses, which `scaleEdges` rejects (`total > 0` fails, returns null). So the handle reports `aria-valuemin = min`, and pressing Home calls `preventDefault()` and then `fit(0)` returns null and nothing changes. The same holds for the min edge's `aria-valuemax`/End. Expected: the advertised bound is a value the slider can take, and Home/End move the edge as far as it can go.
- evidence: read
- severity: low

## Rescaling the range round-trips untouched seams through track units, so seams the rescale should hold drift
- where: packages/ui/src/components/BandEditor/RangeEdgeHandle.tsx:74 (fit)
- scenario: drag the max edge with the leading bands locked. `scaleEdges` returns those edges unchanged, but `fit` rebuilds every `from` as `fromBase(next[i]) = unit.invert(unit.position(from))`, so a seam that did not move comes back off by rounding (more on the log scale, which goes through log/exp). A consumer storing an exact value (1/12, which the stories' ticks and the `fraction()` display center on) gets a slightly different number after any rescale, and repeated rescales accumulate. Expected: a seam whose track position did not change keeps its committed value. (Inference from the arithmetic; not run.)
- evidence: read
- severity: low

## Files read
packages/ui/src/components/BandEditor/BandEditor.module.css
packages/ui/src/components/BandEditor/BandEditor.stories.tsx
packages/ui/src/components/BandEditor/BandEditor.tsx
packages/ui/src/components/BandEditor/BandRuler.tsx
packages/ui/src/components/BandEditor/BandStrip.tsx
packages/ui/src/components/BandEditor/DraftGhost.tsx
packages/ui/src/components/BandEditor/RangeEdgeHandle.tsx
packages/ui/src/components/BandEditor/bandCommands.ts
packages/ui/src/components/BandEditor/bands.ts
packages/ui/src/components/BandEditor/index.ts
packages/ui/src/components/BandEditor/retag.ts
packages/ui/src/components/BandEditor/scale.ts
packages/ui/src/components/BandEditor/seamGhost.ts
packages/ui/src/components/BandEditor/track.ts
packages/ui/src/components/BandEditor/useBandDraft.ts
packages/ui/src/components/BandEditor/useTrackPointer.ts

<!-- done: 5 findings, files read: 16 -->
