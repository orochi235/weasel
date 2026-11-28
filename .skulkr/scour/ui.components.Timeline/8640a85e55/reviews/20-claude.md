## A dope-sheet pointer drag that re-sorts a key leaves focus on the mark now drawing its neighbor, so Delete and the arrows act on the wrong key
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:91 (onKeyPointerDown, onEnd)
- scenario: a sampled row with keys at 0, 800, 1600 ms. Press key 0 (a `tabIndex=0` div; nothing calls `preventDefault` on the press, and `openPointerSession` does not either, so the mark takes focus) and drag it to 1200 ms. `moveKey` re-sorts it to index 1 and `commit` selects index 1, but `KeyMarks` are keyed by index, so the focused element is still `data-keyframe-index="0"`, which now draws the key at 800 ms. Pressing Delete: `markedKey` reads the focused mark first and `deleteKey` removes the 800 ms key, not the one just dragged and shown selected. An arrow step likewise moves the 800 ms key (`markKeys(i=0, t=800)`). `useFocusFollowsKey` would put focus on the selected key, but `refocus` is set only for keyboard steps and deletes, never at the end of a pointer drag. Expected: focus follows the dragged key to its new index, as it does after a keyboard step.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Lane.tsx
- size: function
- cause: refocus not requested after a pointer drag re-sort
- confidence: likely

## An arrow step on a key that sits past the limit moves it to the limit whichever way the arrow points
- where: packages/ui/src/components/Timeline/Lane.tsx:174 (markKeys)
- scenario: a key at 2500 ms on a timeline whose `duration` is 2000 (the consumer shortened the duration, or the key arrived from data). Focus it and press ArrowRight: `to = max(0, min(last=2000, 2510)) = 2000`, which differs from `t`, so `onKeyChange(i, 2000)` moves the key 500 ms to the left. Expected: Right never moves a key earlier; a step away from the limit (Left) may clamp, but a step toward it should do nothing.
- evidence: read
- severity: low
- size: line
- cause: clamp applied without regard to step direction
- confidence: sure

## A graph-mode key drag sets no preview, so the inspector names the wrong key while an echoing consumer's tracks show the drag re-sorted
- where: packages/ui/src/components/Timeline/Timeline.tsx:203 (bindLaneEdits, onKeysInput)
- scenario: `mode="graph"`, `onInput` wired and echoed back into `tracks`, `renderKeyEditor` set. Drag key 0 past key 1: each move goes through `onKeysInput` → `setKeys`, and the echoed tracks hold the dragged key at index 1. The dope path calls `report.preview(r)` so `useKeyAndSegment`'s `inspected` follows the key to its previewed index; the graph path never calls `preview`, so `inspected` stays index 0 and the inspector shows (and `commit`/`setEasing` write to) the neighbor for the rest of the drag. Expected: the inspector reads the dragged key in both modes.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: preview only wired on the dope-sheet path
- confidence: likely

## Key and segment names format a time apart from the ruler's labels, unlocalized
- where: packages/ui/src/components/Timeline/timeScale.ts:26 (msLabel)
- scenario: under a `de` locale the ruler reads `1,5s` / `500ms` through `secondsText`/`millisecondsText` with `useFieldLocale`, while every key's and segment's accessible name (and the graph's `formatX`) reads `1500 ms` from `msLabel`: one decision about how a timeline time reads, answered two ways, the second ignoring the locale. Expected: one formatter for a time on the timeline, locale-aware, used by the ruler and the mark names alike.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/LaneMarks.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx, packages/ui/src/components/Timeline/TimeRuler.tsx
- size: function
- cause: duplicated time formatting
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
