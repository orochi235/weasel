## An arrow step on a key past the timeline's duration moves it backward, whichever arrow is pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:171 (markKeys)
- scenario: `duration={2000}` and a track holding a key at `t: 2500` (tracks longer than the declared duration, or a
  duration shrunk under them). Focus the key and press ArrowRight: `to = max(0, min(last, 2500 + 10)) = 2000`, so
  `to !== t` and the key jumps 500 ms left to 2000. ArrowLeft does the same. A step should move the key the way the
  arrow points, or refuse (stay put) when that direction is past the limit; instead the right arrow moves it left.
- evidence: read
- severity: low
- size: line
- cause: clamp applied to the target without regard to which side of the limit the key starts on
- confidence: sure

## A key selection is dropped when the consumer's tracks arrive a render after the edit that moved it
- where: packages/ui/src/components/Timeline/timelineState.ts:56 (useKeyAndSegment, readsOwn / stale)
- scenario: a consumer whose `onChange` lands its new tracks in a later render (an async store, a `startTransition`,
  a state update after an `await`). Arrow-step or drag a key so it re-sorts: `commit` calls `send(next)` and
  `selectKey(r.selection, r.tracks)`, pinning the selection to how the track reads in `next`. The render those state
  updates cause still has the old `tracks`: `now` (old reading) differs from `keyPin.reads` (new reading), and
  `trackReading(sent)` (new) also differs from `now` (old), so `readsOwn` returns null, `stale` is set, and the effect
  calls `setHeld(null)`, reporting `onSelectionChange(null)`. When the tracks arrive one render later the selection is
  already gone. The check should accept a track still reading as it did before the timeline's own edit until the sent
  tracks arrive; the same applies to a delete or insert.
- evidence: read
- severity: medium
- size: function
- cause: staleness judged against tracks that have not yet caught up with `sent`
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
