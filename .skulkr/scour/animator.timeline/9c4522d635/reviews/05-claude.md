# Findings: animator.timeline

## Events the playhead played back over are never booked when forward playback resumes
- where: packages/animator/src/timeline/booking.ts:170 (createBooker → tick, the `!(scale > 0)` branch)
- scenario: a booked timeline plays forward at rate 1 to 500; its cursors have scanned to ~600. It then plays at rate -1. The first backward frame calls `clock.halt()`, which answers true, and `stopWhere` pulls every cursor back to the playhead (~499). On later backward frames `halt()` answers false (`lastScale` is already 0), so the cursors stay at 499 while the playhead goes back to 200. When rate 1 resumes, `scanTrack` starts from the cursors at 499, so the bookable events in (200, 499] are never booked. Firing does fire them, because `EventCursor.back` moved the firing cursor back to 200. A backward lap crossing (lap decreases) leaves cursors a whole lap ahead in the same way. What should happen: on resume, booking starts from where the playhead stands, as firing does.
- evidence: read (traced tick → halt → stopWhere and clockEstimate.halt)
- severity: medium
- fix: packages/animator/src/timeline/booking.ts
- size: line
- cause: cursors are pulled back only on the first held/backward frame, not as the playhead keeps moving back
- confidence: likely

## An edit to a track whose last key the playhead has passed never reaches the target
- where: packages/animator/src/timeline/trackHolds.ts:117 (createTrackSampler → place, the `'after'` branch)
- scenario: a track on a target has keys at 0..100, the timeline lasts 200, and the playhead is paused at 150. The track already committed its last value when it crossed 100 (`h.where === 'after'`). `handle.edit(() => { track.keys[1].value = 9 })` → `sampleNow` → `place` computes `where === 'after'`, `h.where` is already `'after'`, so nothing happens. The target keeps the old final value until the playhead re-enters the keys. Retargeting the track in an edit (`track.target = other`) behaves the same way: the new target never gets the track's final value, because the stale check only runs `if (h.hold && …)`. `TimelineHandle.edit` documents "sample the tracks again where the playhead stands". What should happen: past the last key, an edit (`h.edit !== edit`) commits the resampled value again.
- evidence: read
- severity: medium
- size: line
- cause: the `'after'` commit is keyed on a change of where the playhead is, not on an edit
- confidence: sure

## `edit` on a finished timeline does not resample its tracks, as its doc promises
- where: packages/animator/src/timeline/createTimeline.ts:118 (createTimeline → sampleNow)
- scenario: a non-looping timeline plays to its end and retires (`entry.live()` false). Then `handle.edit(() => { lastKey.value = 9 })` runs without extending the duration. `rearm` declines because the timeline is at its end, and `sampleNow` returns early because the timeline is not live. No `onTick` is told the edited value, and no target is recommitted. Both the `edit` JSDoc ("sample the tracks again where the playhead stands") and the 2026-10-11 ruling ("`seek` and `edit` on a timeline sample their tracks at once") say they should be. A seek to `duration` on a finished timeline also skips sampling.
- evidence: read
- severity: low
- fix: packages/animator/src/timeline/createTimeline.ts, packages/animator/src/timeline/trackHolds.ts (sampling a retired timeline has to release whatever holds it opens)
- size: function
- cause: resampling is gated on being on the animator's table
- confidence: sure

## A fractional or NaN `loop` gives fractional or NaN lap counts
- where: packages/animator/src/timeline/playhead.ts:8 (lapsOf)
- scenario: `loop: 2.5` gives `loopsLeft = 1.5`. A long frame that reaches 3×duration makes `lapsCrossed` answer `min(3, 1.5) = 1.5`, so `lap` becomes 1.5 and the playhead is lapped back by 1.5 durations. `landing` takes fractional laps the same way. The booker's `(lap, r)` identity and `report.lap` get non-integer laps. `loop: NaN` gives `loopsLeft = NaN`, then `take(NaN)` makes `lap` and `t` NaN for good. What should happen: refuse a count that is not an integer, or floor it, as `lengthOf` refuses a NaN duration.
- evidence: read
- severity: low
- size: line
- cause: loop count not validated
- confidence: sure

## `bindClip` accepts unsorted keys and events, which breaks sampling, holds and event search
- where: packages/animator/src/timeline/clipShape.ts:44 (sampled / events)
- scenario: a clip file with keys `[{t:100},{t:0}]` or events `[{t:50},{t:10}]` passes `checkClip`. `trackHolds.place` takes `keys[0]`/`keys[last]` as the bounds, so the playhead reads as "after" at t=50 and the target is committed early. `firstAfter`/`firstAtOrAfter` binary-search unsorted events, so events are skipped or fired twice. The `types.ts` contract requires the keys and events to be sorted ascending, and the clip check is meant to refuse a bad file naming where. What should happen: refuse, or sort, a decreasing `t`.
- evidence: read
- severity: low
- size: function
- cause: shape check covers types only, not ordering
- confidence: sure

## `toClip` on a cyclic key value or event data overflows the stack instead of naming the track
- where: packages/animator/src/timeline/clip.ts:168 (isClipValue)
- scenario: a key value `const v = { a: 1 }; v.self = v;` makes `isClipValue` recurse until it throws `RangeError: Maximum call stack size exceeded`. `toClip`'s documented "Throws, naming the track, on … a value JSON would not read back" is not met.
- evidence: read
- severity: low
- size: function
- cause: no visited set in the recursive value check
- confidence: sure

## `targetStops` writes the angle unwrap into the key's own value when a target's `axes.to` hands back its input
- where: packages/animator/src/timeline/targetStops.ts:24 (targetStops)
- scenario: a target made with custom axes `{ to: (v) => v, from: Array.from, angles: [0] }` (the `TargetAxes.to` contract does not ask for a fresh array). The keys are `[0]` and `[6]`. The short-way unwrap runs `row[0] = prev[0] + short[0]`, which rewrites the second key's `value` array in place, to about -0.28. The edited key is then what an editor reads back and what `toClip` writes. The built-in axes slice their input, so only custom axes hit this. What should happen: copy `row` before adjusting it.
- evidence: read
- severity: low
- size: line
- cause: mutating the array `axes.to` returned
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

<!-- done: 7 findings, files read: 17 -->
