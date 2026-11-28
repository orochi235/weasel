# Findings: ui.components.Timeline

## A dope-sheet key drag still commits when the timeline turns read-only or disabled mid-drag; a graph-mode drag is canceled
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:95 (useKeyDrag, onKeyPointerDown's session onEnd)
- scenario: A key drag starts in dope mode on an editable `<Timeline>`. While the pointer is still held, the consumer sets `readOnly` (or `disabled`, or an enclosing hold scope starts). On release, the session's `onEnd` calls the `onKeyChange` it captured at press time. That is `bindLaneEdits`' closure from the press render, which checks no hold, so `onChange` gets the moved key even though the timeline now refuses edits. In graph mode the same sequence is refused: `LayeredCurveEditor` inherits the hold through `hold.scope` and cancels the drag on `hold.refuses` (LayeredCurveEditor.tsx:106), and Lane's `onKeysChange` wrapper rechecks `hold.edits` at commit. The ruler's scrub also reads the latest `onSeek`, which becomes `ignore`. So one decision (does a hold that starts mid-gesture refuse the gesture?) gets two answers depending on `mode`. Expected: the dope drag is canceled (revert plus `onCancel`) when `drags` turns false, as the graph drag is.
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts
- size: function
- cause: session handlers close over press-time callbacks; `drags` is read only at press
- confidence: likely

## A key selection is dropped when the consumer applies the timeline's edit after the render it triggers
- where: packages/ui/src/components/Timeline/timelineState.ts:63 (useKeyAndSegment)
- scenario: An arrow step or a drag commit calls `commit`, which runs `onChange(r.tracks)` and then `selectKey(r.selection, r.tracks)`, pinning the key to how the track reads in `r.tracks`. Suppose a consumer applies `onChange` asynchronously (a store updated after an `await`, or a debounced write). The re-render from `setHeld` then still sees the old `tracks`. In `readsOwn`, the old reading matches neither the pin (new) nor `sent` (new), so `stale` is set, the effect calls `setHeld(null)`, and `onSelectionChange(null)` fires. When the new tracks arrive a frame later, nothing is selected. The same happens when a consumer rejects or normalizes the edit. Expected: the selection survives until the tracks actually change by something the timeline did not send. Today, "the tracks have not caught up yet" is read as "changed from outside".
- evidence: read
- severity: low
- size: function
- cause: pin taken from the sent tracks before the consumer's tracks show them
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
