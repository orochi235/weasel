# Audit round 33 — animator.timeline (blind reviewer)

## A booked timeline of infinite duration books every event at once, at clock time NaN
- where: packages/animator/src/timeline/booking.ts:119 (createBooker → scanTrack), also :89 (unwrapped)
- scenario: `animator.timeline({ duration: Infinity, booking: { clock }, tracks: [{ kind: 'event', events: [{ t: 10_000, book }] }] })`. In the current lap `c.lap - lap` is 0, and `0 * Infinity` is `NaN`, so `lapStart` and `u` are `NaN`; `lapStart > horizon` and `u > horizon` are both false, so the lookahead never stops the scan, and `whenFor` returns `Math.max(NaN, now)` = `NaN`. Every event on the track is booked on the first frame with `when = NaN`, instead of up to `lookahead` ahead at a real clock time. `unwrapped` gives `NaN` the same way, so a rate change's retime check (`Math.abs(NaN - b.when) > RETIME_MS`) never retimes. An infinite duration is an accepted input (`lengthOf(Infinity)` is `Infinity`, and `seek` handles it, eb8743c460).
- evidence: read
- severity: medium

## The booker keeps one cursor and one dedup per event-track object, so a track reused at two offsets books once per lap while it fires twice
- where: packages/animator/src/timeline/booking.ts:117,135,147 (scanTrack)
- scenario: `tracks: [events, { kind: 'timeline', at: 50, timeline: { tracks: [events] } }]` with a `booking` (the shape watch.test.tsx:282 uses for firing). `cursors` is keyed by the `EventTrack` object, so the nested placement starts from the root placement's cursor (a root time measured against `at: 0`), and `bookings.some((b) => b.event === ev && b.lap === c.lap)` refuses the second placement's booking of the same event in the same lap. `fireEvents` walks each placement separately and fires the event at t and at t + 50; the booker books it only once. A cursor and a dedup keyed by placement (track plus its root offset, or the path) would book both.
- evidence: read
- severity: medium

## A nested timeline's negative duration is 0 when firing but stays negative when sampling and booking
- where: packages/animator/src/timeline/trackHolds.ts:96 (visit); packages/animator/src/timeline/booking.ts:70-71 (endWithin)
- scenario: a child `{ kind: 'timeline', at: 0, timeline: { duration: -10, tracks: [sampled key at 0 with a target, event at 0] } }`. `fireEvents` (fireEvents.ts:87) and `tracksEnd` read the child's end through `lengthOf`, so it is 0: the event at 0 fires. The sampler clamps to the raw `-10`, so the child's sampled track is sampled at -10, before its first key, and its target is let go (`leave(false)`) instead of held at the key; the booker's `endWithin` gives `from - 10`, so the event at 0 is never booked. One decision (a negative duration plays as none — 857c097fcd) answered three ways; both sites should go through `lengthOf`.
- evidence: read
- severity: low

## Played backward onto exactly 0 with laps behind it, a looping timeline ends instead of going on into the lap before
- where: packages/animator/src/timeline/createTimeline.ts:96,168 (crossLaps, tick)
- scenario: `loop: 3`, played forward into lap 1, then `setTimeScale(-1)`; a frame lands the playhead on exactly 0 (frame steps that divide the lap position, e.g. after `seek` to a multiple of the frame time). `crossLaps` counts back-laps only for `playhead < 0`, so none is taken, and `rewound` (`rate < 0 && playhead <= 0`) finishes the timeline at lap 1: `onDone` fires and the entry retires. A frame that lands one ms further (-1) instead wraps to lap 0 at `duration - 1` and plays on. Going forward the seam is handled the other way: a playhead exactly at `duration` with laps left wraps (`playhead >= duration`). Whether the timeline ends depends on where a frame happened to land.
- evidence: read
- severity: low

## toClip writes a non-finite time, duration, offset, weight or bezier point that bindClip then refuses
- where: packages/animator/src/timeline/clip.ts:200,203,211,226 (sampledToClip, trackToClip, timelineToClip); refused at packages/animator/src/timeline/clipShape.ts:42,61,71,35,29
- scenario: `toClip({ duration: Infinity, tracks })` (an infinite duration is one `animator.timeline` plays and `seek` handles), or a key at `t: Infinity`, a `weight: NaN`, a track `at: Infinity`, a key easing `{ bezier: [0, NaN, 1, 1] }`. `toClip` checks only key values and event data with `isClipValue`, which refuses non-finite numbers; it copies `t`, `duration`, `at`, a numeric `weight` and bezier points as they are. `JSON.stringify` writes each as `null`, and `bindClip` on the parsed clip throws ("'s duration is not a number", "'s t is not a number", …). `toClip`'s doc promises it throws, naming the track, on "a value JSON would not read back"; here it returns a clip that does not round-trip.
- evidence: read
- severity: low

## bindClip accepts a key with no value, and the track fails only when sampled
- where: packages/animator/src/timeline/clipShape.ts:39-44 (sampled); packages/animator/src/timeline/clip.ts:117 (bindTrack)
- scenario: a parsed clip key `{ "t": 50 }` (value missing, or a key whose value was `undefined` and so left out by `JSON.stringify`). `checkClip` checks a key's `t` and `easing` but not that `value` is present, so `bindClip` returns a track whose key value is `undefined`. Sampling that key returns `undefined`, which `trackHolds.visit` takes for "no value" and skips; between keys `axesOf(keys[0].value)` is null, so `sampleTrack` throws "interpolate or interpolator is required for non-numeric keyframe values" on the first frame that lands between them, far from the clip. `bindClip`'s doc says it throws on a clip with a field of the wrong type, naming it.
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

<!-- done: 6 findings, files read: 12 -->
