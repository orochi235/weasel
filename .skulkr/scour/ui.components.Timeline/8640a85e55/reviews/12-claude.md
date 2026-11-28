# Findings: ui.components.Timeline (frozen 8640a85e55)

## An arrow step on a key past the limit jumps it to the limit, so ArrowRight moves it left
- where: packages/ui/src/components/Timeline/Lane.tsx:180 (markKeys)
- scenario: `<Timeline duration={1000}>` with a sampled key at t=1500 (a consumer shortens `duration` under existing keys, or loads tracks longer than the duration it passes). Focus the key and press ArrowRight: `to = Math.max(0, Math.min(last, t + 10))` = `min(1000, 1510)` = 1000, which differs from `t`, so `onKeyChange(i, 1000)` commits a 500 ms move to the left. ArrowLeft does the same instead of moving 10 ms. A step should move the key by one step in the arrow's direction (or refuse), never jump it backward across the track.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx (its `xClamp` feeds the layer's nudge the same way)
- size: line
- cause: clamp applied to a key already outside the clamp range
- confidence: likely

## Deleting a row's last key by keyboard drops focus to the document body
- where: packages/ui/src/components/Timeline/Lane.tsx:225 (useFocusFollowsKey)
- scenario: focus the only key on a sampled row and press Delete. The lane sets `refocus`, the root deletes the key, and `deleteKey` returns `selection: null`. The effect runs with `selection === null` and focuses nothing, while the focused mark has been removed from the DOM, so focus falls to `document.body`. Further Delete/arrow/Escape presses no longer reach the timeline's root handler and keyboard users lose their place. Focus should land somewhere inside the timeline (the lane track, the root, or a neighboring row's key).
- evidence: read
- severity: low
- size: function
- cause: no fallback focus target when no key is selected after delete
- confidence: likely

## In graph mode the inspector shows the wrong key while an echoed drag re-sorts it
- where: packages/ui/src/components/Timeline/Timeline.tsx:206 (bindLaneEdits, onKeysInput)
- scenario: graph mode, a consumer wiring `onInput` back into `tracks` (the supported echo case). Drag key 1 past key 2: `onKeysInput` sends `setKeys(...)` with the key now at index 2, but never calls `report.preview`, so `useKeyAndSegment`'s `inspected` stays at index 1, which in the echoed tracks is the other key. `renderKeyEditor` is handed the neighbor's key (and `commit` would write its value) for the rest of the drag. The dope-sheet path calls `preview(r)` for exactly this; the graph path answers the same question differently.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: graph previews bypass `preview`
- confidence: likely

## A nested timeline's run length reimplements animator's default duration
- where: packages/ui/src/components/Timeline/lanes.ts:96 (timelineSpan, trackEnd, declaredSpan)
- scenario: `timelineSpan`/`trackEnd` copy animator's `tracksEnd`/`trackEnd` (packages/animator/src/timeline/createTimeline.ts:21) rather than calling one definition. They already differ at the edge: animator's `lengthOf` throws a `RangeError` on a `NaN` duration, while `declaredSpan` silently reads it as 0, so the lane draws a zero-length nested bar and marks every key past its end for a timeline the animator would refuse. Any later change to how animator derives a nested timeline's end will not reach the ruler.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/createTimeline.ts (export the end computation)
- size: function
- cause: duplicated derivation of timeline end
- confidence: sure

## Files read
packages/ui/src/components/Timeline/AnimatedTimeline.tsx
packages/ui/src/components/Timeline/Lane.tsx
packages/ui/src/components/Timeline/LaneGraph.tsx
packages/ui/src/components/Timeline/LaneMarks.tsx
packages/ui/src/components/Timeline/TimeRuler.stories.module.css
packages/ui/src/components/Timeline/TimeRuler.stories.tsx
packages/ui/src/components/Timeline/TimeRuler.tsx
packages/ui/src/components/Timeline/Timeline.module.css
packages/ui/src/components/Timeline/Timeline.stories.module.css
packages/ui/src/components/Timeline/Timeline.stories.tsx
packages/ui/src/components/Timeline/Timeline.tsx
packages/ui/src/components/Timeline/TimelineInspector.tsx
packages/ui/src/components/Timeline/index.ts
packages/ui/src/components/Timeline/keys.ts
packages/ui/src/components/Timeline/lanes.ts
packages/ui/src/components/Timeline/timeScale.ts
packages/ui/src/components/Timeline/timelineState.ts
packages/ui/src/components/Timeline/useKeyDrag.ts

<!-- done: 4 findings, files read: 18 -->
