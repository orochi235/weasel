# Findings: animator.timeline

## A seek forgets standing bookings, so an event already booked without a handle is booked a second time for the same crossing
- where: packages/animator/src/timeline/booking.ts:195 (createBooker → seek)
- scenario: booking with lookahead 100, a handle-less `book` (returns void) on an event at t=150; the playhead stands at 90, so the event is booked for about now+60 ms and, having no handle, stands. A seek to 90 or 100 (a scrubber writing the current time, or a small step back within the lap) calls `retract` (which keeps handle-less bookings, and handle-bearing ones whose `when <= now`) and then `seek`, which sets `bookings = []`. The next tick scans from the new open cursor, the dedup check `bookings.some(b => b.event === ev && b.lap === c.lap && b.r === r)` finds nothing, and it books the same (lap 0, r 150) crossing again. The cue plays twice. The firing side fires it once, and `types.ts` says a re-booking happens only after a returned handle was stopped.
- evidence: read
- severity: medium
- fix: packages/animator/src/timeline/booking.ts
- size: line
- cause: seek clears the bookings retract deliberately left standing
- confidence: likely

## `edit` (and a seek that does not revive) on a finished timeline does not resample, contrary to the `edit` and `seek` contracts
- where: packages/animator/src/timeline/createTimeline.ts:126 (sampleNow), used by edit at :157 and seek at :137
- scenario: a non-looping timeline plays to its end and retires (`entry.retire()`, `sampler.release()`). The consumer then calls `handle.edit(() => { track.keys[last].value = 42 })` without extending the duration. `rearm` returns early (`pos.atEnd(false)`), so the entry stays off the table, and `sampleNow` skips because `entry.live()` is false. No `onTick` hears the new value and no target shows it, although `TimelineHandle.edit` says it will "sample the tracks again where the playhead stands", and `seek` says tracks "are sampled at `t` at once". `seek(duration())` on a finished timeline has the same gap.
- evidence: read
- severity: medium
- fix: packages/animator/src/timeline/createTimeline.ts, packages/animator/src/timeline/types.ts
- size: function
- cause: sampleNow is gated on the entry being live
- confidence: likely

## A nested timeline's events fire with `lateBy` measured against the nested end, not the frame
- where: packages/animator/src/timeline/fireEvents.ts:81 (createEventFirer, nested branch)
- scenario: a nested timeline at `at` 0 with `duration` 100 holds an event at t=100. A frame moves the root playhead from 95 to 130. The recursion passes `to = Math.min(to - track.at, end)` = 100, so the event fires with `lateBy = 0` (and `report.fire` gets 0), although it was crossed 30 ms before the frame. The booking side for the same event uses the real playhead (`(playhead - u) / scale` against `maxLate`), so firing and booking judge lateness differently. `TimelineEvent.fire` documents an exception only for the root loop seam.
- evidence: read
- severity: low
- size: function
- cause: clamped `to` reused as the lateness reference
- confidence: sure

## An EventTrack placed twice at the same root offset is fired twice but booked once, or not at all, for the second placement
- where: packages/animator/src/timeline/booking.ts:124 (scanTrack cursor lookup) and :139 (dedup)
- scenario: one `EventTrack` object is reused in two `TimelineTrack`s that both start at the same root `at`, for example with nested durations 100 and 200. Cursors are keyed by (track, root `at`), so the second placement starts from the first placement's scanned cursor. On an endless loop, that cursor has already run past `end` 100 into later laps, so events between 100 and 200 in the second placement are never booked. Even with equal ends, the dedup by `(event, lap, r)` books each crossing once, while `fireEvents` walks both placements and fires twice. Firing and booking answer "how many runs" differently.
- evidence: read
- severity: low
- size: function
- cause: placement keyed by root offset, not by placement identity
- confidence: likely

## A fractional `loop` count leaves the playhead mid-lap after a long frame
- where: packages/animator/src/timeline/playhead.ts:8 (lapsOf), :46 (lapsCrossed)
- scenario: `loop: 2.5` gives `loopsLeft = 1.5`. A frame that crosses two or more laps computes `Math.min(Math.floor(t / d), 1.5) = 1.5`, so `take(1.5)` makes `lap` 1.5, and `lapBack` subtracts 1.5 durations, which lands the playhead mid-lap rather than on a lap boundary. `lap` is then non-integer, which breaks booking's (lap, r) crossing identity and `lapsOf(c.lap - lap, …)` arithmetic. `loop: NaN` makes `loopsLeft` NaN, and the next wrap sets `t` to NaN. Nothing rounds or refuses a non-integer count.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/playhead.ts
- size: line
- cause: loop count not floored or validated
- confidence: likely

## With laps left, a seek to the seam of a finished timeline does not revive it, though a live one plays on from the same spot
- where: packages/animator/src/timeline/createTimeline.ts:115 (rearm)
- scenario: a timeline finishes at `duration` with `loop: false`, then `setLoop(true)` and `seek(duration())`. `landing` puts it on the seam with laps left, which `Playhead.onSeam` documents as "where a seek to the end of a lap leaves it" and which a live timeline treats as the end of a lap that plays into the next. But `rearm` checks only `pos.atEnd(false)` (`t >= duration`) and ignores `lapsLeft`, so the timeline stays retired. The same seek on a live timeline continues into the next lap.
- evidence: read
- severity: low
- size: line
- cause: rearm's end test ignores laps left
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

<!-- done: 6 findings, files read: 17 -->
