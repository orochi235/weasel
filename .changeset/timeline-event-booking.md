---
"@weasel-js/core": patch
---

A timeline can now book its events ahead of the frame against an outside clock,
so a sound lands at its true sub-frame time rather than on whichever frame
noticed the crossing. Pass `booking: { clock }` to `animator.timeline()` and give
an event a `book(when)` handler; `clock` is anything with `now()` in ms, and an
`AudioEngine` from `@weasel-js/audio` is one:

```ts
animator.timeline({
  booking: { clock: engine },
  tracks: [{ kind: 'event', events: [{ t: 500, book: (when) => engine.play(hit, { when }) }] }],
});
```

Each event is booked once per crossing, up to `lookahead` clock ms before its
edge (default 100). Returning a handle with `stop()` — a `VoiceHandle` is one —
lets a pause, seek, time-scale change, loop change, `edit` or cancel retract the
booking while the clock has not reached it; playback books it again wherever it
next reaches the event. A seek never books the span it skips. An event first
reached after its edge books at `clock.now()`, or is skipped once it is later
than `maxLate`. The frame clock's mapping onto the booking clock is smoothed per
frame, so per-frame read jitter does not reach `when`, and resynced when the two
jump apart.

`TimelineEvent.fire` is now optional, since an event may only book. Reading
`event.fire` directly needs a check for `undefined`.
