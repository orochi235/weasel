# Audit round 59 — ui.components.Timeline

## A collapsed nested timeline's bar is drawn at its parent's start, ignoring the track's own `at`
- where: packages/ui/src/components/Timeline/Lane.tsx:127 (Lane, nested bar)
- scenario: a `{ kind: 'timeline', at: 600, timeline: { duration: 400, … } }` top-level track (the `Nested` story's `blink`). `pct(0)` is `toPercent(win, 0 + row.offset)`, and a timeline row's `offset` is its *parent's* accumulated `at` (0 here), so the bar spans 0–400 ms. Its children, once expanded, are laid out from `offset + track.at` (lanes.ts:53), i.e. 600–1000 ms. The bar should start at `pct(track.at)`. No test checks the bar's position (`timeline-nested` is referenced nowhere but Lane.tsx).
- evidence: read
- severity: medium

## A read-only graph lane's arrow key moves the selection to another key while the key itself stays put
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:82 (LaneGraph, onLayerChange)
- scenario: a `readOnly` Timeline in graph mode, keys at 0, 50 and 400 ms; focus the key at 0 and press Shift+Right. `KeyframeLayer` is never told the lane refuses edits, so `keyOnKey` computes `nudgedKey` (100 ms, re-sorted to index 1) and commits `{ selectedKey: 1 }`. `onLayerChange` reports `onSelect(1)` before its `!edits` check, and `onLayerCommit` then drops the key edit. Result: the keys are unchanged, but the selection (and, via `keyOnKey`'s refocus, DOM focus) jumps to the key at 50 ms. A refused edit should leave selection and focus on the key that was pressed, as the dope lane does (`markKeys` does nothing on an arrow when `!edits`).
- evidence: read (createKeyframeLayer.tsx:137-145, keyframeEdits.ts:98-112)
- severity: medium

## Rows nested four or more deep lose their indentation and draw at depth 0
- where: packages/ui/src/components/Timeline/Timeline.module.css:39-41 (.lane[data-depth] rules)
- scenario: `buildLanes` nests to any depth and Lane writes `data-depth={row.depth}`, but only depths 1–3 set `--depth`; a row at depth 4 matches none, `var(--depth, 0)` falls back to 0, and its label sits flush with the top-level rows, so the tree reads wrong. The depth should reach the label for any value (e.g. a custom property set from `row.depth`, or a capped rule for 3+).
- evidence: read
- severity: low

## A canceled dope-sheet drag "puts back" a key by moving it, which reorders keys that share a time
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:89 (onCancel), with keys.ts:76-80 (moveKey)
- scenario: a sampled track with keys `[{t:500,value:A},{t:500,value:B}]` (a hold/jump). Drag key 0 and press Escape. The revert calls `onKeyInput(0, 500)` → `moveKey(tracks, {keyIndex:0}, 500)`, which removes key 0 (leaving `[B]`), finds no key with `t > 500`, and appends it: the consumer's preview becomes `[B, A]`, the reverse of the original, so the jump at 500 ms now goes the other way. The cancel should hand back the original track list, not a re-sorted move.
- evidence: read
- severity: low

## A key drag maps the pointer through the window it was pressed in, not the one on screen
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:55-61 (onKeyPointerDown, `at`)
- scenario: `at` closes over `track` (built from `win` and `offset`) and `snapTimes` of the render the press happened in. If the window changes mid-drag — a controlled `window` that follows the playhead while playing, or a consumer zooming — the ghost (`pct(drag.t)` uses the new window) and the committed time (`at` uses the old) disagree: the key lands at the time the old window put under the pointer, not where the ghost sits. The session should read the current window (a latest-ref), as `TimeRuler`'s wheel handler does with `useLatest`.
- evidence: read
- severity: low

## Scrubbing the ruler seeks through the window it was pressed in
- where: packages/ui/src/components/Timeline/TimeRuler.tsx:66 (onPointerDown, onMove)
- scenario: the session's `onMove` calls the `msAt` closed over at press time, which reads that render's `win`. With a window that changes during the scrub (controlled window following the playhead, or a page that pans it), each move seeks to a time computed from the stale window, so the playhead line (drawn with the current scale) jumps away from the pointer. Same fix as the key drag: read the window through a ref.
- evidence: read
- severity: low

## An uncontrolled zoomed window is not re-clamped when `duration` shrinks
- where: packages/ui/src/components/Timeline/timelineState.ts:24 (useTimeWindow)
- scenario: uncontrolled Timeline, duration 10000, user zooms to `{from: 8000, to: 9000}`; the tracks are edited so `duration` becomes 4000. `own` is kept as is and returned as `win`, outside `bounds` `{0, 4000}`: every lane and the ruler show empty time past the end, and the window is only pulled back in by the next wheel pan (`spanClamp`). The held window should be clamped to the new bounds (or dropped to follow the duration).
- evidence: read
- severity: low

## A controlled `selection` set by the consumer leaves a selected segment selected beside it
- where: packages/ui/src/components/Timeline/timelineState.ts:31-44 (useKeyAndSegment)
- scenario: the doc says "a key and a segment are one selection: taking either gives up the other", but the segment is dropped only inside `selectKey`. With `selection` controlled, the user clicks a segment (segment held, `onSelectionChange(null)`), then the consumer selects a key from its own UI (an outliner, a "next key" button) by passing a new `selection`. `segmentSelection` stays set: the lanes draw both the segment and the key as current, and `TimelineInspector` shows the segment's easing picker and never the consumer's `renderKeyEditor` for the key it just selected. Likewise the comment "an edit that renumbers a track's keys drops it" is not implemented: a consumer-side edit (undo, an external key delete) leaves the held index naming a different segment. A key selection arriving through the prop should clear the segment, and the segment should be dropped or revalidated when its track's keys change.
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

<!-- done: 8 findings, files read: 18 -->
