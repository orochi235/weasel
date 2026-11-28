# Findings: ui.components.Timeline

## A dope-sheet key drag snaps to a stop outside the row's range, so the ghost and the commit disagree, and a release there can end with neither onChange nor onCancel
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:62 (useKeyDrag `at`)
- scenario: Take a nested timeline at `at: 600` that holds a key at track time 0, with a top-level key at ruler 590 (any ruler time just before the row's start, or the 0 stop, works). Drag the nested key left. `sliderAt` clamps to `min: offset` (600) first and then `attract`s to the stops. `attract` (ui-input slider.ts:36) returns the 590 stop with no bound, so `at` returns −10. The ghost is drawn at ruler 590 and `onKeyInput(i, −10)` fires, but `moveKey` clamps that to 0, so the preview and the ghost disagree. On release `t (−10) !== times[i] (0)`, so `onKeyChange` runs. `bindLaneEdits.onKeyChange` then finds `keyTime === Math.max(0, −10)` and returns: it calls `preview(null)` but never `onInput` with the starting tracks, and never `onCancel`. A gesture that sent `onInput` ends with neither `onChange` nor `onCancel`, against the edit protocol and the 2026-11-22 ruling in docs/unruled.md. The graph lane answers the same question another way: createKeyframeLayer clamps *after* attracting (`clampTo(attract(...), cfg.xClamp)`).
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/Timeline.tsx
- size: line
- cause: snap applied after clamp; stops not limited to [offset, limit]
- confidence: sure

## An arrow-key step on a key that sits past the limit moves it the wrong way
- where: packages/ui/src/components/Timeline/Lane.tsx:170 (markKeys)
- scenario: A key at t=2500 on a timeline with `duration` 2000. The consumer's tracks can hold this, for example after the duration shrinks, and the lane draws it. Press ArrowRight: `to = Math.min(last, t + 10)` = 2000, which is not equal to `t`, so `onKeyChange(i, 2000)` moves the key 500 ms *left*. ArrowLeft jumps it 500 ms too, not 10. A step past the limit should refuse, or at least not reverse its direction.
- evidence: read
- severity: low
- size: line
- cause: clamp target applied regardless of step direction
- confidence: sure

## A graph-mode key drag never feeds `preview`, so the inspector reads the wrong key while an echoed drag re-sorts
- where: packages/ui/src/components/Timeline/Timeline.tsx:217 (bindLaneEdits `onKeysInput`)
- scenario: Graph mode, with a consumer that echoes `onInput` back into `tracks` as the edit protocol intends. Select key 1 and drag it past key 2. `applyKeyframeDrag`/`moveKeyTo` re-sorts it, so in the echoed tracks the dragged key is at index 2. The held selection stays at index 1, because `send` makes the edit read as the timeline's own. `previewed` is null, though: only the dope path's `onKeyInput` calls `report.preview`. So `inspected` is index 1, the neighbor, and `TimelineInspector` shows the neighbor's value (and its `commit` writes to the neighbor) for the rest of the drag. The dope path handles exactly this case through `preview`/`inspected`.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: graph preview bypasses `preview`
- confidence: likely

## Key and segment names format time a second way, bypassing the locale-aware formatter the ruler and readout share
- where: packages/ui/src/components/Timeline/timeScale.ts:27 (msLabel)
- scenario: Use a `de-DE` field locale and put a key at 1500 ms. The ruler and the transport go through `secondsText`/`millisecondsText`, whose doc says every time the playback controls write goes through them "so a readout and a ruler beside it agree" (`1,50s`). The key's `aria-label` and the graph's `formatX` say `1500 ms`, in another unit, another spacing, and no locale. One decision is answered two ways.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/LaneMarks.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: duplicate time formatter
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

<!-- done: 4 findings, files read: 18 -->
