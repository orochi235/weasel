## A graph lane's value range follows the keys being dragged, so dragging the top or bottom key outward runs away from the pointer
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:134 (LaneGraph, `valueRange(state.keys)`)
- scenario: graph mode, numeric track with keys 0, 120, 40. Drag the key at 120 upward inside the lane. Each move, `onLayerChange` sets `live` to the dragged state, so `yRange` is recomputed from the live keys and widens past the new value. The editor maps the pointer through the current `yRange` (`useLayerGesture` calls `toModel` with the live plot each move, and `LaneGraph` passes no `yClamp`), so the same pixel now reads a larger value, and every further pixel of travel adds more than the last. The key is drawn below the pointer, and the value climbs faster than the hand moves. The same happens dragging the lowest key down. Expected: the range is held for the length of the gesture (from `committed.keys`, or the range at press), so the key stays under the pointer.
- evidence: read (LaneGraph.tsx; CurveEditor/useLayerGesture.ts:74-77, createKeyframeLayer.tsx:85-87)
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: plot range derived from in-flight drag state
- confidence: likely

## An arrow step on a key past the timeline's end jumps it to the end, so Right moves it left
- where: packages/ui/src/components/Timeline/Lane.tsx:170 (markKeys)
- scenario: `duration` 2000, a sampled track with a key at t=2500 (tracks may hold keys past the duration; nothing clamps them). Focus the key and press ArrowRight: `to = max(0, min(last, 2510))` = 2000, which differs from t, so `onKeyChange(i, 2000)` moves the key 500 ms left. ArrowLeft also jumps it to 2000 rather than stepping to 2490. Expected: a step moves the key by its step in the arrow's direction, or refuses when it would land past the limit, never moving it the other way. The graph lane's `xClamp` (LaneGraph.tsx:78) applies the same clamp to a key step there.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: clamp applied to a key already outside the clamp range
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

<!-- done: 2 findings, files read: 18 -->
