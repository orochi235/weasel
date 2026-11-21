## A nested timeline's bar is drawn from the row's own start, ignoring the track's `at`
- where: packages/ui/src/components/Timeline/Lane.tsx:127 (Lane)
- scenario: a top-level `{ kind: 'timeline', at: 600, timeline: { duration: 400, … } }` (the `Nested` story). Its row has `offset` 0 (`buildLanes` adds `at` only to the children's offset), so `left: pct(0)` puts the bar at ruler 0 ms–400 ms, while its expanded children's keys draw from 600 ms. The bar should start at `pct(track.at)`.
- evidence: read (lanes.ts:53 adds `track.at` only for the child walk; Lane.tsx:127 uses `pct(0)`)
- severity: medium

## A nested timeline with no declared `duration` draws a zero-width bar
- where: packages/ui/src/components/Timeline/Lane.tsx:127 (Lane)
- scenario: a nested timeline that leaves `duration` out plays to its last track's end (docs/unruled.md, 2026-11-17), but the bar's width is `spanPercent(win, duration ?? 0)`, so it vanishes. A negative `duration` (which plays as 0) gives a negative CSS width. Width should come from the timeline's effective length (last track end), clamped at 0.
- evidence: read
- severity: low

## Releasing a key drag commits against the tracks from press time, undoing an edit made mid-drag
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:75-82 (onKeyPointerDown); Timeline.tsx:198-201 (bindLaneEdits)
- scenario: the session's `onEnd` calls the `onKeyChange` closure captured at the press, which `bindLaneEdits` bound over that render's `tracks`. Press a key (the mark takes focus), press Backspace while still holding: the root's handler deletes it through `onChange`. On release, `moveKey(pressTracks, …)` is committed, restoring the deleted key (at the new time). Any other edit committed during the drag (arrow step on another key, inspector value edit, `AnimatedTimeline` edit from elsewhere) is overwritten the same way. Should read the current tracks at release, or end the drag when the key goes away.
- evidence: read
- severity: medium

## Canceling a dope-sheet drag can reorder keys that share a time instead of putting them back
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:89 (onCancel) via keys.ts:76-80 (moveKey)
- scenario: a step track `[{t:0,value:1},{t:0,value:2},{t:500,…}]`; drag key 0, then Escape. The restore is `onKeyInput(0, times[0])` → `moveKey(tracks, key 0, 0)`, which removes key 0 and reinserts it after every key with `t <= 0`, so the preview handed to `onInput` is `[{t:0,value:2},{t:0,value:1},…]` — the step flipped. The cancel should hand back the original track list unchanged.
- evidence: read
- severity: low

## The selected segment survives a graph-mode edit that renumbers keys, so the easing picker edits a different segment
- where: packages/ui/src/components/Timeline/timelineState.ts:33-34 (useKeyAndSegment); Timeline.tsx:204 (onKeysChange → onChange)
- scenario: the comment says an edit that renumbers a track's keys drops the segment selection, but only `commit` (dope-sheet move/insert/delete) clears it. In graph mode, select the segment into key 2, then drag key 1 past key 2 (committed through `onKeysChange` → `report.onChange`): `segmentSelection.keyIndex` is still 2, now a different segment, and the inspector's `EasingPicker` reads and writes that key's easing. External `tracks` changes behave the same.
- evidence: read
- severity: low

## An uncontrolled zoomed window is never re-clamped when `duration` shrinks
- where: packages/ui/src/components/Timeline/timelineState.ts:16-24 (useTimeWindow)
- scenario: zoom to `{from: 6000, to: 8000}` with `duration` 10000, then the consumer sets `duration` to 2000. `own` stays `{6000, 8000}`: the ruler and lanes show only time past the end until the user wheels (spanPan clamps then). The held window should be clamped into the new bounds (or dropped to `null` when it no longer fits).
- evidence: read
- severity: low

## Lane labels indent only to depth 3
- where: packages/ui/src/components/Timeline/Timeline.module.css:39-41 (.lane[data-depth])
- scenario: a timeline nested four deep: `buildLanes` gives the row depth 4 and Lane writes `data-depth="4"`, but only depths 1–3 set `--depth`, so the row falls back to 0 and is drawn flush with the top level, reading as a sibling of the outermost tracks.
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

<!-- done: 7 findings, files read: 18 -->
