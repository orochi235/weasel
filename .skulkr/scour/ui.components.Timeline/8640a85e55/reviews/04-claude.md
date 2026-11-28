## A read-only graph lane moves the selection to a neighbor when a key is dragged past it, though no key moved
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:94 (LaneGraph, onLayerChange)
- scenario: `<Timeline readOnly mode="graph">`, a numeric track with keys at 0, 800, 1600. Press the key at 800 and drag it past 1600, then release. The layer's `onCommit` (`settleDrag` → `applyKeyframeDrag` → `moveKeyTo`) re-sorts the key and gives the final state `selectedKey: 2`. `useLayerGesture`'s end sends that state through `onInput` → `onLayerChange`, whose selection check runs before the `!edits` early return, so `onSelect(2)` fires. `onLayerCommit` then refuses the key change because `edits` is false. Result: the keys are unchanged, but the selection (and `onSelectionChange`) now names the key at 1600 instead of the one pressed. It should stay on the pressed key (index 1).
- evidence: read (createKeyframeLayer.tsx settleDrag/keyGesture, keyframeEdits.ts moveKeyTo, useLayerGesture.ts onEndRef)
- severity: low
- size: line
- cause: selection forwarded from a refused drag's re-sorted final state
- confidence: likely

## An arrow key on a key that sits past the duration jumps it back to the duration, whichever way the arrow points
- where: packages/ui/src/components/Timeline/Lane.tsx:174 (markKeys)
- scenario: a track has a key at t=2500 and the consumer's `duration` is 2000 (for example, the duration was shortened after the key was placed). Focus the key and press ArrowRight: `to = max(0, min(last=2000, 2510)) = 2000`, so `onKeyChange` moves the key 500 ms to the left. ArrowLeft makes the same 500 ms jump instead of a 10 ms step. A right arrow should not move a key backward. It should refuse the step, or clamp only in the direction the arrow moves.
- evidence: read
- severity: low
- size: line
- cause: clamp to the limit applied regardless of step direction
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
