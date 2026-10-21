# @weasel-js/audio

## 1.11.1

### Patch Changes

- ca1f524: Add a patchable audio graph: `engine.graph(bus)` returns nodes that can be added, removed, replaced, connected and re-parameterized while it plays, every edit crossfaded. New source nodes play a looping file, an oscillator or noise; gain, pan, mix, filter, delay, reverb and compressor nodes process. `impulseResponse(ctx, seconds)` generates a decaying-noise impulse, which a reverb node uses when it is given `seconds` rather than an `impulse`. `tap(id)` puts an analyser on any node. `createAnalyserTap` now accepts any `BaseAudioContext`.

## 1.11.0

### Patch Changes

- 40a817d: A `synthVoices: 'worklet'` voice that the audio thread has started while a main-thread stall kept the scheduler from reaching it now releases on `release()` and fades on `stop(fadeMs)`, where it used to be cut at once. It reports `onDone` when it ends, not `onDrop('stopped')`, because it sounded. `stopKey` treats such a voice the same way.
- 082f0a8: `createAudioEngine` takes `synthVoices: 'worklet'`, which renders `playNote` and `playNoise` voices in an `AudioWorkletProcessor` from events posted when they are played, rather than building nodes when the scheduler fires. A voice played ahead of a main-thread stall then starts on time. Its handle, bus pool, stealing, pan and position behave as a node voice's do. The processor loads from a `blob:` URL, so a CSP has to allow `script-src blob:`; `unlock()` waits for it to load, and until it has, or where it cannot, synth voices play on nodes. The default, `'nodes'`, is unchanged, and an engine that never asks for the worklet does not load its source. `onLate` no longer reports a worklet voice, which was not late, and `Scheduler.schedule` takes `{ reportLate: false }` for any callback like it.

## 1.10.1

### Patch Changes

- 437820c: Synth voices as samples, with no `AudioContext`. `renderNote` and `renderNoise` return a whole `playNote` or `playNoise` voice as a `Float32Array`, through its release, to put in an `AudioBuffer` and `register`. `createNoteKernel` and `createNoiseKernel` render the same voice a block at a time, with `release()` and `retune()`, for use inside an `AudioWorkletProcessor`. They cover every wave, inharmonic partials, glide, the envelope, and the voice filter with its cutoff envelope; a square, sawtooth, or triangle is band-limited, and a harmonic past Nyquist is left out. `biquadCoefficients` and `biquadResponseDb` are the filter math under them: a `BiquadFilterNode`'s coefficients by the Web Audio formulas, and what they pass at a frequency. Additive.

## 1.10.0

### Patch Changes

- 6ceb6b2: Adds API, on an agent's judgment: `onLate(lateMs, when)` on `createAudioEngine` and `createScheduler`. It is called for each voice or scheduled callback that came due after its time because the main thread stalled for longer than the lookahead, with how late it was, in ms on the audio clock. An event booked inside the lookahead, or for a time already past, is not reported: no pass was meant to catch it.
- c461587: Adds API: generative scoring from a mood, designed on an agent's judgment and checked only against a fake audio context. Nobody has listened to it yet.
  
  - `createScore(engine, { mood, tonic?, bus?, gain?, seed?, onBar? })` plays music written a bar at a time from a `ScoreMood`: `valence` (-1 to 1), `tension` and `urgency` (0 to 1). `setMood` lands on the next bar line, tempo included. `state()` and `onBar` report the cue in force, each cue's share of the mood, and every parameter the bar was written from, so a consumer can show what is being applied.
  - `scoreParams(mood)` resolves a mood to `ScoreParams`. Each parameter follows one axis: valence sets the mode, register and spread; tension the harmony and layer count; urgency the tempo, pulse density, articulation, harmonic rhythm and attack.
  - `scoreCues` lists the four named devices (`dread`, `investigation`, `wonder`, `urgency`) with the mood that produces each and a sentence on what it does; `readScoreCue(mood)` names the nearest and weighs the rest.
  - `scoreChord` and `scoreBar` write a chord as MIDI notes and a bar as pattern events, for a `createPatternPlayer` of `SCORE_BAR_STEPS` steps. `scoreModes` holds the scales.
- fe70fd8: Fixes: a pattern event on a fractional `step` never played, because the player looked events up by whole step. It is booked with the step it sits in and sounds that fraction of a step later, so `{ step: 2.25 }` is a hit that drags a quarter of a step, and the default pattern length counts it by the step it sits in.
  
  Adds API, on an agent's judgment:
  
  - `PatternPlayerOptions.detune` and `PatternPlayer.setDetune`: cents added to every event's own `detune`, as a number or a function of the event's step (`PatternDetune`), for a loop that drifts in pitch. A new value takes effect from the next step not yet booked.
  - `patternVoicePeaks(events, opts)`: the most voices a pattern holds at once on each bus, to set against `voiceLimit`. It counts a note through its gate and release, a voice from one lookahead before it sounds (when the engine takes its slot), and a loop's tail against the start of the next pass.
  - `patternLength(events, stepsPerBeat?)`: the length a player gives a pattern that names none.
- ebc8afa: Fixes: a pattern player driven from its own `onStep` ran two sequences at once. `setTempo` called there booked a next step, and the step that was firing then booked another, so every later step played twice, once at each tempo. `stop` called there left one booking behind, which a later `start` picked up as a second sequence. A tempo set from inside `onStep` now starts with the step after the one reported, which keeps the length its events were gated by, and a step stopped from inside `onStep` books nothing.

## 1.9.4

### Patch Changes

