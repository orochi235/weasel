## Graph-mode lanes ignore the timeline's hold for tab order and focus attributes
- where: packages/ui/src/components/Timeline/Lane.tsx:113 (Lane → LaneGraph); packages/ui/src/components/Timeline/LaneGraph.tsx:64 (LaneGraph)
- scenario: a `<Timeline disabled mode="graph">` with no reason anywhere. In dope mode every key and segment mark gets `mark` (`tabIndex: -1` plus the hold's focus attrs), so the marks leave the tab order and carry the hold's ARIA. In graph mode `Lane` hands `LaneGraph` only `edits`; `LaneGraphProps` has no way to take `hold.tabIndex` / `hold.focus`, and the keyframe layer's marks render `tabIndex={0}` (CurveEditor/keyframeMarks.tsx:42). So the same disabled timeline keeps every graph key and segment in the tab order with no disabled semantics: the hold answers "is this mark reachable" two ways depending on the mode. It should apply the same `mark` attributes in both modes.
- evidence: read (Lane.tsx's LaneGraph props, LaneGraphProps, keyframeMarks.tsx segmentTargets)
- severity: medium

## An uncontrolled key selection survives track edits that move its index to another key; the segment selection beside it is dropped
- where: packages/ui/src/components/Timeline/timelineState.ts:37 (useKeyAndSegment)
- scenario: an uncontrolled `<Timeline>` (or `<AnimatedTimeline>`, whose tracks the handle can change from outside) has key 2 of track `[0]` selected. The consumer inserts a key before it, or reorders the tracks, so `tracks` changes. The segment selection is checked against its track's key times on every render and dropped when they change, but the key selection is checked against nothing: `{trackPath:[0], keyIndex:2}` now names the key that was at index 1, or a key on another track. The inspector edits that key, and Delete/Backspace (`onRootKeyDown` falls back to `selection`) deletes it. Both selections should be invalidated by the same rule.
- evidence: read
- severity: medium

## Delete or Backspace with focus on the transport, the Graph switch or the inspector deletes the selected key
- where: packages/ui/src/components/Timeline/Timeline.tsx:96 (onRootKeyDown)
- scenario: select a key, then focus the play button, the Graph switch, the EasingPicker's buttons, or a non-text control inside `renderKeyEditor` (a swatch, a `role="slider"` div), and press Backspace. `isEditableTarget` lets non-text targets through, and `markedKey` returns `undefined` for any target outside a key mark, so `target` falls back to `selection` and the key is deleted, including the key the consumer's editor is currently showing. The handler should only act on presses from the lanes or the root itself, which is what `useKeyEditsHeldByPress.onKeyDownCapture` already treats as the timeline's own targets.
- evidence: read
- severity: low

## Key and segment marks on a nested row are named by track-local time, not the ruler time they sit at
- where: packages/ui/src/components/Timeline/LaneMarks.tsx:66 (KeyMarks), LaneMarks.tsx:31 (SegmentMarks)
- scenario: a nested timeline at `at: 600` with a key at `t: 0`. The mark is drawn under 600 ms on the ruler (`pct` adds `row.offset`), and the playhead readout and ruler labels read ruler time, but its accessible name is "lid key at 0 ms" (`msLabel(t)` without `row.offset`). A screen-reader user cannot match the key to the ruler or the playhead. The same applies to segment names. The name should use `t + row.offset`, the time the mark is drawn at.
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
