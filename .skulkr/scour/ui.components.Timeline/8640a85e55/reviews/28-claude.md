## A dope-sheet key drag snaps past the clamp, so the ghost is drawn where the key will not land
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:58 (useKeyDrag, `at`)
- scenario: `sliderAt` clamps to `[min, max]` first and then attracts to the nearest stop (`packages/ui-input/src/slider.ts:97-98`, `attract` returns the stop as it is). `track.min` is the row's `offset` and `stops` are every row's ruler times. Take a nested row at offset 600 (the `Nested` story's `blink`, `at: 600`) and a top-level key at ruler 595. Drag a nested key left to the row's start: the value clamps to 600, the 595 stop is inside the snap radius, and `at` returns −5 in the row's time. The ghost (`KeyGhost left={pct(drag.t)}`) and `onKeyInput(i, -5)` sit before the nested timeline's start. On release, `moveKey` clamps to 0, so the key lands at ruler 600, not where the ghost showed. If the key was already at 0, `t (-5) !== times[i] (0)`, so `onKeyChange` fires; `bindLaneEdits` then returns early on `keyTime === max(0, toMs)`, and the release skips the revert/cancel path a no-op drag is meant to take. The upper bound has the same gap: a stop past `limit` (a nested key past the duration) pulls a key beyond the timeline's duration.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts (filter `stops` to `[track.min, track.max]`, or clamp after `sliderAt`)
- size: line
- cause: snap stops not limited to the clamp range
- confidence: sure

## An arrow step on a key that sits past `limit` jumps it back to the limit, whichever arrow is pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:169 (markKeys)
- scenario: `to = Math.max(0, Math.min(last, t + dx * KEY_STEP_MS))`. A key at 2500 ms on a timeline whose `duration` is 2000 (the consumer shortened the duration, or a nested row's `offset + t` runs past it) gets `last = 2000`. ArrowRight gives `min(2000, 2510)` = 2000, and ArrowLeft gives `min(2000, 2490)` = 2000. Either key moves it 500 ms left in one press, where a step should move it 10 ms (or refuse to move it further right). A nested row whose `offset` is past `limit` has `last = 0`, so any arrow sends its key to 0.
- evidence: read
- severity: low
- size: line
- cause: clamp applied to an already out-of-range start
- confidence: sure

## In graph mode the hold's tab order and focus attributes never reach the keys
- where: packages/ui/src/components/Timeline/Lane.tsx:110 (Lane → LaneGraph)
- scenario: `TimelineProps` says that when disabled with no reason given, "the marks leave the tab order". `laneHold.tabIndex` is -1 then, and `hold.focus` carries the hold's focus attributes. Dope marks apply both through `mark`. `LaneGraph` is handed only `edits`, and the curve editor's key, segment and handle marks hard-code `tabIndex={0}` (`CurveEditor/keyframeMarks.tsx:42,69,89`). So a disabled timeline in graph mode leaves every graph key and segment tabbable, without the hold's attributes. Tabbing through it stops on each one.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx, packages/ui/src/components/CurveEditor/keyframeMarks.tsx
- size: function
- cause: hold not threaded into graph lanes
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
