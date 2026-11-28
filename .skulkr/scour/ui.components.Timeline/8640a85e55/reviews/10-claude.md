## An arrow step on a key past the timeline's duration moves it the wrong way, to the limit
- where: packages/ui/src/components/Timeline/Lane.tsx:170 (markKeys)
- scenario: `duration` 2000, a sampled key at t=2500 (the consumer shortened `duration`, or a nested row's key sits past it). Focus the key and press ArrowRight: `to = Math.max(0, Math.min(last, t + 10))` = 2000, which differs from 2500, so `onKeyChange(i, 2000)` commits a 500 ms jump to the left. A right step should leave the key alone, since it cannot move further right, and never move it left. Shift+ArrowLeft behaves the same: one 100 ms step becomes a 500 ms jump. Graph mode has the same issue through the layer's `xClamp` (`LaneGraph.tsx` `xClamp`, applied by `nudgedKey`).
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/CurveEditor/keyframeEdits.ts
- size: line
- cause: the clamp is applied to a step that moves away from the bound
- confidence: sure

## onCancel fires for drags whose input the consumer never received
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:93 (onKeyPointerDown onEnd/onCancel); packages/ui/src/components/Timeline/Timeline.tsx:188 (bindLaneEdits onKeyInput)
- scenario: a `<Timeline>` given `onChange` and `onCancel` but no `onInput`. In a dope lane, drag a key past the threshold, then release it back on its own time or press Escape. `bindLaneEdits.onKeyInput` returns early because `report.onInput` is unset, but `useKeyDrag` still sets `previewed = true` on every move, so the release or cancel calls `onRevert` and then `onCancel()`. The consumer gets a cancel for an edit it never saw start. Graph mode does the same: Lane always passes `onKeysInput` (bindLaneEdits makes it an `onInput?.` no-op), so `LaneGraph` records `previewed.current` and `onLayerCancel` calls `onCancel`. Under the edit protocol, a cancel answers inputs that were sent, so nothing should fire here.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/Lane.tsx
- size: function
- cause: the preview is recorded at the lane even when the timeline forwards no input
- confidence: likely

## In a graph-mode drag, the inspector shows a different key once the preview re-sorts the dragged one
- where: packages/ui/src/components/Timeline/Timeline.tsx:191 (bindLaneEdits onKeysInput)
- scenario: graph mode, with a consumer that echoes `onInput` back into `tracks`. Select key 1 of 3 and drag it past key 2. The echoed tracks now hold the dragged key at index 2, but `onKeysInput` never calls `report.preview`, unlike the dope path's `onKeyInput`. So `inspected` stays at index 1, and `TimelineInspector` (and `renderKeyEditor`'s `key`/`commit`) reads and writes the neighbor key that now sits there. The dope path handles exactly this through `preview`/`inspected`.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: graph previews skip the preview selection mapping
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

<!-- done: 3 findings, files read: 18 -->
