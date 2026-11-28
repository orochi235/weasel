## A graph-mode key drag snaps to its own live position when the consumer echoes `onInput`, so a slow drag sticks
- where: packages/ui/src/components/Timeline/LaneGraph.tsx:78 (LaneGraph, `snapX` memo)
- scenario: Timeline in `mode="graph"` with `onInput={setTracks}` (echoing the preview back). Each move, `onKeysInput` → `setKeys` → new `tracks` → `buildLanes` → `snapTimesOf` (Timeline.tsx:292) now holds the dragged key's last previewed time → new `snapX` → `KeyframeLayer` rebuilds the layer with it (KeyframeLayer.tsx:16) → `keyGesture.onMove` attracts `t` to `cfg.snapX` read live (createKeyframeLayer.tsx:83–85). A pointer that moves less than the snap radius per event is pulled back onto the key's previous time every move, so the key does not follow a slow drag; it only jumps once one event overshoots the radius. The dope path guards against exactly this by freezing the stops at press (useKeyDrag.ts:56–58, 76 "a consumer echoing the preview back would otherwise add the dragged key's own last time"); the graph path answers the same question the other way. The layer being recreated mid-gesture on every move may also disturb the gesture itself (not traced).
- evidence: read
- severity: medium
- fix: packages/ui/src/components/Timeline/LaneGraph.tsx
- size: function
- cause: snap stops read live, not frozen at press
- confidence: likely

## The ruler swallows the page's wheel and does nothing when `window` is controlled without `onWindowChange`
- where: packages/ui/src/components/Timeline/Timeline.tsx:158 (Timeline → TimeRuler `onWindowChange={… setWindow}`)
- scenario: `<Timeline window={{from:0,to:1000}} duration={5000} …>` with no `onWindowChange` (a fixed view). Timeline always hands `setWindow` to the ruler unless disabled, so TimeRuler's wheel handler (TimeRuler.tsx:85–98) computes a pan that differs from `win`, calls `preventDefault()`, and calls `setWindow`, which in useTimeWindow (timelineState.ts:27–30) neither stores it (`given` is set) nor reports it (no callback). The page cannot be scrolled with the wheel over the ruler and the view never moves. TimeRuler's own contract ("Omitted, the wheel is left to the page") is meant to cover this case; Timeline should pass `undefined` when the window is controlled and unobserved.
- evidence: read
- severity: low
- fix: packages/ui/src/components/Timeline/Timeline.tsx, packages/ui/src/components/Timeline/timelineState.ts
- size: line
- cause: setWindow handed over even when it can do nothing
- confidence: sure

## An event mark is announced as a "key"
- where: packages/ui/src/components/Timeline/LaneMarks.tsx:66 (KeyMarks)
- scenario: an event track's marks get `data-testid="timeline-event"` and the `eventMark` class, but the same `aria-label={`${row.label} key at …`}` as keyframes, so a screen reader reads "footstep key at 300 ms" for an event crossing. The `event` flag is already computed on line 59 and not used for the name.
- evidence: read
- severity: low
- size: line
- cause: label ignores row kind
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

<!-- done: 3 findings, files read: 18 -->