- b21f2fd: A voice whose node threw as it started, such as `engine.play(sound, { when: -1 })` or `engine.stream(el)` on an element another engine already routed, kept its pool slot and its place on the bus for the life of the engine: `activeVoices()` counted it and `handle.isPlaying()` stayed `true`. The voice is now torn down before the error is reported.
- 0025718: An insert effect added and then removed while another slot's crossfade was still running, as `inserts.add(a); inserts.add(b); inserts.clear()` does in one task, never had its `dispose()` called. It is now disposed on removal. `inserts.settled()` also resolves when the engine is disposed mid-crossfade instead of staying pending.
- 9ac30e3: `onDone` is now documented as what it is: a voice's source ended. A voice that never played reports through a new `onDrop(reason)` option on `play`, `playNote`, `playNoise`, and `stream`, raised when the context is locked, the engine is disposed, the voice is stopped before it comes due, its sound is not loaded, its node fails to start, or it came due during a suspension. `VoiceDropReason` is exported.
- 6c98963: A voice played with `position` kept its full level through `handle.stop(fadeMs)` and then cut off with a click whenever `engine.setListener` or `handle.setPosition` ran during the fade, as it does every frame in a game that follows a camera. The fade now survives those calls, and so does a `handle.setGain(value, rampMs)` ramp, which carries on to the same end time at the new distance's level. `setGain` during a fade-out no longer cancels the fade either.
- 1ffc451: `createAudioEngine`'s automatic unlock listened once for `pointerdown`, `keydown`, and `touchstart`. On a touch screen a tap grants audio at `pointerup`, `touchend`, and `click`, so the first tap used up the listeners without starting the context and every later `play()` was dropped. The engine now listens for `pointerdown`, `pointerup`, `touchend`, `click`, and `keydown`, and keeps listening until the context is running.
- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

No changes in this release.

## 1.8.0

### Patch Changes

- 17bc769: `createAudioEngine` takes a `random` option, the uniform source that picks where in its loop a noise voice starts (default `Math.random`). `renderEngine` from `@weasel-js/audio/testing/renderEngine` passes engine options through, so an offline render of noise voices can be made repeatable.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- 7987ce7: Insert effects and streaming sources, both additive.
  
  Every bus has an ordered insert chain, `engine.bus(name).inserts`, between where its voices connect and its fader. `inserts.add(effect, { index, bypassed })` returns a slot with `bypass(on)`, `moveTo(index)`, `remove()` and `index()`; `slots()`, `clear()` and `settled()` cover the chain. Every edit is click-free: a bypass crossfades the slot's wet and dry, and an add, remove or move crossfades the old route into the new one, one splice at a time (`insertFadeMs`, default 15). An effect is anything with `input` and `output` nodes, so a consumer's own node pair works as well as the built-ins: `createFilterEffect` (biquad), `createReverbEffect` (convolution from an impulse buffer, with a wet/dry mix), `createDelayEffect` (feedback delay with a mix) and `createCompressorEffect` (with makeup gain).
  
  `engine.stream(elementOrUrl, opts)` plays long audio through a `MediaElementAudioSourceNode` instead of decoding it whole. It returns an ordinary `VoiceHandle` on a bus — `stop(fadeMs)`, `cancelKey`, gain, pan, position and `rate` all apply — but it takes no `when` (a media element's start is not sample-accurate) and no `detune`.
  
  `createBusGraph` gains `input(name)`, the node voices now connect to, and `dispose()`. `node(name)` is still the bus fader, now after the inserts.
- f8c3aa2: Noise and inharmonic synth voices, all additive. `engine.playNoise({ noise: 'white' | 'pink' | 'brown', duration, envelope, filter, ...playOptions })` plays noise looped from a seeded buffer made once per color per context, under the same ADSR envelope as `playNote`, and returns an ordinary `VoiceHandle` sharing the bus's voice pool, stealing and `cancelKey`. `playNote`'s `wave` also takes `{ partials: [{ ratio, gain, decay }] }`: sine oscillators at any ratio of the pitch, each with its own level and exponential decay, for bells, bars and struck metal. `partialPresets` holds `bell`, `marimba` and `metal`.
  
  Both voices take a `filter`: a biquad ahead of the envelope, with `type`, `frequency`, `Q`, `gain`, and an optional cutoff `envelope` whose level moves the cutoff by `amount` Hz. Pattern players accept noise events (`{ step, noise, length, … }`). Also exported: `noiseSamples`, and the types `NoiseOptions`, `NoisePatch`, `NoiseColor`, `Inharmonic`, `SynthPartial`, `VoiceFilter` and `PatternNoise`.
- 81eadc7: Synth voices and a pattern player, both additive. `engine.playNote({ pitch, duration, wave, envelope, glide, ...playOptions })` plays an `OscillatorNode` under an ADSR envelope, with pitch as hertz, a note name or `{ midi }` and `wave` as a built-in shape or harmonic partial amplitudes (built into a cached `PeriodicWave`). It returns an ordinary `VoiceHandle` and shares the bus's voice pool, stealing and `cancelKey` with buffer voices. `VoiceHandle` gains `release()`: a note-off that runs the envelope's release from its current level, and is `stop()` for a buffer voice. `engine.schedule(when, fire, key?)` exposes the lookahead scheduler for booking callbacks against the audio clock.
  
  `createPatternPlayer(engine, { tempo, stepsPerBeat, events, length, loop, onStep })` is a step sequencer over notes and buffer hits, booking each step through `engine.schedule` so `setTempo` and `setEvents` land on the next step; a step that fires late skips ahead in phase rather than playing the missed steps at once. Also exported: `toFrequency`, `midiToFrequency`, `noteToMidi`, and the pure envelope helpers `resolveEnvelope`, `envelopeLevel` and `envelopePoints`.

## 1.7.0

No changes in this release.

## 1.6.1

No changes in this release.

## 1.6.0

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
