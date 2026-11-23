# Audit round 77 — ui.components.Timeline

## insertKey into an eased stretch makes its first half linear, contrary to its doc
- where: packages/ui/src/components/Timeline/keys.ts:111 (insertKey)
- scenario: keys `[{t:0,v:0},{t:800,v:120,easing:'easeOutCubic'}]`; double-click at 400 inserts `{t:400, value: sampleTrack(…)}` with no `easing`. A key's easing shapes the approach INTO it (`setKeyEasing`, `SegmentMarks` "segment into"), so 0→400 now runs linear and only 400→800 keeps `easeOutCubic`. The doc says "An eased stretch runs its easing again over each side of the new key"; only one side does. The new key should copy the next key's easing (or the doc should say the first side goes linear).
- evidence: read
- severity: low

## Dragged keys snap to sampled keys only, never to event times
- where: packages/ui/src/components/Timeline/Timeline.tsx:236 (snapTimesOf)
- scenario: an event track with events at 300 and 900; dragging the 300 event toward 900 does not snap to it, and dragging a sampled key never snaps onto an event, because `snapTimesOf` adds `k.t` only for `row.kind === 'sampled'`. The doc says "Every key time on every row", and event marks are drawn, labeled ("key at …") and dragged as keys by the same `useKeyDrag`.
- evidence: read
- severity: low

## Graph-mode Delete leaves focus on a different key than the one selected
- where: packages/ui/src/components/Timeline/Timeline.tsx:104 (onRootKeyDown) / Lane.tsx:89 (markKeys only wired in dope)
- scenario: graph mode, keys 0,1,2, focus on key 1, press Delete. `deleteKey` selects index 0, but the layer's marks are keyed by index, so the element that kept focus is index 1, now drawing the old key 2. Focus is on key 2 while `aria-current` marks key 0; the next arrow press steps the unselected key. Dope mode sets `refocus` and moves focus to the selection (`useFocusFollowsKey`); graph mode never does — the same decision answered two ways.
- evidence: read (graph-side focus behavior inferred from `keyframeMarks` keyed by index, not run)
- severity: low

## A selection on a collapsed nested row stays editable in the inspector while Delete refuses it
- where: packages/ui/src/components/Timeline/TimelineInspector.tsx:30 (TimelineInspector) vs Timeline.tsx:243 (deletable)
- scenario: expand a nested timeline, select a key (or segment) on its row, collapse the row. The selection persists (`useKeyAndSegment` only drops a segment when key times change), so the inspector keeps rendering `renderKeyEditor` / the EasingPicker for a key that is no longer drawn, and edits to it go through. Delete on the same selection is refused because `deletable` requires the row to be drawn. Whether a hidden selection is live is answered two ways; collapsing should drop it, or both should accept it.
- evidence: read
- severity: low

## ZOOM_STEP is documented as one notch's factor but is a per-pixel exponent
- where: packages/ui/src/components/Timeline/TimeRuler.tsx:15 (ZOOM_STEP)
- scenario: the zoom applied is `Math.exp(px.y * ZOOM_STEP)` with `px` the wheel delta in pixels (a notch is ~100 px), so one notch zooms by ~e^0.15 ≈ 1.16, not by 0.0015. A reader tuning it from the comment sets a value off by two orders of magnitude.
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

<!-- done: 5 findings, files read: 18 -->
