# Audit round 60 — animator.timeline

## A targeted sampled track nested in two places fights itself: one placement's `before`/`after` undoes the other's hold every frame
- where: packages/animator/src/timeline/trackHolds.ts:65 (place), :89 (visit)
- scenario: one `NestedTimeline` object (holding a sampled track with a `target`, keys 0..500) placed twice in a root, `at: 0` and `at: 1000`. At root t=200, the first placement samples at 200 → `inside`, opens a hold showing v(200); the second samples at −800 → `before` → `h.hold.leave(false)`, `hold = null`. `held` is keyed by the track object alone, so the frame ends with no hold and the first run of the motion never shows. Later (t=1200) the first placement is `after` and the second `inside`: each frame the hold is opened by one placement and committed by the other, so the target commits every frame and re-holds. Event tracks are booked and fired per placement (booking.ts `Cursors` keyed by track then root offset, a124808852), so the timeline answers "one track nested in two places" two different ways. It should keep one hold state per (track, placement), or resolve placements consistently.
- evidence: read
- severity: medium

## An event track the booker first meets after the start books every event behind the playhead at once, late, which crossings never fire
- where: packages/animator/src/timeline/booking.ts:125 (scanTrack), :93 (`start`)
- scenario: a timeline with `booking` (default `maxLate: Infinity`) plays to 5000 ms with no seek. An `edit` pushes a new event track with `book` events at 100, 200 … 4900 (or nests one in a new timeline track, or moves an existing nested track's `at`, which keys a new cursor). `stopWhere` pulls existing cursors back only to the playhead and never moves `start` forward (it stays `{ lap: 0, r: -Infinity }` until a seek), so the next tick's `scanTrack` starts the new track at `start`: `(playhead - u) / scale > maxLate` is false, and all 49 events are booked with `when` clamped to `now` — a burst of sounds for edges long past. On a looping timeline at lap 5, lap 0's events are booked the same way (`lapStart` is negative). The event cursor (fireEvents.ts) is one global position, so none of those events `fire`: booking and firing answer the same crossing two ways. A track first seen should start from the playhead cursor, as `seek` does.
- evidence: read
- severity: medium

## The booker's cursors are keyed by every root offset a track was ever nested at, and only `seek` clears them
- where: packages/animator/src/timeline/booking.ts:74 (Cursors), :155 (scanTrack), :193 (seek)
- scenario: an editor drags a nested timeline track (holding an event track) across the root by editing its `at` each pointer move, on a booked timeline: each new `at` adds an entry to that track's `Map<number, Cursor>` (`placesOf(...).set(at, c)`), and nothing prunes the old offsets — `stopWhere`'s `pullBack` rewrites them, `edit` keeps them, only `seek` clears. A long drag over fractional offsets grows the map without bound for the timeline's life, and every pass of `pullBack` walks all of them. Combined with the finding above, each new offset also books its whole history late.
- evidence: read
- severity: low

## An `edit` to a held track's `weight`, `axes` or `target` is ignored while the playhead stays within its keys
- where: packages/animator/src/timeline/trackHolds.ts:57 (openOn), :75 (place)
- scenario: a sampled track with `target: a, weight: 1` is inside its keys; the consumer calls `handle.edit(() => { track.weight = 0.25 })` (a crossfade set by hand) or `track.axes = ['x']` or `track.target = b`. `openOn` captured the number weight by value (`() => w`, `fixed: true`), plus `st.axes` and `st.target`, when the hold opened; `edited()` only bumps `edit`, so `place` just `touch`es the existing hold. The target keeps the full-weight, all-axes hold on the old target until the playhead leaves the keys and re-enters; with `target` changed, `a` goes on showing the track's values and `b` never moves. `TimelineHandle.edit` promises the tracks are sampled again where the playhead stands. The hold should be reopened when an edit changed what it was opened with.
- evidence: read
- severity: medium

## A seek from an event on the outgoing lap's tail fires the landing's events on the same frame; a seek from any other event waits for the next frame
- where: packages/animator/src/timeline/crossings.ts:41 (wrapped), :46 (fire); packages/animator/src/timeline/createTimeline.ts:80 (tick)
- scenario: a looping timeline, duration 1000, an event at 990 whose `fire` calls `handle.seek(300)`, and an event at 300. A frame goes 980 → 1010: `wrapped` fires the tail, the handler seeks (`place(300, open)`), `wrapped` returns `sought`, but `tick` never learns of it — `crossings.fire()` then runs `events.to(tracks, 300)` from the open cursor at 300 and fires the 300 event that frame with `lateBy` 0, and `sought` stays false. The same handler on an event at 500 (no wrap) stops the frame's crossings through `fire()`'s `moved`, and the 300 event fires on the next advancing frame, as `TimelineHandle.seek` documents ("an event exactly at `t` fires when playback next advances"). The tail's seek should end the frame's crossings as a seek from `fire()` does.
- evidence: read
- severity: low

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
