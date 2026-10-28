# @weasel-js/clock

A clock for a run of time: a position (`elapsed`) moved by a signed `rate`,
across one pass or many, with ramps, seeking and an optional mix that follows it.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/clock).

```sh
npm install @weasel-js/clock
```

`createClock` and `createClockRegistry` are the root entry and need no React or
DOM. `useClockLoop`, the one frame loop that syncs a registry's clocks, is in
`@weasel-js/clock/react`.

## Shown time

A clock's shown time is `origin` plus how far it stands into its pass.
`origin` (in `ClockSpec`) is where a pass starts on the timeline. On a looping
clock the shown time is per pass: `shownInPass` reads it, and a time on a pass
boundary reads as the end of the pass before.

`ClockHandle.declare(spec)` takes up a new `duration`, `origin` and `speed`,
and `loop` when the declared `loop` changed since the last declaration, so a
loop toggled since survives an edit that only moves the span. It keeps the pass
and the shown time within it, clamped to the new pass and run.
`ClockHandle.override(span)` replaces the declared `duration` and `origin` until
called with `null`, keeping the shown time the same way; a `declare` under it
changes what lies beneath.

`holdAt(handle, shown)` pauses a clock at a time shown within a pass, placed in
the first pass, and keeps placing it there as the span moves; a time past the
pass's end waits at the end until the span reaches it. Its limit: a foreign
seek to exactly the held, clamped value looks the same as the hold's own, so it
does not release it.

## Visibility

A registry runs one frame loop for all its clocks. `register(id, handle,
target)` may name a target, which resolves the element showing the clock, and
`targets(handle)` lists them. A clock is gated, meaning not advanced, only when
all three hold:

- it is not the registry's shared clock;
- every registration of it gave a visibility target;
- none of those targets is in view.

A gated clock is rebased when it comes back, so it resumes without a jump.
