# Findings: ui.components.Timeline

## A dope-sheet key drag survives a hold that starts mid-drag and commits its edit, where the graph lane cancels
- where: packages/ui/src/components/Timeline/Lane.tsx:73 (Lane → useKeyDrag), packages/ui/src/components/Timeline/useKeyDrag.ts:70 (onKeyPointerDown)
- scenario: a consumer sets `readOnly` (or `disabled`) on `<Timeline>` while the user is dragging a key in dope mode, for example when playback starts. `drags: hold.edits` is read only at press. The open pointer session keeps calling `onKeyInput`, and on release it calls `onKeyChange`, which `bindLaneEdits` passes on to `commit` → `props.onChange`. Lane hands `onKeyInput`/`onKeyChange` through without gating them on `hold.edits`. So a read-only timeline emits an edit. In graph mode the same hold change cancels the drag: `LayeredCurveEditor` runs `useEffect(() => { if (hold.refuses) cancel(); })`, and `LaneGraph.onLayerCommit` checks `edits` again. The two modes give different answers to "does a hold that starts mid-drag end the drag?"
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/Lane.tsx
- size: function
- cause: hold read at press only; no cancel on hold change
- confidence: likely

## A nested row's dragged key snaps to stops before the row's start, so its ghost sits where the key will not land
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:58 (at)
- scenario: take a nested timeline at `at: 600` with keys at 50 and 200, and a top-level key at ruler time 590. `snapTimes` holds ruler times from every drawn row and is not limited to this row's range. `sliderAt` clamps to `[offset, limit]` = `[600, …]` first and only then runs `attract` over the stops (ui-input `slider.ts:97-98`), and `attract` can return any stop. Drag the key at 200 to the row's start edge: q clamps to 600 (or about 605). The 590 stop is within the snap radius and nearer than 650, so `at` returns 590 − 600 = −10. The ghost (`pct(drag.t)`) is drawn at 590, left of where the row's time starts. The preview and the commit both go through `moveKey`, which clamps to 0, so the key lands at 600, not under its ghost. A drag should only offer stops the key can actually reach.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts (filter `stops` to `[offset, max(offset, limit)]`, or clamp after `sliderAt`)
- size: line
- cause: snap stops not limited to the track's clamp
- confidence: sure

## An arrow step on a key past `limit` jumps it to `limit`, so ArrowRight moves the key left
- where: packages/ui/src/components/Timeline/Lane.tsx:170 (markKeys)
- scenario: a key sits past the timeline's duration. One way: `duration` 2000 with a track keyed at 2500. Another: a nested row whose `offset + t` exceeds the duration. `last = limit - offset` is 2000, and ArrowRight computes `to = min(2000, 2510) = 2000`. That differs from `t`, so `onKeyChange(i, 2000)` commits, and the key moves 500 ms to the left on a right-arrow press. ArrowLeft makes the same 500 ms jump instead of a 10 ms step. If the row's `offset` is itself past `limit`, `last` is 0, and any arrow sends the key to the row's start. A step should never move against its arrow; at most it should refuse to move further past the limit.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx (clamp only in the step's own direction, e.g. `dx > 0 ? min(max(t, last), t + step) : max(0, t + step)`)
- size: line
- cause: clamp applied to keys already outside the range
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
