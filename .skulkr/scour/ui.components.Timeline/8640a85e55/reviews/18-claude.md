# Findings: ui.components.Timeline

## An arrow step on a key past the duration moves it the wrong way, onto the limit
- where: packages/ui/src/components/Timeline/Lane.tsx:174 (markKeys)
- scenario: a sampled key sits at t=3000 and the consumer sets `duration` to 2000, so `last` = 2000. Pressing ArrowRight computes `to = max(0, min(2000, 3010)) = 2000`, which differs from t, so `onKeyChange(i, 2000)` commits a 1000 ms move to the left. A right step should move the key right, or else nothing. ArrowLeft from 3000 also jumps to 2000 instead of stepping 10 ms. Graph mode does the same: `LaneGraph` hands `xClamp = [0, limit - offset]` to the keyframe layer, and `nudgedKey`'s `clampTo` snaps the key back to the limit on any step.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: the clamp is applied to the stepped time without checking the step direction
- confidence: sure

## During a dope drag whose preview the consumer echoes back, segments move with the preview while key marks stay at their press-time places
- where: packages/ui/src/components/Timeline/Lane.tsx:131 (Lane, SegmentMarks vs KeyMarks)
- scenario: with `onInput` wired back into `tracks` (the controlled pattern), dragging key 1 of [0, 800, 1600] past 1600 re-sorts the echoed keys. `KeyMarks` draws `drag.times`, the press-time order [0, 800, 1600]. `SegmentMarks` reads `sampledKeys` from the echoed track, so it draws segments and their "segment into N ms" names from [0, 1600, 1700]. The selected-segment highlight and the segment geometry then disagree with the key marks drawn beside them until release. Both should read from one key list.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneMarks.tsx
- size: function
- cause: two key lists drawn on one lane mid-drag
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
