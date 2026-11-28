# Findings: ui.components.Timeline

## A graph-mode key dragged past the lane's value extent runs away: the y range is rebuilt from the live drag every move
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:126 (LaneGraph, `valueRange(state.keys)`)
- scenario: In graph mode, keys valued 0, 120, 40. Drag the 120 key upward. `state` is `live` during the drag, and `live.keys` with the drag applied feed `valueRange`, so `yRange` is rebuilt every render from the dragged value. The keyframe layer sets the dragged value to the pointer's absolute model y under the current `yRange` (`createKeyframeLayer.tsx:87`, `value: clampTo(model.y, …)`). Once the key is the extreme, the range widens so the key sits at the 8% inset again, below the pointer. The next pointermove, even 1px, maps under the wider range to a larger value, so the value grows each move and the key never stays under the cursor. Dragging the max key down has the opposite problem: it stays pinned at the top inset while its value shrinks, so where the user lets go does not match the value that gets committed. What should happen: the range a drag reads is held fixed for the whole gesture (taken from `committed.keys`, or frozen at press), so the key follows the pointer.
- evidence: read (LaneGraph `state = live ?? committed` → `valueRange(state.keys)` → `yRange`; the layer's key drag takes `model.y` absolutely)
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: value axis derived from live drag state
- confidence: likely

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

<!-- done: 1 findings, files read: 18 -->
