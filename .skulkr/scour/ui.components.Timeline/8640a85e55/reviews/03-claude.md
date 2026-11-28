# Findings: ui.components.Timeline

## A graph lane's value-axis labels are clipped away by the lane track's `overflow: clip`
- where: packages/ui/src/components/Timeline/Timeline.module.css:47 (`.laneTrack`)
- scenario: `<Timeline mode="graph">` with a numeric sampled track. `LaneGraph` asks for `yTicks={{ labels: 'outside', gap: 10 }}`, which Plot2D draws past the plot's start edge (its SVG is `overflow: visible`), into the label column that `.lane[data-graph='true'] .laneLabel` reserves 32px for. But `.laneTrack` (the graph host's containing block) has `overflow: clip` with `overflow-clip-margin: calc(var(--wzl-handle-size) * 0.75 + 3px)` = 9.75px at the 9px token. The labels start 10px out from the edge, so every value label falls outside the clip and none is drawn. They should be visible in the reserved column. The clip came from 26c336fa18 (2026-11-22), which was written for dope marks; its browser test covers no graph lane.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Timeline.module.css
- size: line
- cause: clip margin sized for key marks, not for outside tick labels
- confidence: likely

## Read-only graph lane: dragging a key past its neighbor selects the neighbor
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:93 (onLayerChange)
- scenario: Timeline `readOnly` (so `edits` is false), `mode="graph"`, keys at 0/800/1600. Press key 0 and drag it past 800, then release. `refuseSteps` blocks only arrow keys, so the layer still runs the pointer drag. On release `useLayerGesture` publishes the settled state. `applyKeyframeDrag` re-sorts and sets `selectedKey: 1` (keyframeEdits.ts:64). `onLayerChange` calls `onSelect(1)` before its `!edits` check. `onLayerCommit` then refuses the keys, so nothing moved, but the selection is now on the key at 800. The selection should stay on the pressed key (index 0). The same happens with `hold.edits` false while a press holds edits.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: selection forwarded from a drag-settled state the lane refuses
- confidence: likely

## A dope-sheet drag snapped back onto its own time commits a tiny move on a fractionally offset row
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:98 (onEnd)
- scenario: a nested row whose `offset` is not exactly representable when added back (e.g. nested `at: 0.1`, key `t: 0.2`). Drag the key away and back so it snaps to its own stop `0.2 + 0.1` = `0.30000000000000004`. `at` returns `stop - offset`, and `0.30000000000000004 - 0.1` = `0.20000000000000004`, so `t !== times[i]`. `onKeyChange` then fires. `bindLaneEdits.onKeyChange`'s `keyTime(...) === toMs` check fails the same way, so the timeline commits a real edit (an `onChange`, and an undo step for the consumer) that moves the key by 1 ULP. The release should be treated as "back on its own time" and revert, as the 2026-11-22 ruling says.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/Timeline.tsx
- size: function
- cause: exact float equality after a ruler→row offset round trip
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
