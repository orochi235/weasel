# Audit round 79: ui.components.Timeline

## Graph-mode lanes ignore the hold's tab order and focus attributes
- where: packages/ui/src/components/Timeline/Lane.tsx:113 (Lane → LaneGraph), packages/ui/src/components/Timeline/LaneGraph.tsx:22 (LaneGraphProps)
- scenario: a disabled `<Timeline mode="graph">` with no reason anywhere. `TimelineProps` says the marks then leave the tab order, and the dope path carries that through `mark` (`tabIndex: -1`, `hold.focus`) on every key, segment and disclosure. `LaneGraph` takes neither `tabIndex` nor the focus attrs, and `keyframeMarks.tsx` hardcodes `tabIndex={0}` on every key, segment and handle. So every graph key and segment stays tabbable and carries no hold focus attributes. The tab order should match dope mode.
- evidence: read (keyframeMarks.tsx:42/69/89 hardcode tabIndex 0; LaneGraph never receives `hold.tabIndex`/`hold.focus`)
- severity: medium

## A dragged key snaps to its own live position when the consumer echoes `onInput`
- where: packages/ui/src/components/Timeline/Timeline.tsx:83 (snapTimesOf over `rows`), packages/ui/src/components/Timeline/useKeyDrag.ts:58 (`at`, reading the latest `snapTimes`)
- scenario: the consumer follows the edit protocol and writes `onInput`'s tracks back into `tracks`. Each preview rebuilds `rows`, so `snapTimesOf` now holds the dragged key's own previewed time. `at` reads the latest `snapTimes`, so on the next move the key is pulled back to where it already is until the pointer gets more than the snap radius past it. The drag moves in sticky jumps instead of following the pointer. The same happens in graph mode, where `snapX` comes from the same list. The key's own previewed time (or the whole dragged key) should be left out of its stops.
- evidence: read (inference from the data flow; not run)
- severity: medium

## During an echoed dope drag the selection index points at a neighboring key
- where: packages/ui/src/components/Timeline/Timeline.tsx:200 (bindLaneEdits onKeyInput), packages/ui/src/components/Timeline/timelineState.ts:52 (readsOwn)
- scenario: drag key 0 past key 1 with `onInput` echoed into `tracks`. `moveKey` re-sorts the live tracks, so the dragged key is now index 1, but the selection stays `{keyIndex: 0}`. It passes the stale check because the reading matches `sent`. Until release, `aria-current` and the inspector's `renderKeyEditor` show the neighbor key, and `commit`/`setEasing` from the inspector would edit the neighbor. The selection should follow the preview's `selection`, as `commit` does on release.
- evidence: read (inference)
- severity: low

## A disabled timeline still changes its segment selection on an empty press or Escape
- where: packages/ui/src/components/Timeline/Lane.tsx:96 (onPressEmpty), packages/ui/src/components/Timeline/Timeline.tsx:101 (onRootKeyDown Escape)
- scenario: a segment is selected, then the timeline turns disabled ("nothing responds but focus"). A press on empty lane space calls `dropSegment` (it is not gated by `hold.looks`), and Escape on the root drops it too. The inspector's easing picker disappears in response to input on a disabled control. Both should be refused while `hold.disabled`, as `onSelectSegment` is.
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
