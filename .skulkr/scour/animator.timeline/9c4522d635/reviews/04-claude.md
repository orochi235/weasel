## A paused timeline seeked to its end (or created paused at duration 0) finishes while paused, and the event at the end never fires
- where: packages/animator/src/timeline/createTimeline.ts:69 (tick)
- scenario: a non-looping timeline is paused, then `seek(duration())` is called (or `animator.timeline({ tracks: [event at t=0], autoplay: false })`, whose duration is 0). The next frame ticks it at rate 0 (frame.ts:80 still ticks paused entries): `parked` is false because `onSeam` requires laps left, so `finished = pos.atEnd(false)` is true. `crossings.fire()` fires nothing at rate 0, but `onDone` runs while paused and the entry retires. `resume()` does not revive it, and `rearm` refuses at the end anyway, so the event sitting at the end never fires. The same seek made while playing fires it on the next frame. types.ts says an event the playhead sits on "fires when playback next advances from there and never while paused". Instead it is lost, and `onDone` arrives while paused. The seam case (`parked`) already holds a paused playhead that is still on a lap. The last lap's end needs the same treatment: a held playhead at its end should not finish until it plays.
- evidence: read
- severity: medium
- fix: packages/animator/src/timeline/createTimeline.ts, packages/animator/src/timeline/playhead.ts
- size: function
- cause: `parked` covers only a seam with laps left
- confidence: sure

## A fractional loop count makes fractional laps, which jump the playhead part of a lap
- where: packages/animator/src/timeline/playhead.ts:8 (lapsOf)
- scenario: `loop: 1.5` (or `setLoop(2.5)`). `lapsOf` gives `loopsLeft = 0.5`. When the first pass ends at t = 1.2·d, `lapsCrossed` returns `min(floor(1.2), 0.5) = 0.5`, so `take(0.5)` sets `lap = 0.5`, and `lapBack` subtracts half a duration, putting the playhead at 0.7·d. `wrapped(0.5)` sees `laps > 0` and places the event cursor at -Infinity, so the next fire runs every event in [0, 0.7·d] at once, and the timeline then finishes partway into a "lap". `landing` uses `lapsLeft` the same way, so a seek also gets fractional laps. The count should be floored or refused. `NaN` is worse: `Math.max(1, NaN)` makes `loopsLeft` NaN, and the playhead becomes NaN.
- evidence: read
- severity: medium
- size: line
- cause: unvalidated loop count
- confidence: sure

## An event in a nested timeline is told a lateBy measured against the nested end, not the playhead
- where: packages/animator/src/timeline/fireEvents.ts:77 (createEventFirer)
- scenario: a nested timeline at 0 with `duration: 100` holds an event at t=90. One frame moves the root playhead from 80 to 200. The recursion clamps `to` to `min(to - at, end) = 100`, so `fire(lateBy)` and `report.fire` get 10. The frame actually crossed the event 110 ms ago. types.ts says `lateBy` is how far behind the frame the event was crossed, measured against `duration` only on the loop seam. Consumers that compensate with lateBy (audio, catch-up) are off by however far the playhead ran past the nested end.
- evidence: read
- severity: low
- size: function
- cause: clamped `to` reused for lateBy
- confidence: sure

## Events on the outgoing lap's tail fire before the frame is sampled, so their handlers read the previous frame's values
- where: packages/animator/src/timeline/createTimeline.ts:66 (tick) / crossings.ts:42 (wrapped)
- scenario: a looping timeline has an event near `duration`, and a frame crosses the seam. `pos.advance` calls `wrapped`, which fires the tail events inside `advance`, before `sampler.apply` runs. A handler that reads a sampled track's target or `onTick` value sees the previous frame's value. Every other event fires after sampling. The code says "Sampled before fired, so a handler reads the current frame's values", and the tail breaks that ordering.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/crossings.ts
- size: function
- cause: tail fired inside `advance`, ahead of `apply`
- confidence: sure

## `edit` on a finished timeline does not sample again, though its doc says it does
- where: packages/animator/src/timeline/createTimeline.ts:122 (sampleNow) / 155 (edit)
- scenario: a non-looping timeline has finished and retired, with the playhead at `duration`. `handle.edit(() => { lastKey.value = 50 })` without extending the duration. `rearm` declines because the timeline is at its end, and `sampleNow` returns because `!entry.live()`. So no `onTick` hears 50, and a target the track held keeps the old final value. The `edit` doc promises to "sample the tracks again where the playhead stands", and the edited key otherwise has no visible effect.
- evidence: read
- severity: low
- size: function
- cause: sampling gated on the entry being live
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
