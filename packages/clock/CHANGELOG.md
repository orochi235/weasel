# @weasel-js/clock

## 2.0.0

### Major Changes

- a66885d: `holdElapsed` is `holdPosition`, since it holds a clock at a recorded `HeldPosition` rather than at an elapsed time alone.
  
  ```ts
  // before
  const hold = holdElapsed(handle, position);
  // after
  const hold = holdPosition(handle, position);
  ```
  
  <!-- entry: breaking api -->
- 4f451f8: A clock's offered speeds are `speeds`, and their default is `CLOCK_SPEEDS`, since they are unsigned and `rate` is signed.
  
  The `ClockSpec` option and the `Clock` field `rates` are `speeds`; the constant `CLOCK_RATES` is `CLOCK_SPEEDS`.
  
  ```ts
  // before
  const { clock } = createClock({ rates: [0.5, 1, 2] });
  clock.rates;
  // after
  const { clock } = createClock({ speeds: [0.5, 1, 2] });
  clock.speeds;
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- b29cf9e: `declaredSpeed(spec)` gives the speed a clock declaration opens at: its `speed`, else its `rate` unsigned, else 1.
  
  <!-- entry: api -->
- 687d98f: A `ramp` that starts a held clock releases its `holdAt` or `holdPosition` hold, as a rate write does.
  
  The new `Clock.ramping` reads whether a ramp is running; `rate` stays where it stood until the next sync.
  
  <!-- entry: fix api -->
- 105a6bf: `ClockRegistry.reflection` lists each id's clock and the target it named.
  
  A second registration under an id still replaces the first, so the reflection reports no shadowing for it. `ClockEntry` is the listed value's type.
  
  <!-- entry: api -->
- c71fb10: A second clock under the same id now shadows the first, and releasing it brings the first back.
  
  It used to replace the first and leave the id empty once released. Every other kit registry already works this way.
  
  <!-- entry: behavior -->

### Patch Changes

- af88833: `declare` with no `speed` defaults it from the declared `rate`, as `createClock` does, rather than from the rate the clock is playing at.
  
  <!-- entry: fix -->
- 6821bac: A clock whose `duration` is written to or from `Infinity` no longer reads as standing at a pass's end that a seek left before.
  
  <!-- entry: fix -->
- 9707f7c: `holdAt`'s `pending()` reads null once the clock stands where the hold put it, for every origin and shown time.
  
  <!-- entry: fix -->
- f88b38b: `holdPosition` at a position recorded from an ended run lands on the shown time it recorded, at the end of the last pass, as `declare` does.
  
  That holds for a position recorded under another `duration` or `origin`.
  
  <!-- entry: fix -->
- b68c9a2: `holdPosition` puts a position recorded under another `duration` or `origin` in the pass the clock reads it in. Rounding no longer lands it a pass later.
  
  <!-- entry: fix -->
- 39f4ad4: `holdPosition`'s `pending()` reports a position past its pass's end as still waiting, as `holdAt`'s does.
  
  It reads null once the span grows to reach the position; one before the pass's start waits the same way.
  
  <!-- entry: fix -->
- b90239c: A clock back in `useClockLoop` from under a registration that shadowed its id no longer jumps by the time it spent shadowed.
  
  Any clock the loop starts syncing counts no time from before it joined.
  
  <!-- entry: fix -->
- 35a99f3: A clock neither wakes its frame loop nor notifies its subscribers for a `rate`, `loop` or `seek` that leaves it where it stands.
  
  A write of the rate it plays at still replaces a running ramp.
  
  <!-- entry: fix -->
- cc3910a: Reset on a `start: 'end'` clock made endless goes to the end of its declared run instead of throwing.
  
  That covers a loop toggle, a `duration` write and an override that make the run endless.
  
  `declare` on such a clock now throws a `RangeError` on a declaration whose run never ends, as `createClock` does for the same spec, and keeps the last declaration.
  
  <!-- entry: fix behavior -->
- Updated dependencies [84028cb]
- Updated dependencies [b6863aa]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [2338cee]
- Updated dependencies [8882b53]
- Updated dependencies [174d6ef]
- Updated dependencies [e6871f1]
- Updated dependencies [85f85ba]
- Updated dependencies [4d31cf0]
- Updated dependencies [af132bc]
- Updated dependencies [2d57c94]
- Updated dependencies [f004638]
- Updated dependencies [3c27e36]
- Updated dependencies [3c27e36]
- Updated dependencies [ce5d609]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [5dd240d]
- Updated dependencies [8b01b26]
- Updated dependencies [2c0f2fe]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [5202a9f]
  - @weasel-js/registry@2.0.0
  - @weasel-js/react@2.0.0

## 1.19.1

### Patch Changes

- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [8562ebe]
- Updated dependencies [2c3416d]
  - @weasel-js/react@1.19.1
  - @weasel-js/registry@1.19.1

## 1.19.0

### Patch Changes

- b1309b2: A `declare` that keeps a clock's origin leaves the time within its pass exactly as it was, so it no longer lets go of a hold. A clock at a pass's end also keeps that pass through a `loop` write where the end does not divide evenly.
  
  <!-- entry: rank=-5 fix -->
- 153719c: Assigning a clock's `duration` keeps it in its pass far into a run, past ten billion passes.
  
  <!-- entry: rank=-5 fix -->
- bce00fd: A clock's `pass` and `phase` agree where it stands when the pass duration does not divide evenly. 50 ms into a run of 0.1 ms passes reads pass 500 at phase 0. A `loop` write or `declare` that leaves the clock at a pass's end keeps it there, and one near a pass's start no longer reads as the previous pass's end.
  
  <!-- entry: fix -->
- 98a8020: A clock at the start of a pass stays there through a `declare` or `override`. Raising `loop` on an ended clock leaves it at the end of the pass it ended in, as a `declare` of the same loop does.
  
  <!-- entry: rank=-5 fix -->
- 6d7aae1: A clock's ramp reaches its target rate exactly when its time is up.
  
  <!-- entry: rank=-5 fix -->
- 326d7be: A `declare` or `override` the clock refuses with a `RangeError` leaves the clock as it was. A declaration's own `duration` and `origin` are checked even while an override stands over them, so it throws at the `declare` rather than when the override is lifted.
  
  <!-- entry: fix -->
- 2740ed4: A clock's `sync` keeps the playhead finite across two frame times further apart than a double holds, such as `-1e308` then `1e308`. An endless run stops at the largest time it can hold, and a looping clock that far out keeps its place through a duration or loop write.
  
  <!-- entry: rank=-5 fix -->
- 2f5f287: `shownInPass` takes the clock itself, and a clock at the start of a pass now shows `origin`.
  
  Replace `shownInPass(origin, elapsed, duration, loop)` with `shownInPass(clock)`. It reads the time within the pass `clock.pass` names, so it agrees with `clock.phase`; forge's playhead readout follows.
  
  <!-- entry: breaking fix -->
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
  - @weasel-js/registry@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- db5276d: Fixes to audio voices and patterns, clock syncing, timeline seeks, tween durations and the node raster host.
  
  - A voice's `gain`, `rate`, `detune`, `pan` and `position`, given to `play`, `playNote`, `playNoise` or `stream` or set on its handle, and the position `setListener` takes, throw a `RangeError` when not finite. Before, a real AudioParam threw after the voice had kept the value, and a worklet voice mixed NaN into its whole bus. This newly throws where a non-finite value used to be accepted.
  - `setListener` throws a `RangeError` on an option that is not finite (`refDistance`, `maxDistance`, `rolloffFactor`, `panWidth`, `right`). Before, it gave every positioned voice a NaN gain or pan.
  - A pattern player's `start` throws on a time that is not finite before it counts itself playing. Before, it threw from the booking and was left reporting `playing()` true with nothing booked, so a later `start` did nothing.
  - A full voice pool whose every voice scores NaN steals one, where it found no victim and threw.
  - A clock's `sync` throws a `RangeError` on a time that is not finite. Before, one such sync left `elapsed` NaN for good.
  - A timeline `seek` before 0 lands on 0, and one past `duration` with no laps left lands on `duration`. Before, `seek(-20)` reported `time()` as -20 and held the playhead at 0 for 20 ms before playing.
  - `animator.tween` throws a `RangeError` on an `ms` that is NaN, for a plain tween and a target tween alike. Before, the tween started and its first frame threw out of the animator's frame, stopping every other animation on every frame after.
  - `animator.stagger` throws a `RangeError` on a delay that is not finite, a numeric `Infinity` included, before any item starts. Before, that item never fired and the stagger never finished. A delay function is now asked for every index before the first item starts.
  - A node raster host whose page or browser has closed opens a new one for its next render, where it failed every render after.
- Updated dependencies [0e5661d]
- Updated dependencies [b188aea]
  - @weasel-js/react@1.18.2
  - @weasel-js/registry@1.18.2

## 1.18.1

### Patch Changes

- @weasel-js/react@1.18.1
  - @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- 6cd51e2: A clock whose `loop` is a fraction, such as 2.5, now counts its passes whole: it ends in pass 2, partway through, rather than reporting pass 1.5, and `shownInPass` places a time past such a run in its last pass.
  `createClock` given a reopened position now throws on a NaN time or rate, and on a negative rate for a clock that is not seekable, as a seek or a rate write does.
  An insert chain's `add` throws once its bus graph is disposed, where it used to accept an effect that was never routed and leave `settled()` waiting forever.
  `createDelayEffect` throws on an opening `time` outside `0..maxTime`, as `setTime` does, instead of letting the node clamp it.
  A pattern player whose `onStep` throws keeps booking steps; before, it went silent while `playing()` still said true.
- Updated dependencies [b4163e6]
- Updated dependencies [b93c1dd]
- Updated dependencies [e3ce292]
  - @weasel-js/react@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/react@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- 3dfa153: Pin `@msb235/blits` at exactly `1.1.0` again, in place of 1.17.1's `^1.0.0`. An app taking blits as a `^1` range still shares this one copy with weasel.
- 4eaadcc: `clock.ramp(to, over)` throws a `RangeError` when `over` is not finite. A ramp over `Infinity` never
  arrived, so the clock never went inert and kept the frame loop running at a rate that never moved;
  `NaN` silently set the rate at once. An `over` of 0 or less still sets the rate at once.
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/react@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- f45b9b5: Take `@msb235/blits` as `^1.0.0` instead of pinning `0.20.0` exactly, so an app on blits 1.x shares one copy with weasel rather than installing a second beside it. blits 1.0.0's one breaking change reserves the shader-patch name `lag`, which weasel does not use.
- @weasel-js/react@1.17.1
  - @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- d28ff77: Depends on `@msb235/blits` 0.20.0, up from 0.18.0. Neither release breaks anything the kit calls. Among their fixes: a seek back over children that a forward seek passed plays them in order again on the next frame, `inert` no longer reads true after a seek back while a staggered subject still has motion to come, so a frame loop sleeping on it wakes, and a child whose rate is written every frame keeps a bounded history instead of one entry per write.
- 9e2e425: A clock given `loop: NaN`, at creation, by `declare`, or by setting `loop`, had a run of NaN ms and reported NaN for `pass` and `phase`. It now throws a `RangeError`.
- 5067c7a: A ramp that carried a clock past the end of its run, or back past its start, and turned its rate the other way within the same frame left `elapsed` outside the run, and the clock played on from there instead of stopping at the end it reached.
- 561550a: `clock.seek(NaN)`, or `seek(Infinity)` on a run that never ends, set `elapsed` to that value and left the clock unable to recover. Both now throw a `RangeError`, as a rate or duration that is no number does.
- Updated dependencies [f7dc7c8]
  - @weasel-js/react@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/react@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [25a1ff7]
  - @weasel-js/registry@1.16.1
  - @weasel-js/react@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/react@1.16.0
  - @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
  - @weasel-js/react@1.15.2
  - @weasel-js/registry@1.15.2

## 1.15.1

### Patch Changes

- 2992b55: Dependency updates: `@msb235/blits` 0.16.1 (core, animator, clock, labkit), `earcut` 3.2.4 (core, geom's peer
  range, labkit), `react-aria` 3.53.1 and `react-aria-components` 1.22.1 (ui), and `magic-string` 1.4.5, `oxc-parser`
  0.156.0 and `unplugin` 3.7.0 (icons-plugin). geom's `earcut` peer is an exact pin, so a consumer installing geom
  beside its own `earcut` needs 3.2.4.
- @weasel-js/react@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2
  - @weasel-js/react@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- 9912c13: Loading a snapshot of a clock with a finite loop count (`loop: n`) brings it back in the pass it was saved in, with its `ended` and time left, where it used to land in the first pass at the saved time within the pass. A trial clock reopened at a position its first run cannot reach yet waits in that pass too. `holdElapsed(handle, position)` in `@weasel-js/clock` holds a clock at a recorded `HeldPosition` across the whole run the way `holdAt` holds a time within a pass, re-placing it as the span changes; a position recorded under another `duration` or `origin` keeps its pass and the time it showed within it. This adds API.
  
  A snapshot whose config turns a trial's clock back on opens the new clock at the snapshot's position. A lab lets go of a trial's snapshot hold when the trial closes.
  
  A trial's clock is made in a layout effect rather than during render, so under StrictMode a `ClockSpec.mix` factory runs once per clock. The clock is there by the first paint, but not in the trial's first render; in that render the trial's clock resolves to none, never to the focused trial's or the lab's.
  
  `useClockLoop` reads the registry's clocks and targets when the registry changes, not on every frame.
  
  `useTrialClock`, `useTrialClockHandle`, `useTrialMix`, `useClockFrame` and `useTransportControl` take a `trialId` of `null`, which resolves no clock and subscribes to none. forge's `useTimeline` uses it so a story with a clock of its own, such as one on an index page inside a lab, no longer re-renders on every frame of the focused trial.
- 3d36f5e: New package `@weasel-js/clock`: labkit's trial clock, moved out so it has no React and no DOM. `createClock`, `clockPosition`, `ClockSpec`, `Clock`, `ClockHandle`, `ClockPosition`, `ClockedMix`, `CLOCK_RATES`, and `createClockRegistry`, whose `lab` field is now `shared`; the frame loop `useClockLoop` is in `@weasel-js/clock/react`. labkit keeps `ClockCapability`, `TrialClock`, `ClockPosition` and `ClockedMix` as aliases, and `TRANSPORT_RATES` in ui is `CLOCK_RATES`.
  
  `ClockSpec` takes `origin`, the time `elapsed` 0 is shown as (display only), and `speed`, the unsigned speed a transport plays a paused clock at. `Clock` reads both back. `ClockHandle.declare(spec)` takes up a new `duration`, `origin` and `speed`, and `loop` only when the declared `loop` changed, keeping the pass and the time shown within it, clamped to the new run. Writing `Clock.loop` so the run ends before `elapsed` keeps the time within the pass. `shownInPass` reads a looping clock's time within its pass. This adds API.
  
  `holdAt(handle, shown)` returns a `PlayheadHold`: it pauses the clock at a time shown within a pass and keeps it there as the span moves, waiting at the pass's end for a time the span cannot reach yet. `createClockRegistry`'s `register(id, handle, target)` takes a `ClockTarget` resolving the element showing a clock, and `targets(handle)` lists them; the frame loop stops advancing a clock, other than the shared one, while every target of it is out of the viewport, and rebases it when one comes back.
  
  The ui `Transport` takes `start`, where its scrub bar begins, so it can show a playhead before zero. labkit exports `useTransportControl` and `TransportControl`; `TransportControl` gains `start`, `touched` and `touch`, its `playhead` and `seek` work in shown time, and the keyboard Home and End and `labkit:seek` follow.
  
  labkit exports `useTrialClockHandle`, the resolver behind `useTrialClock`. A snapshot records where the trial's clock stands when it is saved, playing or never moved included, and loading it holds the clock at that time.
  
  `ClockHandle.override(span)` replaces the declared `duration` and `origin` until called with `null`, and a later `declare` leaves it in place. `ClockPosition` records `origin` when it differs from the declared one, `createClock` reopens at it, and a reopened trial clock comes back at the time it showed. `holdAt`, `declare` and `override` place a time on a pass boundary at the end of the pass before.
  
  forge's story timelines run on the shared clock. A story's `timeline` declares its trial's labkit clock, so the trial's transport is labkit's `TrialTransport` (its scrub bar is named "Position"), it shows a lead-in below zero, and the paused playhead is kept in the trial's record rather than in a `$playhead` config key. A config saved with `$playhead` still opens, without the key reaching the story. `usePlayhead`, `useTimeline` and the `TimelineSpec`, `TimelineSpan` and `SpanOverride` types keep their shape. The URL's `t` and a capture's playhead are the time shown within the pass. Changes in behavior: a span set at runtime keeps the playhead's shown time rather than following the span's start, and a story left playing reopens playing, where it used to reopen paused. A timeline with a duration or rate that is not a positive number runs as 1 ms or at speed 1 instead of throwing.
- Updated dependencies [34a364e]
- Updated dependencies [4f68c3a]
  - @weasel-js/react@1.14.0
  - @weasel-js/registry@1.14.0
