## Graph mode: a key moved past a neighbor (arrow step or drag) leaves the timeline's selection on the old index, now a different key
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:115 (onLayerCommit)
- scenario: graph mode, keys at t=0/500/1000, key 1 selected. Shift+ArrowRight six times (or drag) moves it to t=1100. The keyframe layer commits `{ keys, selectedKey: 2 }` (createKeyframeLayer.tsx:138, `nudgedKey` re-sorts) through `onChange` → `onLayerCommit`, which forwards only `next.keys` via `onKeysChange` and never reports `next.selectedKey`. Timeline's `onKeysChange` binding is `report.onChange(setKeys(...))`, not `commit`, so `selectKey` is never called. `useKeyAndSegment` does not mark the selection stale because the tracks match what was `send`-ed, so the selection stays `{keyIndex: 1}` — now the key at t=1000. The inspector, Delete, and `aria-current` all act on the neighbor; the layer had already moved focus to index 2, so focus and selection disagree. Dope mode gets this right (`commit(moveKey(...))` carries the new index).
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx, packages/ui/src/components/Timeline/Timeline.tsx
- size: function
- cause: commit path drops the layer's re-sorted selectedKey
- confidence: likely

## Dope-mode drag with an echoing consumer draws segments at the preview but keys at the press position
- where: packages/ui/src/components/Timeline/Lane.tsx:134 (Lane, SegmentMarks/KeyMarks)
- scenario: a consumer wiring `onInput` that echoes the preview back into `tracks` (the kit's edit protocol). While a key is dragged, `KeyMarks` draws from `drag.times` (the times at press) while `SegmentMarks` draws from the live `sampledKeys`. The selected/hovered segment's band therefore stretches to the previewed key time while the key diamond stays at the old time and the ghost at a third spot. Also, the segment's `aria-label` names the preview time. Segments should read the same key times the marks do.
- evidence: read
- severity: low
- size: line
- cause: two sources for one row's key times during a drag
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
