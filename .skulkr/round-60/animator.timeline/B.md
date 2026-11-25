# Findings — animator.timeline (round 60, reviewer)

## An event track added by `edit` (or a nested track moved to a new `at`) on a booked timeline books every past event of it, from lap 0 on, at once
- where: packages/animator/src/timeline/booking.ts:125 (scanTrack), with `start` at :93 / :115
- scenario: a timeline with `booking` plays to 5000 ms (or into lap 5 of a loop). `handle.edit(() => tracks.push({ kind: 'event', events: [{t:0,book},{t:1000,book},…] }))`, or edits a `TimelineTrack.at`. The new track (or the new `at` key) has no cursor, so `scanTrack` starts from `start`, which is `{ lap: 0, r: -Infinity }` for any timeline never seeked (`stopWhere` only ever moves `start` back, never forward). `lapStart` is negative, so every event of lap 0 and — after the lap jump at :134 — every event of the current lap before the playhead passes `u > horizon`, and with the default `maxLate: Infinity` each `book(when)` is called with `when = now`: a burst of stale bookings landing together. The firing path (`fireEvents.ts` cursor, one `at` for all tracks) fires none of those past events, so the two paths disagree about the same edit. Expected: a new track books from the playhead on, as it fires.
- evidence: read
- severity: medium

