## A graph-mode key drag sends no preview selection, so the inspector shows the wrong key while a re-sorting drag is echoed back
- where: packages/ui/src/components/Timeline/Timeline.tsx:228 (bindLaneEdits, onKeysInput)
- scenario: Graph mode, a consumer wiring `onInput` and echoing it into `tracks`, key 0 selected with `renderKeyEditor`. Drag key 0 past key 1. `onKeysInput` → `setKeys` → `onInput`, and the echoed tracks now hold the dragged key at index 1. Unlike the dope-sheet path (`onKeyInput`), nothing calls `report.preview`, so `useKeyAndSegment`'s `inspected` stays at index 0. While the drag runs, the inspector renders key 1's value and easing (the neighbor) as though it were the dragged key, and any `commit`/`setEasing` it makes during the drag lands on the neighbor. The dope sheet gets this right through `preview`, so the same question has two answers.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: graph preview path skips `preview`
- confidence: likely

## The ruler keeps its `ew-resize` scrub cursor while the timeline is read-only or disabled, when nothing scrubs
- where: packages/ui/src/components/Timeline/Timeline.module.css:5 (.ruler)
- scenario: `readOnly` or `disabled` Timeline. `Timeline.tsx` passes `onSeek={edits ? onSeek : ignore}`, so a press on the ruler does nothing, but `.ruler` still shows `cursor: ew-resize`. The held rule at the bottom of the stylesheet resets the cursor only for `.key, .eventMark` ("nothing invites a drag"), not for the ruler.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.module.css
- size: line
- cause: held-cursor rule misses the ruler
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
