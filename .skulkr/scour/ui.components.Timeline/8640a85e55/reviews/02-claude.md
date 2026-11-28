## Right arrow on a key past the timeline's duration moves it left, to the duration
- where: packages/ui/src/components/Timeline/Lane.tsx:166 (markKeys)
- scenario: `duration={1000}` and a sampled track with a key at `t: 1500`, which the Timeline accepts and draws with `data-past`. Focus that key and press ArrowRight. `to = Math.max(0, Math.min(last, t + 10))` gives `min(1000, 1510) = 1000`, which differs from `t`, so `onKeyChange(i, 1000)` commits and the key jumps 500 ms left on a right-arrow press. ArrowLeft also jumps the key to 1000 instead of stepping it 10 ms. A step should never move a key against its direction: either refuse it or clamp only in the direction of travel (`dx > 0 ? min(last, max(t, …))`).
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx
- size: line
- cause: clamp applied to a key already outside the clamp range
- confidence: sure

## A nested timeline's fold counts same-labeled siblings of any kind, so adding or removing an unrelated track flips it open or shut
- where: packages/ui/src/components/Timeline/lanes.ts:48 (buildLanes)
- scenario: tracks `[sampled "blink", timeline "blink"]`. The timeline's fold is `blink#1`, because `seen` is keyed on the label alone and the sampled track counted first. The user expands it, which stores `blink#1`. The consumer then removes the sampled track, so the timeline's fold becomes `blink`, and the row renders collapsed; adding the sampled track back reverses it. `LaneRow.fold`'s doc promises that a track inserted or removed beside it from outside leaves it open or shut. Only timeline rows fold, so the count should cover timeline siblings only, or `foldName` should include the kind for labeled tracks too.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/lanes.ts
- size: line
- cause: fold disambiguation counter shared across track kinds
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
