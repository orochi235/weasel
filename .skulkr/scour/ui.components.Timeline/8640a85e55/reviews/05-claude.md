## An arrow key on a key past the duration moves it the wrong way
- where: packages/ui/src/components/Timeline/Lane.tsx:176 (markKeys)
- scenario: the timeline's `duration` is shortened below an existing key (key at t=2500, duration 2000, or a nested row whose `limit - offset` is under the key's own time). Focus the key and press ArrowRight: `to = Math.max(0, Math.min(last, t + 10))` is 2000, which is `!== t`, so `onKeyChange(i, 2000)` moves the key 500 ms *left*. ArrowLeft also jumps it to 2000 instead of 2490. Expected: a step past `last` in the direction away from it is refused (or a step toward it moves by one step), never a reversal. The graph lane has the same shape through `xClamp = [0, limit - offset]` (LaneGraph.tsx:80), which `nudgedKey` clamps into.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: clamp applied to the target, not to the step's direction
- confidence: sure

## Delete pressed on a focused segment or disclosure deletes the selected key on some other row
- where: packages/ui/src/components/Timeline/Timeline.tsx:118 (onRootKeyDown)
- scenario: key 1 on row "x" is selected; the user Tabs to a segment mark (or the nested-timeline disclosure) on row "opacity", which focuses but does not select it, and presses Delete. `markedKey` returns `undefined` (the target is in a lane but on no key mark), so `target` falls back to `selection` and key 1 on "x" is deleted while focus and attention are on another row. Delete on a non-key element inside a lane should do nothing; the fallback to `selection` is only meaningful when the target is the root itself.
- evidence: read
- severity: low
- size: line
- cause: fallback to selection for any in-lane target
- confidence: likely

## deleteKey's documented "selects the one before it" is false for the first key
- where: packages/ui/src/components/Timeline/keys.ts:155 (deleteKey)
- scenario: delete key 0 of three: selection becomes index `Math.max(0, -1) = 0`, which is the key that came *after* it. The docstring says it selects the one before; Lane.tsx's comment says "the key selected after it". One of the two descriptions (and the behavior callers rely on) is wrong.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/keys.ts, packages/ui/src/components/Timeline/Lane.tsx
- size: line
- cause: doc/behavior mismatch
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
