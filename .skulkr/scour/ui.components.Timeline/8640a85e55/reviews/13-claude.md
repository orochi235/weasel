## Graph-mode key move that re-sorts the key leaves the timeline's selection on the old index, now another key
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:118 (onLayerCommit)
- scenario: graph mode, keys at t=0/800/1600 on a numeric row. Select key 1 and drag it (or arrow-step it) past t=1600. The keyframe layer commits a state whose `selectedKey` follows the key to index 2 (`createKeyframeLayer.tsx:138` and `:180`; the layer's test at `createKeyframeLayer.test.tsx:117` expects `selectedKey` 2 after a re-sort). `onLayerCommit` passes on only `next.keys` through `onKeysChange` and never reports `next.selectedKey`. `Timeline` routes `onKeysChange` to plain `onChange`, not `commit`, so `selectKey` is never called. `useKeyAndSegment` sees the track change as the timeline's own edit (it matches `sent`) and keeps selection `{keyIndex: 1}`. Result: the key that was at 1600 shows `aria-current`, the inspector's `renderKeyEditor`, `commit` and `setEasing` edit that key, and so does the next step on the selected key. The layer has already moved focus to index 2, so focus and selection disagree. The dope-sheet path does this correctly: `moveKey` reports the new index and `commit` reselects it.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx, packages/ui/src/components/Timeline/Timeline.tsx
- size: function
- cause: committed layer selection dropped on the commit path
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

<!-- done: 1 findings, files read: 18 -->