## A revived timeline re-registers a copy of the first registration's mutated seed, `ended: true` included, so its later end, cancel and throw are handled as for an ended animation
- where: packages/animator/src/timeline/entry.ts:57 (createEntry → revive), seed built at packages/animator/src/timeline/createTimeline.ts:104
- scenario: `register(seed)` (engine/table.ts:180) uses the seed object itself as the table row, and when the timeline first finishes `table.finish` → `reportEnd` sets `seed.ended = true` (table.ts:137). `revive()` then registers `{ ...seed, keepExisting: true }`, which copies `ended: true` (and the cached `info`, `due`, `idle`…) into the new row. From then on: (1) the revived run's finish emits no `end` watch event (`reportEnd` returns early on `a.ended`); (2) canceling it emits no `cancel` event (table.ts:153, :241); (3) worst, if its tick throws (a sampled track's `onTick`, a hold's `value`), `retireThrown` sees `anim.ended` and calls `table.drop` instead of `table.retire` (frame.ts:98), so the timeline's `onCancel` never runs: its target holds are never released (the target keeps showing the track's value as a hold), bookings ahead are never stopped, and `entry.live()` stays true, so a later `seek` takes the `if (entry.live()) return` branch in `rearm` and the timeline never comes back. Reproduce: play a timeline to its end, `seek(0)`, let a track's `onTick` throw. Expected: a revived timeline is a fresh row (`ended` unset), as a first registration is.
- evidence: read
- severity: high

## The same sampled track nested at two places shares one hold record, so the placements undo each other on the target
- where: packages/animator/src/timeline/trackHolds.ts:65 (place; `held` keyed by track at :53)
- scenario: `const sub = { tracks: [{ kind: 'sampled', target: x, keys: [{t:0,value:0},{t:100,value:1}] }] }` placed twice: `tracks: [{kind:'timeline', at:0, timeline: sub}, {kind:'timeline', at:500, timeline: sub}]`. At root t = 50 the first placement is `inside` and opens a hold showing 0.5; the second, at child time −450, is `before` and calls `h.hold.leave(false)` on the same record, so the target never shows the first placement's move. Between 500 and 600 the first placement is `after` and the second `inside`: every frame the first commits (`leave(true)`) the hold the second just opened and the second opens a new one, a commit plus a fresh hold per frame. The booker explicitly treats one track nested in two places as two runs (booking.ts:73), and firing does too; sampling with a target is the one path keyed by track alone. Expected: each placement holds (or is at least sampled) on its own, or a placement outside its keys does not release another's hold.
- evidence: read
- severity: medium

## `rearm` decides which end a timeline plays toward from its own time scale, while `tick` uses the effective rate including the animator's direction
- where: packages/animator/src/timeline/createTimeline.ts:110 (rearm) vs :66/:73 (tick)
- scenario: `animator.setTimeScale(-1)` turns every animation backward (schedule.ts `rateOf` multiplies by `direction()`), and the timeline's tick sees a negative `scale`, so it ends by rewinding to 0. But `rearm` tests `pos.atEnd(entry.wantScale() < 0)`, the timeline's own scale (1). With the animator backward: `seek(duration)` on a finished timeline is refused (forward `atEnd` is true), though it would play back from there; `seek(0)` on one that rewound to 0 revives it, and the next frame finds it `rewound` at once and calls `onDone` a second time. Expected: rearm declines exactly where the next tick would finish, i.e. judge direction by the effective rate.
- evidence: read
- severity: low

## An `edit` that cuts `duration` below the playhead leaves it there: a backward-playing timeline then ends with `onDone`, or takes forward laps and fires their tails while playing backward
- where: packages/animator/src/timeline/createTimeline.ts:154 (edit → `pos.setDuration`, no clamp) with playhead.ts:46 (lapsCrossed) and :72–73/:84 of createTimeline (tick)
- scenario: a 2000 ms timeline playing at `setTimeScale(-1)` stands at 1500; `edit(() => { opts.duration = 1000 })` (or removing the last keys). `edit` only sets the duration; `time()` keeps reading 1500 > `duration()`, `progress` reads above 1, and `sampleNow` skips the resample the `edit` doc promises (its guard is `time() <= duration()`). Next frame, with no laps left, `advance` leaves t ≈ 1499 ≥ 1000, so `finished` is true: `onDone` runs and the entry retires, though the timeline was playing back toward 0 from inside its new range. With laps left (`loop: true`), `lapsCrossed` takes `floor(1499/1000) = 1` *forward* lap while playing backward, reports a `lap` event, and `crossings.wrapped` (rate ≠ 0, laps > 0) fires the outgoing lap's tail up to `duration` — events firing during backward play, which `EventCursor` says never happens. Expected: `edit` clamps the playhead into the new range (or the lap logic follows the direction of play), so a reversed timeline goes on playing back from the new end.
- evidence: read
- severity: medium

## A handler on the outgoing lap's tail that seeks is not reported as a seek, so the same frame goes on firing from where it landed
- where: packages/animator/src/timeline/crossings.ts:42 (wrapped) and :46 (fire); createTimeline.ts:80
- scenario: `loop: true`; an event at t = 990 of a 1000 ms lap whose `fire` calls `handle.seek(200)`; a frame crosses the seam. `wrapped` runs the tail through `events.to(…, duration)`; the handler's seek places the cursor at 200, open, and `wrapped` computes `sought = true` but only uses it to skip its own `place` — it is not returned to `tick`. `tick` then calls `crossings.fire()`, which runs `events.to(tracks, 200)` from the open cursor at 200 and fires an event at exactly 200 in this same frame with `lateBy` 0, and `tick`'s `sought` is false, so the frame is treated as an ordinary one. The same seek from a handler outside the tail returns `sought = true` from `fire()`, stops the frame's crossings (docs/unruled.md 2026-11-11: a handler that seeks "stops the rest of that frame's crossings"), and leaves the event at 200 for the next advance, as `TimelineHandle.seek` documents. Expected: a seek in the tail ends the frame's crossings the same way.
- evidence: read
- severity: low

## The booker's cursor table keeps an entry for every event track and every nested `at` it has ever seen, pruned only by a seek
- where: packages/animator/src/timeline/booking.ts:92 (`cursors`), :155 (scanTrack's `set`), :83 (pullBack walks them all)
- scenario: an editor drags a nested timeline along the ruler, calling `edit(() => { track.at = x })` on each pointer move of a booked, playing timeline, or rebuilds its event track objects on each edit. Each distinct `at` adds a `Map<number, Cursor>` entry and each replaced `EventTrack` object stays a key of the outer `Map` (strong, not weak), so the table grows with every edit for the life of the timeline; `pullBack` then walks the whole of it on every pause, rate change, loop change and edit. Only `seek` clears it. Expected: cursors for tracks and placements no longer in the timeline are dropped (e.g. rebuilt per scan, or the outer map weak and stale `at`s pruned on edit).
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

<!-- done: 7 findings, files read: 17 -->
