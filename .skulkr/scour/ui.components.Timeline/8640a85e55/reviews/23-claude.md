# Findings: ui.components.Timeline

## An arrow step on a key that sits past the timeline's duration jumps it backward to the duration, whichever arrow is pressed
- where: packages/ui/src/components/Timeline/Lane.tsx:165 (markKeys)
- scenario: the duration shrinks, or the consumer hands over a track with a key past it, so `duration` is 1000 and a key sits at t=1500. Focus the key and press ArrowRight. `to = max(0, min(last, t + 10))` gives 1000, and `to !== t`, so `onKeyChange(i, 1000)` commits a 500 ms move to the left. A rightward step should leave the key where it is, or move it right. ArrowLeft makes the same 500 ms jump where it should step 10 ms. The graph path does the same through `xClamp` (`[0, limit - offset]`) in LaneGraph.tsx:80.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx, packages/ui/src/components/Timeline/LaneGraph.tsx
- size: line
- cause: the clamp runs on the stepped value, not on the direction of the step
- confidence: sure

## A dope-sheet drag that started while the timeline was editable still commits after the timeline turns read-only or disabled
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:94 (onKeyPointerDown, onEnd)
- scenario: a key drag begins with `hold.edits` true. Mid-drag the consumer sets `readOnly` (or a scope disables the timeline). The session's `onEnd` calls `onKeyChange`, the press-time closure of `bindLaneEdits`, and that closure checks no hold, so `props.onChange` gets the moved tracks even though the timeline now refuses edits. `drags` is read only at press. The graph path gates on `hold.edits` at commit time (Lane.tsx `onKeysChange` wrapper, LaneGraph `edits`), so the two modes answer the same question two ways.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts, packages/ui/src/components/Timeline/Lane.tsx
- size: function
- cause: hold captured at press, never reread at release
- confidence: likely

## Unmounting a lane mid-drag sends the consumer's `onInput` the whole track list as it was at the press
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:45 (unmount cleanup) → packages/ui/src/components/Timeline/Timeline.tsx:207 (bindLaneEdits onKeyRevert)
- scenario: during a dope drag that has previewed, the lane unmounts. For example, the consumer removes that track, or replaces `tracks` so the row's key changes. The cleanup's `cancel()` runs `onCancel` → `onRevert` → `report.onInput(tracks.slice())`, using the tracks captured at the press. A consumer that applies `onInput` (the documented edit protocol) gets back the deleted track and every other change made since the press. It also gets `onCancel`, from a component that is gone.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/useKeyDrag.ts
- size: function
- cause: teardown reuses the user-cancel path, which reverts to press-time tracks
- confidence: likely

## During a dope drag with an echoed preview, the segments follow the preview while the key marks stay at their press positions
- where: packages/ui/src/components/Timeline/Lane.tsx:128 (Lane, SegmentMarks vs KeyMarks)
- scenario: the consumer wires `onInput` and feeds it back into `tracks`, as the edit protocol intends. While a key is dragged past its neighbor, `KeyMarks` draws `drag.times` (the times at the press), but `SegmentMarks` draws `sampledKeys` from the live, re-sorted preview. The segment bars and the selected-segment highlight then span between positions where no key is drawn, and a segment's `data-segment-index` names a different pair of keys than the marks beside it. Both sets of marks should read from the same key list.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Lane.tsx
- size: line
- cause: segments read live keys while marks read the press snapshot
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
