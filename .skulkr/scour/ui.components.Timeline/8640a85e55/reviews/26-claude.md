## A dope-sheet or graph key drag calls `onCancel` though the Timeline previewed nothing, when it has no `onInput`
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:93 (onKeyPointerDown, `onMove`/`onEnd`/`onCancel`)
- scenario: `<Timeline onChange onCancel>` with no `onInput`. Drag a key away and back to the time it began from, and release (or press Escape mid-drag). `bindLaneEdits.onKeyInput` returns early without calling anything (Timeline.tsx:210), but `useKeyDrag` sets `previewed = true` on every traveled move regardless, so release at the origin runs `onRevert` then `onCancel` → `props.onCancel()` fires. The ruling of 2026-11-22 (docs/unruled.md, round seventy) says "A drag that previewed nothing calls nothing", and the edit protocol pairs `onCancel` with a preview put back. The graph path does the same: Lane hands LaneGraph Timeline's `onKeysInput`, which is always defined (`report.onInput?.(…)`), so `previewed.current` is set and `onLayerCancel` calls `onCancel` with nothing sent. Meanwhile a graph bezier-handle drag canceled by Escape never calls `onCancel` at all, so the three drags answer "did this cancel report?" three ways.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: "previewed" tracks lane-level calls, not whether the Timeline forwarded anything to `onInput`
- confidence: sure

## An arrow step on a key already past the timeline's end moves it the wrong way
- where: packages/ui/src/components/Timeline/Lane.tsx:170 (markKeys)
- scenario: a key sits past `limit - row.offset` — e.g. a nested timeline at `at: 1800` holding a key at `t: 400` (ruler 2200) under `duration: 2000`, or a consumer shrinking `duration` below existing keys. Focus that key and press ArrowRight: `to = max(0, min(last, t + 10)) = min(200, 410) = 200`, so `to !== t` and the key jumps 200 ms LEFT. ArrowLeft jumps it the same 200 ms. Expected: a step toward the limit either does nothing or stays put, and a step away moves 10 ms. The graph lane clamps through `xClamp` (LaneGraph.tsx:80) into the layer's nudge, which has the same shape.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx (via the layer's `xClamp` nudge, if it clamps the same way)
- size: line
- cause: clamp applied to the target regardless of step direction
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
