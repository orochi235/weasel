## A dope-sheet key drag commits against the tracks it was pressed on, undoing any edit that landed during it
- where: packages/ui/src/components/Timeline/Timeline.tsx:236 (bindLaneEdits, onKeyChange), packages/ui/src/components/Timeline/useKeyDrag.ts:70 (onKeyPointerDown)
- scenario: `onKeyPointerDown` captures that render's `onKeyChange`, and `bindLaneEdits` closes over that render's `tracks`, so the release runs `moveKey(pressTimeTracks, …)` and `onChange` sends the whole list. Example: finger A drags a key on lane 1 while finger B drags a key on lane 2 (each Lane has its own session, so both drags run). A lets go, and `onChange` carries A's move. Then B lets go, and its `onChange` is built from the tracks as they were before A's move, so A's edit is reverted. The same happens to an edit made outside the timeline during a drag, e.g. `handle.edit` on an `AnimatedTimeline`'s handle. `useKeyEditsHeldByPress` guards only keyboard edits against this, though its own comment names the cause ("the drag's release commits against the tracks it began from, and would undo them"). What should happen: the release applies the move to the current tracks, re-finding the dragged key from its press-time identity or time. Graph mode doesn't have this bug, because `setKeys` reads the current `tracks` at commit.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/timelineState.ts
- size: function
- cause: commit closure captures press-time tracks
- confidence: likely

## A canceled bezier-handle drag in graph mode never fires `onCancel`
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:112 (onLayerCancel)
- scenario: In graph mode, select a segment with a bezier easing, drag one of its handles, then press Escape, or the pointer is canceled. The layer settles with 'cancel' and `onLayerCancel` runs. A handle drag never sends `onKeysInput` (left out on purpose, so the easing cache doesn't grow per pixel), so `previewed.current` is null and the function returns before `onCancel?.()`. The handle drag is an edit: if released, it would commit through `onKeysChange`. The edit protocol (docs/conventions.md, "Edit callbacks") says a canceled edit fires `onCancel` once, and Lane documents its `onCancel` as "A drag in either mode was canceled". So a consumer that opened something when the gesture began (a transaction, an overlay) never hears the end of it. What should happen: `onCancel` fires for any canceled drag that changed the layer's state, with or without an `onInput` preview.
- evidence: read
- severity: low
- size: line
- cause: onCancel gated on a sent preview
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
