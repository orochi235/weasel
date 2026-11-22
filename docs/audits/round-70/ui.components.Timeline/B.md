# Audit round 70 — ui.components.Timeline

## Dope-sheet marks before the window's start draw over the label column and swallow its presses
- where: packages/ui/src/components/Timeline/Timeline.module.css:41 (`.laneTrack`); packages/ui/src/components/Timeline/LaneMarks.tsx:35 (SegmentMarks), packages/ui/src/components/Timeline/Lane.tsx:210 (NestedBar)
- scenario: zoom the window to `{ from: 1000, to: 2000 }` on the Nested story. A key at t=900 gets `left: -10%`, and a segment 0→800 ms or a nested bar starting at 600 gets a negative `left`. `.laneTrack` is `position: relative` with no `overflow: hidden` (only `.lanes` clips, and its box includes the label column), so these absolutely positioned marks paint over `.laneLabel`, which comes earlier and isn't positioned. A segment reaching left over a nested row's disclosure takes the click, so the click selects the segment instead of folding the row. Marks outside the window should be clipped at the track's start edge, as they already are at its end.
- evidence: read
- severity: medium

## A keydown that changes nothing leaves `refocus` set, and a later unrelated render moves focus to the selected key
- where: packages/ui/src/components/Timeline/Lane.tsx:168,173 (markKeys), :221 (useFocusFollowsKey)
- scenario: tab to key 2 (tabbing does not select) while key 0 is selected, then press ArrowLeft with key 2 at t=0 (`onKeyChange` returns early since the time is unchanged). Or press Delete while the timeline is read-only (`hold.refuses`), or on an event mark (only sampled keys delete). In each case `refocus.current = true` is set but nothing re-renders. The next render for any reason (a playhead tick under `AnimatedTimeline`, a parent update) runs the effect: focus is still on a key in `keyEls`, so the guard passes and focus jumps to key 0. Focus should stay where it is. The flag should be set only when an edit actually happens, or be cleared in the same tick.
- evidence: read
- severity: low

## A dope-sheet drag back to its own starting time ends its `onInput` run with neither `onChange` nor `onCancel`
- where: packages/ui/src/components/Timeline/Timeline.tsx:201-204 (bindLaneEdits, onKeyChange)
- scenario: drag a key away (the consumer gets `onInput` with moved tracks and applies it live), then drag it back and release exactly on its original time. A snap stop at its own time makes this easy. `onKeyChange` sees `keyTime === toMs` and returns, so the run that started with `onInput` never closes. The edit protocol pairs every input run with an `onChange` or an `onCancel`. A consumer that buffers an undo entry or a "dirty" flag on `onInput` is left mid-edit.
- evidence: read
- severity: low

## Delete with a selection index past the track's keys reports an edit that changed nothing
- where: packages/ui/src/components/Timeline/Timeline.tsx:110-114 (onRootKeyDown); packages/ui/src/components/Timeline/keys.ts:126 (deleteKey)
- scenario: select key 3 of a 4-key track, then the consumer replaces `tracks` with a 2-key version of that track. The selection is held by index and never reconciled against `tracks`. Pressing Delete with focus on the root calls `deleteKey`: the filter removes nothing, yet `onChange` fires with a copied track list, and the selection moves to key 2, which doesn't exist either. A nonexistent key should be a no-op: no `onChange`, and the selection left as it was or dropped.
- evidence: read
- severity: low

## A nested row's end and its bar's length read a nested timeline's `duration` two different ways
- where: packages/ui/src/components/Timeline/lanes.ts:54 (buildLanes) vs :76 (timelineSpan)
- scenario: a nested timeline with `duration: -100` or `NaN`. `timelineSpan` clamps the bar to 0 (`Math.max(0, d) || 0`). `buildLanes` uses the raw value for the child rows' `end`: `start - 100` puts `AfterEnd` and `data-past` before the nested start, and `NaN` makes `end` NaN, so `end < win.to` is false and no key ever shows as past. One reading of `duration` should serve both.
- evidence: read
- severity: low

## The press guard against keyboard edits is released by any pointer, not the one that pressed
- where: packages/ui/src/components/Timeline/timelineState.ts:76-86 (useKeyEditsHeldByPress)
- scenario: finger A drags a key on a touch screen. Finger B taps a lane, which adds a second set of window listeners. When B lifts, its `pointerup` runs both `release` closures, which never check `pointerId`, so `pressed` goes false while A is still dragging. Likewise, a mouse `pointermove` with `buttons === 0` during a touch drag releases it. Arrow and Delete keys then reach the lane mid-drag, and A's release commits against the tracks the drag began from, undoing the keyboard edit. That is exactly what the hook exists to prevent. The guard should track the pressing pointer's id (or count presses) and release only on that pointer's up or cancel.
- evidence: read
- severity: low

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

<!-- done: 6 findings, files read: 18 -->
