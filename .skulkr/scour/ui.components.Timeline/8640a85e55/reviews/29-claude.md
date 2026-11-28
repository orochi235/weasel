## An arrow step on a key that sits past the timeline's duration moves it backward, by however far it overshoots
- where: packages/ui/src/components/Timeline/Lane.tsx:174 (markKeys)
- scenario: `duration` 2000 and a sampled key at t=2500 (tracks with keys past `duration`, or a duration shrunk under them). Focus the key and press ArrowRight: `to = max(0, min(last=2000, 2510)) = 2000`, `to !== t`, so `onKeyChange(i, 2000)` moves the key 500 ms to the left. ArrowLeft jumps it 500 ms instead of 10. A step should move the key at most one step in the arrow's direction, or refuse.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Lane.tsx
- size: line
- cause: clamp applied to the target without regard to the step's direction
- confidence: sure

## A graph lane's value range is recomputed from the live drag, so dragging an extreme key rescales the axis under the pointer
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:134 (LaneGraph, `valueRange(state.keys)`)
- scenario: graph mode, drag the highest key upward. `state` is `live` during the drag, so `yRange` grows with each move; the key is redrawn back at the top inset while the pointer runs above it, and each next move converts the pointer through the widened range, giving a still larger value. The key's value races ahead of the pointer instead of following it. The range should be held at what it was when the gesture began.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: axis range derived from in-flight drag state
- confidence: likely

## A lane unmounted mid-drag sends the consumer the tracks the drag began from, undoing whatever change unmounted it
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:46 (useKeyDrag cleanup → onCancel → onRevert)
- scenario: dope-sheet drag with `onInput` wired; during the drag the consumer removes the track (an undo shortcut, an external edit), so the lane unmounts. The cleanup's `session.cancel()` runs `onCancel`, which calls `onRevert` → `Timeline`'s `onKeyRevert` → `onInput(tracks.slice())` with the press-time tracks, plus `onCancel`. A consumer that applies `onInput` puts the removed track back. Teardown should cancel the session without replaying an edit against a tree that has moved on (or only when the tracks are still the ones it previewed).
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/Timeline.tsx
- size: function
- cause: unmount cancel takes the same path as a user cancel
- confidence: likely

## Switching to graph mode during a dope-sheet drag leaves the drag running; its release commits a move nobody can see
- where: packages/ui/src/components/Timeline/Lane.tsx:72 (Lane, `useKeyDrag` kept across `mode`)
- scenario: press and drag a key in dope mode, then (keyboard on the Graph switch, or a controlled `mode` change) switch to graph. The `Lane` stays mounted under the same key, so the session keeps firing `onKeyInput` and on release `onKeyChange`, while the lane now draws `LaneGraph` with no ghost. The drag should be canceled when the lane stops drawing dope marks.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts
- size: function
- cause: session not tied to the mode that started it
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

<!-- done: 4 findings, files read: 18 -->
