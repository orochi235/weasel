## An arrow step on a key at or past the timeline's end moves it backward, whichever arrow is pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:178 (markKeys)
- scenario: `duration` 2000 and a key at t=2500 (consumer data, or a nested timeline with `at: 3000` whose key sits at t=100 so `last = max(0, 2000 − 3000) = 0`). Right arrow computes `to = max(0, min(last, t + 10))` = 2000 (or 0 for the nested key) and commits it, so ArrowRight jumps the key left, by 500 ms or to the row's start. A step in the direction that moves away from the limit should move it 10 ms; one toward it should do nothing. The pointer path has the same cause: `useKeyDrag`'s track is `{ min: offset, max: max(offset, limit) }`, so any traveled drag of the nested key above pins it at 0, and LaneGraph's `xClamp` `[0, max(0, limit − offset)]` does the same in graph mode.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: clamp to limit applied to a key already past it
- confidence: sure

## Two key drags on different lanes at once: the second release undoes the first
- where: packages/ui/src/components/Timeline/Timeline.tsx:207 (bindLaneEdits onKeyChange)
- scenario: Multi-touch: finger 1 presses a key on lane A, finger 2 a key on lane B (each Lane has its own `sessionRef`, so the second-finger guard in `useKeyDrag` does not apply across lanes). Without a consumer echoing `onInput`, both sessions' `onKeyChange` closures hold the press-time `tracks`. Release A → `commit(moveKey(tracks0, A))`; release B → `commit(moveKey(tracks0, B))`, which carries A's key back to where it began. Expected: both moves land, or the second press is refused while another lane's drag is live. `useKeyEditsHeldByPress` counts the pressed pointers but only refuses keyboard edits, not a second drag.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/timelineState.ts, packages/ui/src/components/Timeline/useKeyDrag.ts
- size: function
- cause: per-lane drag guard, commit against press-time tracks
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
