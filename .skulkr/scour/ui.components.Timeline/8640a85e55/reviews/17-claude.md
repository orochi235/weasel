# Findings: ui.components.Timeline

## ArrowRight on a key past the timeline's duration moves it left, to the duration
- where: packages/ui/src/components/Timeline/Lane.tsx:186 (markKeys)
- scenario: A sampled track has a key at t=3000 and `duration` is 2000. The duration may have shrunk, or the consumer may hold keys past the end. Focus the key and press ArrowRight. `to = Math.max(0, Math.min(last, t + 10))` gives `min(2000, 3010) = 2000`, and `to !== t`, so `onKeyChange(i, 2000)` commits a 1000 ms jump to the left. A right step should move the key right, or refuse because it is already past the limit. It should never move the key the other way. ArrowLeft has the same problem: one 10 ms step jumps it all the way to the limit.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx
- size: line
- cause: clamp applied to the target without regard to step direction
- confidence: sure

## In graph mode the inspector shows the wrong key during a drag that re-sorts it; dope mode guards against this
- where: packages/ui/src/components/Timeline/Timeline.tsx:207 (bindLaneEdits, onKeysInput)
- scenario: The consumer echoes `onInput` back through `tracks`. In graph mode, drag key 1 past key 2. `LaneGraph` publishes `applyKeyframeDrag(next).keys`, which are re-sorted, through `onKeysInput`. Timeline sends `setKeys(...)` to `onInput`, but unlike the dope path's `onKeyInput` it never calls `report.preview`. In `useKeyAndSegment` the echoed tracks match `sent`, so the held selection survives at index 1. `inspected` falls back to that selection, because no preview was recorded. `renderKeyEditor` is then handed the neighbor key (now at index 1) for the rest of the drag. The dope path uses `preview` and `inspected` for exactly this case, so the two modes answer the same question two ways.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: graph-mode preview not recorded through `preview`
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

<!-- done: 2 findings, files read: 18 -->
