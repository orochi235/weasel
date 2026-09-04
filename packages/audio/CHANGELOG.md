# @weasel-js/audio

## 1.4.0-pre.1

## 1.4.0-pre.0

## 1.3.0

## 2.0.0-pre.0

## 1.2.0

## 1.1.0

### Patch Changes

- 0763205: `AnalyserTap.bands(n, out?)` takes a scratch array and returns the narrowed type

  `bands` is meant for a per-frame render loop but allocated a new `Float32Array`
  on every call. It now accepts an `out` array to fill, like `frequencies` and
  `waveform` do. `out` must be exactly `n` long — a short one would return fewer
  bands than asked for with nothing in the result to say so — and mismatches
  throw.

  The return type is `Float32Array<ArrayBuffer>`, matching the byte readers.
  Assigning the result into a binding typed from `new Float32Array(n)` no longer
  fails to typecheck.

- 83ba8b0: Expose the engine's `AudioContext` as `engine.context`

  `register(buffer)` takes an `AudioBuffer`, and the only way to make one is
  `ctx.createBuffer(...)`. An engine that created its own context — the default —
  never handed it out, so a consumer synthesizing or recording audio had to
  construct the context themselves and pass it as `createAudioEngine({ context })`,
  which also made them responsible for closing it.

  The context is exposed rather than wrapped in a `createBuffer` passthrough:
  procedural audio, analysis and a consumer's own node graph all need the real
  thing, and one wrapper would be the first of several.

  `dispose()` is unchanged — it closes a context the engine created and leaves an
  injected one open — so a reference held past `dispose()` may be a closed
  context. `engine.context.state` says which.

- 90c9d5b: New package: a Web Audio engine for 2D scenes, with no weasel dependencies.

  Loading and decoding with a url cache, voices with handles and `cancelKey`,
  buses with gain/mute/solo, 2D spatialization, and analyser taps including
  `bands(n)` for audio-reactive rendering. This is all new API surface.

  Playback is lookahead-scheduled on the engine's own one-shot timer rather than
  triggered from an animation frame, because `AudioContext.currentTime` is
  hardware-driven, cannot be paused, and `requestAnimationFrame` stops when
  nothing is animating. A hidden tab clamps that timer to a second or more, which
  a 100 ms lookahead cannot cover; the engine drops what came due meanwhile
  instead of firing the backlog on return.

- 0763205: `BusHandle` reads back: `gain()`, `muted()`, `soloed()` and `audible()`

  The handle was write-only, so anything rendering a mixer strip kept a parallel
  copy of every bus's state and hoped it stayed in step with the graph. The
  getters read the live state, so a handle held across a `setGain` reports the new
  value.

  `audible()` is the effective answer — unmuted, and soloed if any bus is soloed —
  because a solo elsewhere silences a bus without muting it, and `muted()` and
  `soloed()` together cannot tell you that. It shares the rule with the graph's
  own recomputation rather than restating it.

- e241f0e: Add `engine.register(buffer)` for playing an `AudioBuffer` the consumer already
  holds — a procedural synth, an `OfflineAudioContext` render, a recording. `load`
  and `decode` both assume encoded bytes; neither covers audio you generated.

  Build the buffer from `engine.context`, which the engine now exposes.
