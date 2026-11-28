# ui.components.Timeline — blind review

## A dope-sheet drag echoed through `onInput` commits against the previewed tracks: crossing a neighbor moves the neighbor
- where: packages/ui/src/components/Timeline/Timeline.tsx:216 (bindLaneEdits, onKeyChange / onKeyInput)
- scenario: keys `[0 (v0), 500 (v10)]`; the consumer writes `onInput` back into `tracks` (the protocol in `docs/conventions.md` "Edit callbacks" expects this). Drag key 0 to 700: the preview re-sorts it, and the echoed tracks read `[500 (v10), 700 (v0)]`. On release `useKeyDrag` calls `onKeyChange(0, 700)` with the index the key had at press. `bindLaneEdits` resolves it against the current, echoed `tracks`, where index 0 is now the neighbor at 500, so `moveKey` moves the v10 key to 700. The result is two keys at 700 and the dragged key's move lost. A second `pointermove` after the crossing does the same during the drag: `moveKey(tracks, {keyIndex: i})` picks the neighbor. It should apply the move to the tracks the drag began from. The test "keeps the key editor on the dragged key while its preview re-sorts it past a neighbor" checks only the editor's `700`, which both keys now read, so it passes over this.
- evidence: read (traced against the test fixture `tracks()` in Timeline.test.tsx)
- severity: high
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/useKeyDrag.ts
- size: function
- cause: press-time index resolved against live, echoed tracks
- confidence: sure

## An echoed dope-sheet drag never fires `onChange`
- where: packages/ui/src/components/Timeline/Timeline.tsx:219 (bindLaneEdits, onKeyChange)
- scenario: the consumer echoes `onInput` into `tracks` and drags key 1 from 500 to 600 without crossing a neighbor. The last preview has already put the key at 600 in `tracks`. On release, `keyTime(tracks, sel) === Math.max(0, toMs)` is true, so it returns without `commit`. `onChange` is never called for a drag that changed the value. A consumer that records an undo step or saves on `onChange` loses the edit. The protocol says `onChange` fires once per edit with its final value. The no-op check should compare against the time the key had at press, which `useKeyDrag` already holds as `times[i]`.
- evidence: read
- severity: high
- fix: packages/ui/src/components/Timeline/Timeline.tsx
- size: line
- cause: no-op check reads echoed tracks, not the drag's start
- confidence: sure

## Canceling an echoed dope-sheet drag "reverts" to the last preview, not to where it began
- where: packages/ui/src/components/Timeline/Timeline.tsx:212 (bindLaneEdits, onKeyRevert)
- scenario: the consumer echoes `onInput`, drags a key from 500 to 700, then presses Escape. `onKeyRevert` sends `onInput(tracks.slice())`, but `tracks` is now the echoed preview with the key at 700, so the key stays at 700 and `onCancel` fires. The protocol says the control sends `onInput` the value the edit began from before `onCancel`. `LaneGraph` handles this correctly by keeping `previewed.current ??= prev.keys` from the first preview; the dope path holds no such start value.
- evidence: read
- severity: high
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/useKeyDrag.ts
- size: function
- cause: start-of-drag tracks not captured
- confidence: sure

## An arrow step on a key past the duration jumps it to the duration, so Right moves it left
- where: packages/ui/src/components/Timeline/Lane.tsx:178 (markKeys)
- scenario: duration 2000, and a key at t=3000 (possible from data the consumer loads, or after the duration shrinks). Pressing ArrowRight gives `to = min(last=2000, 3010) = 2000`, so the key moves 1000 ms left; ArrowLeft makes the same jump. A step should either move by one step in the arrow's direction or refuse to move. It should not jump in the opposite direction.
- evidence: read
- severity: low
- fix: —
- size: line
- cause: clamp applied to a value already out of range
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
