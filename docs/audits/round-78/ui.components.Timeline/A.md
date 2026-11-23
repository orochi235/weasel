# Audit round 78 — ui.components.Timeline (blind reviewer)

## A dragged key can land past `duration`, where the window can never show it
- where: packages/ui/src/components/Timeline/useKeyDrag.ts:47 (useKeyDrag, `track = { min: offset, max: Infinity, … }`); packages/ui/src/components/Timeline/LaneGraph.tsx:20 (`TRACK_TIME = [0, Infinity]`)
- scenario: `<Timeline duration={2000}>` at the full window; drag a key and release with the pointer past the lane's right edge. `alongTrack` returns an unclamped fraction (`f > 1`), `sliderAt` clamps only to `max: Infinity`, so the key commits at e.g. 2600 ms. `useTimeWindow` bounds the window to `{0, duration}` and `TimeRuler` pans and zooms within those bounds, so the key is now clipped out of every reachable window and can be reached again only by Tab. Graph mode does the same through `xClamp: [0, Infinity]`. The ruler's own scrub clamps to the window; the key drag should clamp to the bounds (or the bounds should grow to cover keys).
- evidence: read (useKeyDrag, alongTrack.ts, timelineState.useTimeWindow, TimeRuler)
- severity: medium

## The held key selection is never checked against the tracks, though the segment selection is
- where: packages/ui/src/components/Timeline/timelineState.ts:37 (useKeyAndSegment)
- scenario: uncontrolled `<Timeline>`; select key 1 on track `[2]`; the consumer then edits `tracks` itself (removes track 0, or an `<AnimatedTimeline>` handle edited elsewhere, or an undo that restores fewer keys). `selection` stays `{ trackPath: [2], keyIndex: 1 }`, which now names a key on a different track or a different key. The inspector edits it and Delete (`deletable` checks only the index range) deletes it. The segment selection beside it is dropped as soon as its track's key times change (`keyTimesAt`), so the same question — "is this selection still the thing the user picked" — is answered two ways in one hook.
- evidence: read
- severity: medium

## Fold state is keyed by index path, so an external track insert or removal opens a different nested row
- where: packages/ui/src/components/Timeline/timelineState.ts:67 (useFolds); packages/ui/src/components/Timeline/lanes.ts:41 (row `key` = dotted index path)
- scenario: nested timeline at index 3 is expanded (`expanded = {'3'}`); the consumer inserts a track at index 0. The nested row is now `'4'` and collapses, while whatever is now at index 3 (if it is a nested timeline) expands. `LaneRow.key` is documented as "stable across re-renders and edits", which holds only for the timeline's own key edits.
- evidence: read
- severity: low

## Inserting into an empty sampled track seeds a numeric `0` whatever the track's value type
- where: packages/ui/src/components/Timeline/keys.ts:108 (insertKey)
- scenario: a sampled track of colors or strings whose keys were all deleted; double-click its lane. `value = st.keys.length === 0 ? 0 : sampleTrack(st, t)` inserts `{ t, value: 0 }`, and the track's `interpolate` for colors/strings then receives a number. The empty-track case has no type to seed from, so it should refuse the insert (or require a seed) rather than invent a number.
- evidence: read
- severity: low

## A nested timeline's bar ignores where its parent stops playing it
- where: packages/ui/src/components/Timeline/Lane.tsx:206 (NestedBar)
- scenario: expanded nested timeline A (`duration: 300`) holds a timeline track B at `at: 200` whose span is 400. B's row has `end = 300 + A.at`, and its keys past that are marked `data-past`, but B's collapsed bar is drawn for its full 400 ms, to 600 ms past A's start, painting over the `AfterEnd` shading that `Lane` drew underneath it. The bar's width should be cut at `row.end` as the keys' past marking is.
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
