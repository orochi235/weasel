# Audit round 79 — ui.components.Timeline (blind reviewer)

## A consumer echoing `onInput` makes a dragged key snap to its own last preview, so it sticks
- where: packages/ui/src/components/Timeline/Timeline.tsx:84 (snapTimesOf memo) with packages/ui/src/components/Timeline/useKeyDrag.ts:58 (`at`, useLatest) and packages/ui/src/components/Timeline/LaneGraph.tsx:74 (snapX)
- scenario: consumer wires `onInput={setTracks}` (the kit edit protocol). Each move sends the moved tracks back; `rows` rebuild and `snapTimesOf` now contains the dragged key's previewed time. `at` is read through `useLatest`, so the next move snaps with that list: `attract` pulls the pointer to the nearest stop within `snapRadiusPx`, which is the key's own previous position whenever the pointer moved less than the radius since the last event. Normal slow drags keep getting pulled back and the key lags or sticks until a single move jumps past the radius. Same in graph mode, where `snapX` derives from the same live `snapTimes`. The dragged key's own time (and its live preview) should be excluded from its snap stops, or the stops frozen at press.
- evidence: read (attract semantics from packages/ui-input/src/slider.pbt.test.ts:124-129)
- severity: high

## A stale key pin survives the selection going null, so a controlled re-selection of the same key is dropped at once
- where: packages/ui/src/components/Timeline/timelineState.ts:62 (useKeyAndSegment)
- scenario: controlled `selection`. Select key `[0]:1` (pin `{id:'0:1', reads:R}`), consumer sets `selection={null}`, then edits track 0 from outside (adds a key), then sets `selection={{trackPath:[0], keyIndex:1}}`. `keyPin.id === id` still, so `readsOwn(path, R)` compares the new reading against the old `R` and the old `sent`, gets `null`, marks it stale and reports `onSelectionChange(null)` — the consumer's fresh selection is thrown away. The pin is cleared only by `selectKey(null)`, never when `given`/`held` becomes null (nor by `selectSegment`'s `setHeld(null)`); a selection arriving through `given` with a changed `givenKey` should re-pin from the current tracks.
- evidence: read
- severity: medium

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
