# Findings: ui.components.Timeline

## An arrow step on a key past the limit moves it toward the limit whichever arrow was pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:174 (markKeys)
- scenario: `<Timeline duration={2000}>` over a sampled track with a key at t=2500 (the tracks outrun `duration`), or any key on a nested row whose `offset` is past `duration` (`last` = 0). Focus the key and press ArrowRight: `to = Math.max(0, Math.min(last, t + 10))` = 2000 (or 0), which differs from `t`, so `onKeyChange(i, 2000)` commits a 500 ms jump to the left. ArrowLeft does the same jump instead of a 10 ms step. A step should move the key the way the arrow points, or do nothing when that direction is refused; it should never move it the opposite way.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Lane.tsx
- size: line
- cause: clamp applied to the target without regard to the step's direction
- confidence: sure

## A graph-mode key drag never sets the preview, so the inspector shows the neighbor key while a dragged key is past it
- where: packages/ui/src/components/Timeline/Timeline.tsx:225 (bindLaneEdits, onKeysInput)
- scenario: graph mode, `onInput` wired and echoed back into `tracks` (the kit's edit protocol), `renderKeyEditor` given. Select key 0 of `x` and drag it past key 1. `onKeysInput` sends `setKeys(...)` with the keys re-sorted, but unlike the dope sheet's `onKeyInput` it never calls `report.preview`. `useKeyAndSegment`'s `inspected` therefore stays at index 0, and `TimelineInspector` reads index 0 of the echoed tracks, which is now the other key. Until release, the editor shows the neighbor's value, and a `commit`/`setEasing` from it lands on the neighbor. The dope sheet avoids this by setting the preview, so the two paths answer the question two ways.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: graph live edits skip the `preview` path the dope path uses
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
