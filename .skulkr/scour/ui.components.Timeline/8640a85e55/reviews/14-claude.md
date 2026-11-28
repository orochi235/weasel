# Findings: ui.components.Timeline

## An arrow step or drag on a key already past `limit` throws it back to `limit`, whichever way it was pushed
- where: packages/ui/src/components/Timeline/Lane.tsx:181 (markKeys)
- scenario: Take a `<Timeline duration={2000}>` where a sampled track has a key at t=2500. That is reachable: `duration` is a prop of its own, and an animator timeline may declare a duration shorter than its keys. The key's mark is outside the window but stays in the tab order. Tab to it and press ArrowRight. `to = max(0, min(last=2000, 2510))` = 2000, so the key commits at 2000 and moves 500 ms *left*. A right step should either move it right or do nothing. Nested rows are worse. A nested timeline with `at` ≥ `duration` gets `last = max(0, limit - offset) = 0`, so any arrow press in either direction sends the key to row time 0. In useKeyDrag.ts:47 the drag track is `{ min: offset, max: max(offset, limit) }`, which pins every drag on such a row to row time 0. LaneGraph.tsx:78's `xClamp` `[0, max(0, limit - offset)]` gives the graph-mode nudge the same collapse.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: clamp to limit ignores a key already beyond it
- confidence: sure

## Escape anywhere in the timeline, including the inspector and transport, drops the selected segment
- where: packages/ui/src/components/Timeline/Timeline.tsx:105 (onRootKeyDown)
- scenario: Select a segment, so the inspector shows its `EasingPicker`. Focus a control in the picker or the transport and press Escape, for example to back out of something inside the picker that does not `preventDefault` the key. The keydown bubbles to the root. The Escape branch checks only `segmentSelection && !hold.disabled`. It does not check `onTimeline(e)`, which the Delete branch below it does. So `dropSegment()` runs and the inspector the user was working in unmounts under them. Escape should drop the segment only when the press lands on the root or the lanes, the same scope Delete uses.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx
- size: line
- cause: missing onTimeline scope on Escape branch
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
