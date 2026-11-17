I couldn't write `.skulk/out/findings.md` because the write permission was denied, so the whole findings document follows.

# Audit round 33, area `animator.timeline`: blind reviewer findings

The frozen commit d4226fab0e doesn't exist in this checkout (`git cat-file` fails on it). HEAD is 4c701b3803, and none of the area's files have working-tree changes, so the lines below cite HEAD.

## A booking timeline of infinite duration books every event at once with a NaN start time
- where: packages/animator/src/timeline/booking.ts:119 (scanTrack), also :89 (unwrapped)
- scenario: `animator.timeline({ duration: Infinity, booking: { clock }, tracks: [{ kind: 'event', events: [{ t: 0, book }, { t: 60000, book }] }] })`.
  - `lapStart = (c.lap - lap) * duration` is `0 * Infinity = NaN`. That makes `lapStart > horizon` and `u > horizon` both false, so the lookahead never stops the scan.
  - Every event on the track is booked on the first tick. `whenFor` returns `Math.max(est + NaN, now) = NaN`, so each `book(NaN)` gets no usable time.
  - `unwrapped` also returns NaN, so a retime after a rate change compares against NaN and stops every booking.
  - Expected: book only within `lookahead`, at finite times, as a finite duration does. Infinite durations are supported (eb8743c460).
- evidence: read
- severity: high

## A nested timeline (or event track) used in two places books only one of them
- where: packages/animator/src/timeline/booking.ts:117 and :135 (scanTrack)
- scenario: one `NestedTimeline` `N` holds an event `{ t: 500, book }` and is nested twice, at `at: 0` and at `at: 1000`.
  - Cursors are keyed by the `EventTrack` object, and bookings are deduped by `(event, lap)`. Neither key includes root time.
  - Scanning the first instance leaves the shared cursor at r=500. The second instance reads that cursor and finds its event at r=1500. It then skips it, because a booking with the same event and lap already exists.
  - In the other order, the cursor at r=1500 hides r=500 instead.
  - `fireEvents.ts` fires both instances, so a booked sound plays once while a fired handler runs twice.
  - Expected: key the cursor and the dedupe on the instance (its root offset).
- evidence: read
- severity: medium

## A timeline canceled by an event handler during the wrap's tail flush reopens its target holds
- where: packages/animator/src/timeline/createTimeline.ts:145 (onWrap) → :172 (tick)
- scenario: a looping timeline has a targeted sampled track and an event near the end of the lap whose `fire` calls `handle.cancel()`. A frame straddles the seam.
  - `onWrap` flushes the tail with `events.to`. The handler cancels, which releases every hold, and the table retires the entry.
  - `onWrap` discards that result. `tick` goes on to `sampler.apply(opts.tracks, playhead)`, which reopens a hold on each target whose keys span the new playhead.
  - Nothing releases those holds again: `canceled` is already set, and the `if (canceled)` check comes after `apply`. The target keeps a voice from a dead timeline.
  - Expected: check `canceled` after crossing laps, before sampling.
- evidence: read
- severity: medium

## A timeline canceled from a sampled track's `onTick` reopens later tracks' holds and fires one more event
- where: packages/animator/src/timeline/createTimeline.ts:172-175 (tick); packages/animator/src/timeline/fireEvents.ts:74-84
- scenario: tracks are `[A (sampled, onTick: () => handle.cancel()), B (sampled, target: x)]`, and an event is crossed this frame.
  - `sampler.apply` calls A's `onTick`, and the cancel releases the holds. `visit` then goes on to B and opens a hold on `x` that is never released.
  - `events.to` runs next. `fire` calls the first crossed event's `fire` before it checks `moved()`, which reads `gone()`. So one event fires on a canceled timeline.
  - `if (canceled) return true` only comes after both.
  - Expected: stop sampling once canceled, and check `gone` before each event rather than after. unruled.md:833 rules that a cancel stops the frame's remaining crossings.
- evidence: read
- severity: medium

## A nested timeline's negative duration counts as 0 for firing and for the end time, but stays negative for sampling and booking
- where: packages/animator/src/timeline/trackHolds.ts:96 (visit); packages/animator/src/timeline/booking.ts:70-71 (endWithin)
- scenario: a nested `{ at: 0, timeline: { duration: -5, tracks: [event at t=0 with fire+book, sampled keys from t=0 on target x] } }`.
  - `fireEvents` and `trackEnd` clamp it through `lengthOf` to 0, so the event at 0 fires.
  - `endWithin` uses -5 raw, so `at + 0 > -5` holds and the same event never books.
  - `trackHolds.visit` samples at `min(t, -5) = -5`, which is before the keys, so the hold on `x` never opens.
  - One ruling (unruled.md:831–832, "one below 0 plays as 0") is applied differently in three places.
- evidence: read
- severity: low

## `toClip` writes an infinite duration that `bindClip` then refuses
- where: packages/animator/src/timeline/clip.ts:226 (timelineToClip); also :211 (`at`) and :178 (bezier points)
- scenario: `toClip({ duration: Infinity, tracks })` returns a clip with `duration: Infinity`. `JSON.stringify` writes that as `null`, and `checkClip` refuses it on reading back ("duration is not a number").
  - Non-finite bezier points or a non-finite `at` behave the same way.
  - `toClip` promises to throw on anything JSON would not read back, and it does so for key values, but not for these numeric fields.
  - Expected: refuse (or name) a non-finite duration, `at` or bezier point in `toClip`.
- evidence: read
- severity: low

## A timeline that finished forward can't be revived at its end to play backward, but one that finished backward is revived at 0 and calls `onDone` again
- where: packages/animator/src/timeline/createTimeline.ts:208 (rearm)
- scenario: the two directions get different answers.
  - **Finished forward:** a timeline plays to its end and retires. Then `setTimeScale(-1); seek(duration())`. `rearm` returns early because `playhead >= duration`, so the timeline stays off the table and never plays back.
  - **Finished backward:** a timeline at scale -1 rewinds to 0, calls `onDone` and retires. Then `seek(0)`. `rearm` sees `0 < duration`, revives it and clears `done`, and the next tick rewinds again and calls `onDone` a second time.
  - `rearm` only knows the forward end, while `tick` treats both ends as finished (`rewound`).
- evidence: read
- severity: low

## Files read
packages/animator/src/timeline/booking.ts
packages/animator/src/timeline/clip.ts
packages/animator/src/timeline/clipShape.ts
packages/animator/src/timeline/createTimeline.test-harness.ts
packages/animator/src/timeline/createTimeline.ts
packages/animator/src/timeline/fireEvents.ts
packages/animator/src/timeline/index.ts
packages/animator/src/timeline/sampleTrack.ts
packages/animator/src/timeline/targetStops.ts
packages/animator/src/timeline/timeline.fixture.ts
packages/animator/src/timeline/trackHolds.ts
packages/animator/src/timeline/types.ts

<!-- done: 7 findings, files read: 12 -->