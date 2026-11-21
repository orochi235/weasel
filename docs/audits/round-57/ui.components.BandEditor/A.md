# Audit round 57 — ui.components.BandEditor

## An empty `value` throws on render
- where: packages/ui/src/components/BandEditor/BandStrip.tsx:71 (renderRegion → bandBounds), packages/ui/src/components/BandEditor/retag.ts:34 (bandName)
- scenario: `<BandEditor value={[]} min={0} max={1} onChange={…} />`. With no bands there are no thumbs, but `Slider` still draws its one region after the last thumb (`regionAt(thumbs.length)`, i.e. index 0). `bandBounds([], 0, lo, hi)` takes the `to` branch `bands[index + 1].from` because `0 !== bands.length - 1` (−1), and reads `.from` of `undefined`, which throws a TypeError. `bandName` would throw next on `bands[0]!.from`. The rest of the module treats an empty list as valid input: `normalizeBands` and `splitBands` guard `length === 0`, and BandEditor reads `shown[0]?.from`. It should render an empty strip, or the props should rule out an empty list.
- evidence: read
- severity: medium

## A previewing `onRangeInput` caller sees the axis shrink under an inward edge drag, so the end leaves the pointer
- where: packages/ui/src/components/BandEditor/BandEditor.tsx:141 (drawnAxis(sc, min, max, draft?.range)), packages/ui/src/components/BandEditor/scale.ts:24 (drawnAxis)
- scenario: the consumer wires `onRangeInput` to write `min`, `max` and `value` live, the previewing pattern the seam drag was fixed for in 8d44534a59. They drag `max` inward from 100 to 50 on a 0–100 range. Without a preview, `drawnAxis(…, 0, 100, [0, 50])` keeps the axis at [0, 100], so the end sits at 50% of the track, under the pointer. With the preview the next render passes `max = 50`, so the axis becomes [0, 50]: the end draws at the track's right end, the bands stretch across the whole track and the ruler is relabeled. Meanwhile the drag's press-time `pointerUnit`/`fit` still read the pointer against the [0, 100] axis. The comment at line 136 says the control follows the drag "whether or not the consumer wires `onInput`", but for an edge drag that only holds when nothing is previewed. Edge drags should draw against the range the drag began from, as `seamCommit` measures against `draft.from`.
- evidence: read (reasoned through the render; not run)
- severity: medium

## Home and End on a range end do nothing when no band is locked, yet the end advertises that limit as `aria-valuemin`/`aria-valuemax`
- where: packages/ui/src/components/BandEditor/RangeEdgeHandle.tsx:99-108 (onKeyDown), packages/ui/src/components/BandEditor/bands.ts:126-131 (edgeReach)
- scenario: with no locked band, `edgeReach` for the `max` end returns `inner = edges[0] + 0`, the far end. Pressing Home on the max end sets `to = reachLo`, and `scaleEdges` then gets `total = 0` and returns `null`. The handler has already called `preventDefault`, so the key is swallowed and nothing moves. End on the `min` end fails the same way. `aria-valuemin`/`aria-valuemax` still announce `fromBase(reachLo)`/`fromBase(reachHi)`, a value the slider can never reach. Home/End should stop at the nearest value that does not collapse the range, or the ARIA bound should match what the slider can actually reach.
- evidence: read
- severity: low

## A range end ignores PageUp and PageDown, which every other `role="slider"` in the strip answers
- where: packages/ui/src/components/BandEditor/RangeEdgeHandle.tsx:102 (onKeyDown via track.ts `arrowStep` → `arrowSteps`)
- scenario: focus the `Range end` slider and press PageUp. `arrowStep` uses `arrowSteps`, which returns null for the Page keys, so the key falls through and the end does not move. The seams beside it are `Slider` thumbs, which do step on those keys. `rangeKey` in `@weasel-js/ui-input` is the shared answer for a range's keys: it covers the Page keys and Home/End, and the edge handle does not use it. So one question, which keys step a slider, is answered two ways in one control. The two files also each define their own `KEY_STEP = 0.01` (BandStrip.tsx:13, track.ts:6).
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

<!-- done: 4 findings, files read: 16 -->
