## An arrow step on a key past the timeline's duration jumps it back to the duration, whichever arrow is pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:178 (markKeys)
- scenario: `duration` 2000, a sampled key at t 3000 (the duration shrank, or the tracks came in that way). Focus the key and press ArrowRight: `to = max(0, min(last=2000, 3010)) = 2000`, so `to !== t` and `onKeyChange(i, 2000)` moves the key 1000 ms to the left. ArrowLeft does the same (2990 → 2000), a 990 ms jump for a 10 ms step. A rightward step should leave the key where it is (or refuse), and a leftward one should move it by one step. Same for a nested row whose `offset` exceeds `limit`: `last` is 0 and any step sends the key to 0.
- evidence: read
- severity: low
- size: line
- cause: clamp applied to the target rather than to the step's direction
- confidence: sure

## A nested timeline with an empty label gives its children folds without its prefix, colliding with top-level rows
- where: packages/ui/src/components/Timeline/lanes.ts:51 (buildLanes)
- scenario: tracks `[{ kind: 'timeline', label: '', timeline: { tracks: [{ kind: 'timeline', label: 'a', … }] } }, { kind: 'timeline', label: 'a', … }]`. The outer timeline's fold is `''`; its child's is `'' + ('' ? '/' : '') + 'a'` = `'a'`, the same as the top-level `a`. Expanding either nested `a` opens both, and folding one shuts the other. The `parent ? '/' : ''` test treats an empty-label parent as no parent at all; `foldName` gives `''` for `label: ''` (only `undefined` falls back to `(kind)`). Separators should depend on depth, not on the parent's string being non-empty.
- evidence: read
- severity: low
- size: line
- cause: separator gated on truthiness of parent fold
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

<!-- done: 2 findings, files read: 18 -->
