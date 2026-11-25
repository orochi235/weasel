# Audit round 77 — ui.components.Timeline

## Lane tracks narrow by the scrollbar's width when the lanes scroll, so keys stop lining up with the ruler and playhead
- where: packages/ui/src/components/Timeline/Timeline.module.css:174 (`.lanes`), with `.body`/`.rulerWrap` at :170–172
- scenario: on a platform with classic (space-taking) scrollbars (Windows, Linux, macOS with "always show scrollbars"), a timeline with more rows than fit makes `.lanes` (`overflow-y: auto`) show a vertical scrollbar. Each `.laneTrack` then loses the scrollbar's ~15px, while the ruler above (in `.body`, which has no scrollbar) keeps the full width. Both place times by percentage of their own width (`toPercent` in Lane/LaneMarks; the ruler's `linearScale` over [0, 1]), so a key at the window's end is drawn ~15px left of the ruler's end tick and playhead, and the drift grows linearly across the lane. The graph lane's xTicks (`windowScale(win, size.width)` in LaneGraph.tsx:118) are computed for the narrower width too, so they no longer sit under the ruler's ticks. Should: reserve the same gutter on both (e.g. `scrollbar-gutter: stable` on `.lanes` and matching padding on the ruler row), so a key at time t sits under the ruler's t.
- evidence: read (CSS layout; the scrollbar-width behavior is platform behavior, not run here)
- severity: medium

## A graph-mode key drag that previews and is released where it started sends onInput but neither onChange nor onCancel, and leaves `previewed` set for the next gesture
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:96–113 (`onLayerChange`, `onLayerCommit`, `onLayerCancel`), against packages/ui/src/components/CurveEditor/useLayerGesture.ts:97–99 and layerHost.ts:32–36
- scenario: drag a key that is already selected away from its spot and back to exactly its time and value (the snap pulls t onto its own committed time, so this happens whenever the value ends up unchanged too), then release. Each move called `onKeysInput` (and `previewed.current ??= prev.keys`). At release the gesture's final state deep-equals its start, so `settleLayer(entry, 'unchanged')` calls neither `onChange` nor `onCancel`. `onLayerCommit` never runs, so the consumer gets previews through Timeline's `onInput` with no closing `onChange` or `onCancel`, and `previewed.current` stays set. The next gesture that cancels without having previewed (e.g. Escape during a bezier-handle drag, which never previews) runs `onLayerCancel`, finds the stale keys, and sends `onKeysInput(stale)` plus `onCancel`. If the key's value was edited through the inspector in between, that sends back the old value. Dope mode handles the same case explicitly (useKeyDrag.ts:88–92, "a preview it sent is put back as for a cancel"). Should: when a previewed drag settles unchanged, revert and cancel as dope does, and clear `previewed`.
- evidence: read (whether `startSelfState` includes the press's own commit is inferred from useLayerGesture's code; not run)
- severity: low

## A dope-sheet drag dims and highlights the wrong key when the consumer applies the `onInput` previews it gets
- where: packages/ui/src/components/Timeline/Lane.tsx:138–141 (`KeyMarks` given `selection`, `draggedIndex={drag?.keyIndex}`), useKeyDrag.ts:56–85
- scenario: a consumer following the edit protocol writes each `onInput` back into `tracks`. Drag key 0 of `[0, 800, 1600]` past 800. `moveKey` re-sorts, so the echoed track draws the dragged key at index 1. `drag.keyIndex` and the selection both still say 0, so the mark now at index 0 (the key at 800, which was not dragged) is the one drawn dimmed as "dragging" and highlighted as selected. The dragged key is drawn at full opacity under its own ghost, so the "move from somewhere to somewhere" look is gone. The commit is still right (it uses the tracks from the press). LaneGraph guards against exactly this echo by holding `live` state (LaneGraph.tsx:81–83); the dope lane does not, so the same question gets two answers. Should: draw a dope drag from the tracks it began from, or map the index through the move.
- evidence: read
- severity: low

## A flat graph lane draws its keys near the bottom of the lane, not in the middle its comment promises
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:46–53 (`valueRange`)
- scenario: a numeric track whose keys all have value 5. `lo = hi = 5` and `span = 1`, so the range is `[5 − pad, 6 + pad]`, and every key sits at the bottom inset (8% up) instead of the vertical center. The doc says the unit span is there "so it still has a middle". Should: center the unit span on the value, e.g. `[lo − 0.5 − pad, lo + 0.5 + pad]` when `hi === lo`.
- evidence: read
- severity: low

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
