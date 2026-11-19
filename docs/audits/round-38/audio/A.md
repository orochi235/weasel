# Audit round 38 — area `audio`

## A synth voice's duration, envelope, glide and filter numbers are never checked, so the worklet path mixes NaN into the bus forever where the node path drops the voice
- where: packages/audio/src/worklet/workletVoices.ts:126 (note/noise), packages/audio/src/voiceKernel.ts:80 (createKernel), packages/audio/src/voices.ts:212 (checkVoice), packages/audio/src/synthStarters.ts:22 (synthStart)
- scenario: `engine.playNote({ pitch: 'A4', duration: NaN })` (or `envelope: { attack: NaN }`, `filter: { frequency: NaN }`, `glide: { to: 'C5', ms: NaN }`) with `synthVoices: 'worklet'`. `checkVoice` checks only when/gain/rate/detune/pan/position and `resolveNote` only pitch and partials, so the patch is posted as is. In the kernel `gate` is NaN: `t >= gate + env.release` is never true, so the voice never ends, and `envelopeLevel(env, t, NaN)` is NaN, so every block adds NaN into the bus's stereo output (and into any insert's filter state downstream) until `stop()`. On the node path the same call throws inside `start` (`stop(NaN)` / `setValueAtTime(NaN)`) and is dropped with `'failed'`. `duration: Infinity` likewise is a held note in the worklet and a `'failed'` drop on nodes. `resolveEnvelope` passes NaN through (`Math.max(0, NaN)` is NaN). The kit already states the rule (`checkFinite`'s doc: "the voice processor would mix it into its whole bus as NaN") but does not apply it to these fields. Should: throw a RangeError at the call, as for pitch and partials.
- evidence: read
- severity: medium

## A partial's non-finite gain passes `resolvePartials` and makes every partial NaN
- where: packages/audio/src/synthVoice.ts:94 (resolvePartials)
- scenario: `wave: { partials: [{ ratio: 1, gain: NaN }, { ratio: 2 }] }`. Ratio and decay are checked, gain is not: `total` becomes NaN and every normalized gain is `x / NaN`. The node path throws at start (`level.gain.setValueAtTime(NaN)`) and drops the voice `'failed'`; the worklet kernel sums NaN into the bus for the note's whole life. The doc promises "Throws on a bad pitch or partial, at the call". Should: RangeError on a non-finite partial gain.
- evidence: read
- severity: low

## `settled()` on an insert chain disposed mid-crossfade never resolves
- where: packages/audio/src/insertPump.ts:63 (stop) and :59 (settled)
- scenario: a bus's chain is fading an edit (`bus('sfx').inserts.add(fx)` on a running context, `busy = true`), and `engine.dispose()` runs `graph.dispose()` → `stop()` cancels the fade timer but leaves `busy` true, then `release()` resolves the waiters already queued. Any `inserts.settled()` called after that — e.g. a teardown that awaits the chain — sees `busy` still true, pushes a waiter, and nothing will ever call `release()` again: the promise hangs. Should: `stop()` clear `busy`, or `settled()` resolve at once once stopped.
- evidence: read
- severity: low

## A pattern event that `play`/`playNote` refuses kills the player silently while `isPlaying()` stays true
- where: packages/audio/src/patternPlayer.ts:159 (fire)
- scenario: `createPatternPlayer(engine, { tempo: 120, events: [{ step: 0, pitch: 'C4', bus: 'drums' }] })` on an engine without a `drums` bus (or an event with `gain: NaN`, a bad pitch, `step: NaN`). `fire` calls `engine.playNote`, whose `launch` throws (`requireSlots`: unknown bus; `checkVoice`: RangeError) out of the event loop. The throw leaves `fire` before the `finally` that books the next step (that `try` covers only `onStep`), so: the remaining events of that step are skipped, no further step is ever booked, and `running` stays true. The scheduler only logs "callback threw". The player is silent forever and `isPlaying()` says it is playing — exactly the state the `finally` comment at :182 says it exists to prevent for `onStep`. `start()` is then a no-op too, since `running` is true; only `stop()` recovers. Should: book the next step whatever an event throws (or check events in `setEvents`).
- evidence: read
- severity: medium

## `setRate(0)` (or a negative rate) on a node note throws, and keeps throwing on every later `setDetune`; a buffer voice and a worklet note take it
- where: packages/audio/src/synthStarters.ts:119 (note retune)
- scenario: `const v = engine.playNote({ pitch: 'A4' }); v.setRate(0)`. `checkFinite` passes 0 (and -1), the handle stores `voice.rate = 0`, then `retune` writes `osc.detune.value = detune + 1200 * Math.log2(0)` = -Infinity (NaN for a negative rate), which an AudioParam's `value` setter refuses with a TypeError. The rate stays stored, so every later `setDetune(c)` recomputes the same -Infinity and throws too. The same call on a `play()` voice sets `playbackRate` 0 (legal), on a noise voice likewise, and on a `synthVoices: 'worklet'` note `tuning(0, d)` is 0 and the voice holds still: three answers to one input. Should: refuse a rate that is not positive for a note at the check, or map it the way the kernel does.
- evidence: read
- severity: low

## A non-finite `lookahead`, `tickInterval` or `insertFadeMs` is taken unchecked; a NaN lookahead silences the engine with no error
- where: packages/audio/src/scheduler.ts:64 (createScheduler), packages/audio/src/inserts.ts:86 (createInsertChain), packages/audio/src/createAudioEngine.ts:186 (engineClock)
- scenario: `createAudioEngine({ lookahead: NaN })` (e.g. from a config field that parsed badly). In `fireDue` `entry.when <= now + NaN` is never true, so no voice, `schedule` callback or pattern step ever fires; nothing throws or warns. `tickInterval: Infinity` reaches the timer as `setTimeout(pass, Infinity)` (the tick timer's fallback path and the worker's own `setTimeout` alike), which fires at once, so the scheduler re-arms every turn and spins. `insertFadeMs: NaN` makes `fade()` NaN, so `spliceIn` builds both links and splices the slot into `live`, then `writeParam(..., NaN)` throws out of `inserts.add` with the route half-switched (old link still at 1, new at 0, slot counted as live). The ruling that non-finite audio input throws a `RangeError` (docs/unruled.md, "Non-finite input to audio …") is not applied to these options. Should: RangeError at `createAudioEngine` / `createScheduler` / `createInsertChain`.
- evidence: read
- severity: low

## `setMood` with a NaN axis is accepted, then throws at every bar line, freezing the score on its last bar
- where: packages/audio/src/scoreMood.ts:75 (readScoreCue), packages/audio/src/score.ts:113 (setMood)
- scenario: `score.setMood({ valence: NaN, tension: 0.5, urgency: 0.5 })` (a mood computed from a 0/0). `clamp` passes NaN through, every distance and raw weight is NaN, `raw.indexOf(Math.max(...raw))` is -1, and `SCORE_CUES[-1].name` throws a TypeError. `setMood` itself only stores the mood, so the throw comes later, from `onStep` on the bar's last step, before `write(next)`: the pattern player's `finally` keeps booking, so the score loops the previous bar forever and logs the throw once a bar. `createScore` with such a mood throws the TypeError at construction. The doc says out-of-range values are read as their nearest end; NaN gets neither that nor the package's RangeError for non-finite input. Should: RangeError in `setMood`/`createScore` (or in `inRange`).
- evidence: read
- severity: low

## A worklet noise voice given a negative rate reads before its loop and mixes NaN into the bus
- where: packages/audio/src/voiceKernel.ts:166 (createNoiseKernel's source)
- scenario: `engine.playNoise({ noise: 'white', rate: -1 })` with `synthVoices: 'worklet'` loaded, or `setRate(-1)` on such a voice (`checkFinite` accepts any finite rate). The kernel steps `at = (at + tune) % loop.length`; with `tune < 0`, `%` keeps the sign, so `at` goes negative within a sample or two, `loop[Math.floor(at)]` is `undefined`, and `lerp(undefined, …)` is NaN — every following sample the voice adds to the bus processor's output is NaN until it ends. On the node path the same voice is an `AudioBufferSourceNode` with a negative `playbackRate`, which plays the loop backwards. Should: wrap `at` into `[0, length)` (`((at + tune) % len + len) % len`), or refuse a negative rate on both paths.
- evidence: read
- severity: medium

## A wave name outside the four built-ins is looked up through the prototype chain, and in the worklet it kills the whole bus's processor
- where: packages/audio/src/oscillator.ts:80 (waveShape), reached from packages/audio/src/voiceKernel.ts:120 (createNoteKernel) inside packages/audio/src/worklet/voiceMixer.ts:54
- scenario: `engine.playNote({ pitch: 'A4', wave: 'Sine' })` or `wave: 'custom'` from an untyped caller or a stored patch (nothing checks `wave` at the call: `resolveNote` only resolves inharmonic partials), with `synthVoices: 'worklet'`. `BUILT_IN['Sine']` is `undefined`, so the kernel is built without complaint and the first `render` calls `undefined(...)`: a TypeError out of `process()`, which takes the `AudioWorkletProcessor` into its error state for good. Every voice on that bus, playing or later booked, is then silent, and since the processor never posts `ended` again, each holds its pool slot and `isPlaying()` stays true until stolen. `wave: 'toString'` instead finds `Object.prototype.toString`, whose string result makes the voice NaN. The node path answers differently again: `osc.type = 'Sine'` is ignored (a sine plays), `osc.type = 'custom'` throws and the voice drops `'failed'`. Should: check `wave` against the four names with an own-key lookup and throw a RangeError at the call, on both paths.
- evidence: read
- severity: high

## The per-context `PeriodicWave` cache has no bound: every distinct harmonic level array is kept for the context's life
- where: packages/audio/src/periodicWave.ts:9 (periodicWave)
- scenario: a consumer morphing a timbre plays `playNote({ pitch, wave: [1, brightness, brightness ** 2] })` with `brightness` from a slider or an LFO. Each distinct array is a new key (`partials.join(',')`), so each note adds a `PeriodicWave` (two Float32 tables in the browser, 4096+ entries each) to the context's map, and nothing ever evicts one; arrays that differ only in scale (`[2, 1]` vs `[1, 0.5]`, the same wave after `toUnitPeak`) get separate entries too. Over a session that is unbounded growth. The kernel's module-level `loops` map in packages/audio/src/voiceKernel.ts:144 has the same shape for noise colors, keyed by whatever string `noise` holds (an unknown color is rendered as brown, under its own 2 s loop). Should: bound the cache (LRU of a few dozen) and key it by the normalized levels.
- evidence: read
- severity: low

## An unknown filter `type` is a lowpass on nodes and an allpass in the worklet and kernel
- where: packages/audio/src/biquad.ts:67 (biquadCoefficients), packages/audio/src/synthVoice.ts:155 (voiceFilter)
- scenario: `playNote({ pitch: 'A4', filter: { type: 'low-pass' as BiquadFilterType, frequency: 800 } })` from an untyped caller or stored patch. On the node path `node.type = 'low-pass'` is an invalid enum value, which the attribute setter ignores, so the filter stays the default lowpass. In the kernel (worklet voices, `renderNote`) `biquadCoefficients` falls through to the `type !== 'lowpass'` branch and, not being bandpass or notch, builds the allpass coefficients: the note is unfiltered. One input, two answers, and no error on either. Should: refuse an unknown type at the call (a RangeError), as the package does for other bad input.
- evidence: read
- severity: low

## Files read
packages/audio/src/analyser.ts
packages/audio/src/audioTime.ts
packages/audio/src/biquad.ts
packages/audio/src/buses.ts
packages/audio/src/createAudioEngine.ts
packages/audio/src/effects.ts
packages/audio/src/envelope.ts
packages/audio/src/impulse.ts
packages/audio/src/index.ts
packages/audio/src/insertPlan.ts
packages/audio/src/insertPump.ts
packages/audio/src/insertRoute.ts
packages/audio/src/insertSlot.ts
packages/audio/src/inserts.ts
packages/audio/src/lerp.ts
packages/audio/src/liveVoice.ts
packages/audio/src/oscillator.ts
packages/audio/src/param.ts
packages/audio/src/patternLoad.ts
packages/audio/src/patternPlayer.ts
packages/audio/src/pbt.fixture.ts
packages/audio/src/periodicWave.ts
packages/audio/src/pitch.ts
packages/audio/src/resumeWatch.ts
packages/audio/src/scheduler.ts
packages/audio/src/score.ts
packages/audio/src/scoreBar.ts
packages/audio/src/scoreMood.ts
packages/audio/src/soundCache.ts
packages/audio/src/spatialize.ts
packages/audio/src/streamStarter.ts
packages/audio/src/synthStarters.ts
packages/audio/src/synthVoice.ts
packages/audio/src/tickTimer.ts
packages/audio/src/types.ts
packages/audio/src/voiceChains.ts
packages/audio/src/voiceDrops.ts
packages/audio/src/voiceKernel.ts
packages/audio/src/voicePool.ts
packages/audio/src/voices.ts
packages/audio/src/worklet/loadVoiceProcessor.ts
packages/audio/src/worklet/protocol.ts
packages/audio/src/worklet/voiceMixer.ts
packages/audio/src/worklet/voiceProcessor.ts
packages/audio/src/worklet/workletVoices.ts

(Not read end to end: packages/audio/src/worklet/voiceProcessor.gen.ts, the generated bundle; only spot-checked that its `lerp`, Nyquist skip and biquad floor match the sources.)

<!-- done: 11 findings, files read: 45 -->
