## A fractional or NaN `loop` count breaks the playhead's lap arithmetic
- where: packages/animator/src/timeline/playhead.ts:8 (lapsOf)
- scenario: `animator.timeline({ tracks, loop: 2.5 })` → `loopsLeft` is 1.5; the first wrap takes 1 lap, the second takes `min(1, 0.5) = 0.5`, so `lapBack` moves the playhead back half a lap (it resumes mid-lap), `lap` becomes 1.5, and `wrapped(0.5)` re-fires events from the start of a lap the playhead is not at. `loop: NaN` makes `lapsCrossed` return NaN and the playhead NaN. `animator.loop` refuses a count that is not a whole number or Infinity (`loop.ts:33`); the timeline's own `loop` and `setLoop` accept anything.
- evidence: read
- severity: medium
- fix: packages/animator/src/timeline/playhead.ts (validate in `lapsOf`, which both creation and `setLoop` go through)
- size: line
- cause: unvalidated loop count
- confidence: sure

## The booker reads the tracks array captured at creation, while firing, sampling and duration reread `opts.tracks`
- where: packages/animator/src/timeline/crossings.ts:33 (createCrossings)
- scenario: a consumer keeps the options object it passed and, in `handle.edit(() => { opts.tracks = next; })`, replaces the array → `tracksEnd`, `sampler.apply`, `events.to` and `handle.tracks()` all read `next`, but `createBooker`'s `host.tracks` is still the old array, so `book` keeps booking the removed events and never books the new ones. Every other reader answers "which tracks" from `opts.tracks` at call time.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/booking.ts (make `BookerHost.tracks` a getter or function)
- size: line
- cause: tracks array captured once
- confidence: likely

## An event at a nested timeline's end reports a `lateBy` measured against that end, not the playhead
- where: packages/animator/src/timeline/fireEvents.ts:79 (createEventFirer)
- scenario: nested timeline at 0 with `duration: 50`, event at t=50; a frame moves the root playhead 40 → 66 → the nested call passes `to = min(66, 50) = 50`, so `fire(lateBy)` and `report.fire` get 0 instead of 16. The `TimelineEvent.fire` doc says lateBy is how far behind the frame the edge was crossed, with only the loop seam measured against `duration`; a nested end is not that seam, and the booker books the same event at its true root time.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/fireEvents.ts (pass the unclamped `to` down for lateBy, clamp only the range)
- size: function
- cause: clamped `to` reused for lateBy
- confidence: likely

## Handlers on the outgoing lap's tail run before the frame is sampled
- where: packages/animator/src/timeline/createTimeline.ts:66 (tick)
- scenario: a looping timeline whose frame straddles the seam → `pos.advance` calls `crossings.wrapped`, which fires the tail events (`events.to(…, duration)`) before `sampler.apply` runs. A tail handler that reads a target or an `onTick`-fed value sees the previous frame's sample. The comment at the `sampler.apply` call says sampling comes before firing so a handler reads the current frame's values; the in-lap events fired by `crossings.fire()` get that, the tail events do not.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/crossings.ts (defer the tail flush to `fire()`)
- size: function
- cause: tail fired inside advance
- confidence: likely

## An edit to a track's last key leaves the target showing the old value while `onTick` gets the new one
- where: packages/animator/src/timeline/trackHolds.ts:113 (place)
- scenario: the playhead stands past a targeted track's last key (`where === 'after'`), and `handle.edit` changes that key's value → `sampleNow` samples the new value and passes it to `onTick`, but `place` commits only when `h.where !== 'after'`, so the target keeps the old final value. `edit` is documented to sample the tracks again where the playhead stands, and the track and its own `onTick` now disagree.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/trackHolds.ts (recommit on `h.edit !== edit` while after)
- size: line
- cause: after-branch ignores edits
- confidence: likely

## Files read
packages/animator/src/timeline/booking.ts
packages/animator/src/timeline/clip.ts
packages/animator/src/timeline/clipShape.ts
packages/animator/src/timeline/clockEstimate.ts
packages/animator/src/timeline/createTimeline.test-harness.ts
packages/animator/src/timeline/createTimeline.ts
packages/animator/src/timeline/crossings.ts
packages/animator/src/timeline/entry.ts
packages/animator/src/timeline/fireEvents.ts
packages/animator/src/timeline/index.ts
packages/animator/src/timeline/length.ts
packages/animator/src/timeline/playhead.ts
packages/animator/src/timeline/sampleTrack.ts
packages/animator/src/timeline/targetStops.ts
packages/animator/src/timeline/timeline.fixture.ts
packages/animator/src/timeline/trackHolds.ts
packages/animator/src/timeline/types.ts

<!-- done: 5 findings, files read: 17 -->
