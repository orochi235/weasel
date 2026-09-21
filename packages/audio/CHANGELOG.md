# @weasel-js/audio

## 1.5.2

## 1.5.1

## 1.5.0

### Patch Changes

- 8f1a07a: `engine.play()` no longer waits for the scheduler's next pass when the voice's
  `when` is already inside the lookahead window. The voice is booked at the end of
  the task that called `play()`, so `when: engine.now()`, or no `when` at all,
  starts on time instead of up to one pass interval (25 ms by default) late.
  
  Everything played in the same task is booked together, in `when` order, the way
  a pass books it, so which voice a full bus steals does not change. A voice
  stopped in that same task never starts. `createScheduler` does the same for any
  event scheduled inside its window while it is running.
  
  A `play()` made after the context resumes from a suspension, with a `when`
  already in the past, now plays at once. It used to be dropped as though it had
  come due while the context was suspended.
- 5bdb451: The audio engine's scheduler pass is now woken from a timer inside a dedicated
  Worker rather than a main-thread `setTimeout`. A hidden tab clamps main-thread
  timers to at least a second, which a 100 ms lookahead cannot cover, so sounds
  booked while the tab was away arrived late.
  
  `createTickTimer()` is the new wake source, exported beside `createScheduler` for
  anyone driving a scheduler without an engine. It keeps the scheduler's one-shot
  `setTimer`/`clearTimer` contract: each delay is booked in the worker, which posts
  the timer's id back when it elapses. A `MessageChannel` was not enough on its
  own, because it has no delay and could only busy-spin.
  
  The worker is built from an inline `blob:` script, not a separate file, because
  `new Worker(new URL(..., import.meta.url))` survives some consumer bundlers and
  not others (esbuild leaves the file behind). The cost is CSP: a page whose policy
  refuses `blob:` workers gets a fallback to `setTimeout`, as does any environment
  without `Worker`, such as SSR or a test runner. Injecting `setTimer`/`clearTimer`
  into `createAudioEngine` still replaces the default entirely.
- f8ed44d: The audio engine now reuses each voice's `GainNode` and `StereoPannerNode`
  instead of building a new pair on every `play()`. Only the
  `AudioBufferSourceNode` is still created per play, because a source can only be
  started once.
  
  In headless Chromium this took the engine from 37.17 to 26.14 µs per `play()`
  with 32 voices and 8 plays a frame, and from 30.58 to 18.71 µs at 32 plays a
  frame. `tests/perf/audio-voice-chain.mjs` reproduces these numbers: run it with
  `--base <ref>` to compare two revisions. How long the audio thread takes to
  render is unchanged.
  
  A pair that isn't in use is disconnected from its bus. Left connected, 96 idle
  pairs took the audio thread 166 ms to render 20 s of silence, where the same
  graph without them took 20 ms. The engine keeps at most `voiceLimit` idle pairs
  per bus, and creates new ones beyond that.
  
  A handle whose voice has ended no longer changes anything. Calling `setGain`,
  `setPan`, `setPosition` or `stop(fadeMs)` on it used to write to that voice's
  own disconnected nodes, which had no audible effect. Those nodes can now belong
  to another voice, so the calls are ignored instead.

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.0

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
