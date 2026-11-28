# Findings: ui.components.Timeline

## A read-only graph lane selects a different key when a key is dragged past its neighbor
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:89 (LaneGraph, onLayerChange)
- scenario: `readOnly` (or a read-only scope) timeline in graph mode, keys at 0/500/1000. Press key 1 and drag it past 1000, release. With `edits` false, `onLayerChange` drops every drag frame (`setLive(null)`), but the layer's gesture still builds its own working state, and on release `settleDrag.onCommit` runs `applyKeyframeDrag`, which re-sorts and reports `selectedKey: 2`. That final state arrives through `onLayerChange`, whose selection check runs before the `!edits` early return, so `onSelect(2)` fires. `onLayerCommit` then refuses the keys, so the keys stay put and the selection lands on the key at 1000 instead of the pressed one. Should: a refused drag selects the pressed key (index 1), as the dope sheet does (`useKeyDrag` only calls `onSelect(i)` at press when `drags` is false).
- evidence: read (createKeyframeLayer.tsx `settleDrag`, keyframeEdits.ts `applyKeyframeDrag`, useLayerGesture.ts `onEndRef`, layerHost.ts `publishLayer`)
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: selection reported from a drag's result even when the drag is refused
- confidence: likely

## A graph-mode key drag sends no `preview`, so the inspector reads the wrong key while a consumer echoes `onInput`
- where: packages/ui/src/components/Timeline/Timeline.tsx:221 (bindLaneEdits, onKeysInput)
- scenario: a consumer that writes `onInput` back into `tracks`, graph mode, a key selected with `renderKeyEditor` set. Drag key 1 past key 2. Each frame's `setKeys` re-sorts the echoed track, so the dragged key now sits at index 2, but the selection stays at index 1 until release, because the layer's mid-drag states keep `selectedKey` at the pressed index. The dope path handles this by calling `report.preview(r)` so `useKeyAndSegment` hands out `inspected` at the preview index. `onKeysInput` never calls `preview`, so `TimelineInspector` shows the neighbor's value, and its `commit`/`setEasing` write to the neighbor during the drag. Should: answer the selection-during-preview question the same way in both modes.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: preview selection wired for dope drags only
- confidence: likely

## An arrow step on a key already past the duration moves it backward to the duration, whichever arrow was pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:181 (markKeys)
- scenario: `duration` 1000 with a key at 1500 (the consumer's data, or a duration shortened under existing keys; `data-past` already expects keys beyond the end). Focus that key and press ArrowRight. `to = max(0, min(last, 1500 + 10)) = 1000`, which differs from `t`, so `onKeyChange(i, 1000)` commits a 500 ms move to the left. ArrowLeft makes the same 490 ms jump. Graph mode does the same through `xClamp` (LaneGraph.tsx:78) in the layer's nudge. Should: a step stays within one step of where the key is (or does nothing), and never moves against the arrow.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: clamp applied to the target without regard to the starting time
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

<!-- done: 3 findings, files read: 18 -->
