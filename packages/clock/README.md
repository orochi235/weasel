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

A clock's shown time is `origin + elapsed`. `origin` (in `ClockSpec`) is where
the run starts on the timeline; `elapsed` is how far it has moved since.
`ClockHandle.declare` sets the time a caller wants shown and `override` replaces
it for a while; a time declared onto a pass boundary reads as the end of the
pass before it.

`holdAt` pins a clock at a position. Its limit: a foreign seek to exactly the
held, clamped value looks the same as the hold's own, so it does not release it.

## Visibility

A registry runs one frame loop for all its clocks. A clock is gated, meaning
not advanced, only when all three hold:

- it is not the registry's shared clock;
- every registration of it gave a visibility target;
- none of those targets is in view.

A gated clock is rebased when it comes back, so it resumes without a jump.
