# Audit round 37 — area `audio`

## A note's or noise's `duration` is never checked: a negative one drives the envelope gain negative, and a NaN one throws only when the voice comes due
- where: packages/audio/src/synthStarters.ts:31 (synthStart), packages/audio/src/envelope.ts:53 (envelopePoints), packages/audio/src/voices.ts:212 (checkVoice)
- scenario: `engine.playNote({ pitch: 'A4', duration: -10 })` — `checkVoice` checks `when`, `gain`, `rate`, `detune`, `pan` and `position` but not `duration`. `envelopePoints(env, -10)` gives `heldLevel(e, -10) = -10 / attack = -2`, so the shaper gain is scheduled to `-2` (polarity-inverted, double level) at `t0 - 10 ms`, then ramps to 0; and `voice.release` (`at*1000 - whenMs >= gate`) is always a no-op. With `duration: NaN` (e.g. a pattern step computed from a NaN `stepMs`) `linearRampToValueAtTime(…, NaN)` / `osc.stop(NaN)` throw inside `starter.start` at come-due, so the call returns a live-looking handle and the voice drops as `failed` with a console error from the scheduler — where every other bad number throws `RangeError` at the call. Envelope times are unchecked the same way (`Math.max(0, NaN)` is NaN). Under `synthVoices: 'worklet'` it is worse: `createKernel` (packages/audio/src/voiceKernel.ts:94,99) with `gate = NaN` never meets `t >= gate + release`, and `envelopeLevel(env, t, NaN)` returns `heldLevel(e, NaN) * (1 - (t - NaN)/release)` = NaN, so the voice never ends (its pool slot is held forever) and adds NaN to its bus's processor output every quantum, silencing the whole bus and everything downstream of it.
- evidence: read
- severity: high

## A rate of 0 or below passes the voice checks, then throws for a node note and mixes NaN into the bus for a worklet noise
- where: packages/audio/src/voices.ts:215,188 (checkVoice, setRate), packages/audio/src/synthStarters.ts:119 (note retune), packages/audio/src/voiceKernel.ts:170 (createNoiseKernel)
- scenario: `checkFinite('voice rate', …)` admits `0` and negatives. (a) `playNote({ pitch: 'A4', rate: 0 })` on nodes: `retune` writes `osc.detune.value = detune + 1200 * Math.log2(0)` = -Infinity (NaN for a negative rate), which an AudioParam refuses with a TypeError inside `starter.start` — the voice drops as `failed` from the scheduler; `handle.setRate(0)` on a sounding note throws that TypeError out of the setter, not the package's RangeError. (b) `playNoise({ noise: 'white', rate: -1 })` under `synthVoices: 'worklet'`: the noise kernel's `at = (at + tune) % loop.length` goes negative, `loop[i]` is `undefined`, and the sample is NaN, which the mixer adds into the whole bus. (c) The same noise on nodes plays backward through a negative `playbackRate`. One option, three outcomes by path; it should be refused (or clamped) at the call like every other bad voice number.
- evidence: read
- severity: medium

## The media-element source cache is per engine, so a second engine on the same context cannot stream an element the first one streamed
- where: packages/audio/src/streamStarter.ts:60,74-77 (createStreamStarters / starter.start)
- scenario: a consumer passes its own `AudioContext` and keeps an `<audio>` element across engines (a React remount, StrictMode's double mount, or an engine rebuilt to change buses): engine A `stream(el)`, `A.dispose()`, then `B = createAudioEngine({ context })` and `B.stream(el)`. B's `mediaSources` WeakMap is fresh, so it calls `ctx.createMediaElementSource(el)` again; the element is already bound to A's `MediaElementAudioSourceNode` on that very context and the call throws `InvalidStateError` inside `starter.start`, so the stream drops as `failed` (console error from the scheduler) and is never heard. The node can be reused — same context — but the cache lives in the engine, not on the context, as the package's other per-context caches do (`createPart` in synthVoice.ts:12, periodicWave.ts:4).
- evidence: read
- severity: medium

## `stream()` stops the element's current stream before checking the bus, so a call with an unknown bus silences the music and then throws
- where: packages/audio/src/createAudioEngine.ts:260-266 (stream)
- scenario: `engine.stream(el)` is playing; `engine.stream(el, { bus: 'musc' })` (typo). `checkVoice(streamOpts)` passes (it checks only numbers), `streams.streaming.get(el)?.stop()` tears down the playing stream, and only then does `voices.launch` → `requireSlots('musc')` throw `unknown bus`. The comment on line 261 says the call is checked "before the earlier stream stops"; the bus is the one input it misses. Should throw first and leave the playing stream alone.
- evidence: read
- severity: low

## A non-finite `insertFadeMs` / `fadeMs` throws out of `InsertChain.add` halfway through a splice, leaving the dry route permanently wired beside the effect
- where: packages/audio/src/inserts.ts:86,95 (createInsertChain fade), packages/audio/src/insertRoute.ts:52-62 (spliceIn), packages/audio/src/createAudioEngine.ts:218
- scenario: `createAudioEngine({ insertFadeMs: NaN })` (or `Infinity`, e.g. from a computed setting) on a running context, then `engine.bus('sfx').inserts.add(fx)`. `fadeMs` is never validated; `pump` passes `ms = NaN` to `spliceIn`, which builds the slot, links `head → fx`, links `fx → tail` at 0, pushes the slot into `live`, and then `writeParam(old.gain.gain, 0, NaN)` throws `RangeError`. The old `head → tail` link stays at gain 1 and is never unlinked, the incoming link stays at 0, so the bus plays dry and the effect is never heard; every later edit throws the same way. Should be refused at `createInsertChain`/`createAudioEngine`, before any graph change, as other non-finite audio input is (docs/unruled.md:1606).
- evidence: read
- severity: low

## `stop(fadeMs)` on a voice that is releasing cuts it dead instead of fading it
- where: packages/audio/src/voices.ts:151-165 (voiceHandle.stop)
- scenario: a held `playNote` voice gets `release()` (envelope release of, say, 2 s, `canceled = true`), then the consumer fades everything out with `handle.stop(500)`. The fade branch requires `!voice.canceled`, so it falls through to `teardown(voice)`, which calls `source.stop()` and frees the chain at once — an instant cut mid-release, the click `fadeMs` exists to avoid. The same happens to a second `stop(longerFade)` on a voice already fading. A releasing voice still has a source and an output, so the fade could be applied.
- evidence: read
- severity: low

## A harmonic `wave` array and a partial's `gain` are never checked: `[]` or a NaN entry fails at come-due on nodes and plays silence (or NaN) in the worklet
- where: packages/audio/src/synthVoice.ts:82-101 (resolvePartials), packages/audio/src/synthVoice.ts:111-118 (resolveNote), packages/audio/src/periodicWave.ts:13-16, packages/audio/src/oscillator.ts:64-76 (harmonicShape)
- scenario: `resolveNote` claims to check a note "where it was written", but only checks pitch and inharmonic ratio/decay. (a) `playNote({ pitch: 'A4', wave: [] })`: on nodes `createPeriodicWave` gets arrays of length 1 and throws `IndexSizeError` when the scheduler starts the voice (`failed`, console error); in the worklet `harmonicShape([])` peaks at 0 and the voice plays silence for its full length, holding a pool slot. (b) `wave: [1, NaN]`: `toUnitPeak` sees `Math.max(0, NaN)` = NaN, returns the levels unscaled, and a NaN goes into the PeriodicWave; the worklet's peak is NaN, `scale` 0, silence. (c) `{ partials: [{ ratio: 1, gain: NaN }] }` (or `Infinity`): `total` is NaN, every normalized gain NaN; on nodes `level.gain.setValueAtTime(NaN, t0)` throws at come-due, in the worklet the tone's level is NaN and the bus gets NaN. Each should be a `RangeError` at the call.
- evidence: read
- severity: medium

## A NaN in a score mood throws a TypeError from `readScoreCue`, and through `setMood` freezes the running score on its old bar
- where: packages/audio/src/scoreMood.ts:54-75 (inRange, readScoreCue), packages/audio/src/score.ts:58-67,97-98,113 (stateAt, onStep, setMood)
- scenario: `ScoreMood` promises out-of-range values are read as the nearest end, but `clamp(NaN)` is NaN. `readScoreCue({ valence: NaN, tension: 0, urgency: 0 })`: every distance and raw weight is NaN, `raw.indexOf(Math.max(...raw))` is -1, and `SCORE_CUES[-1].name` throws `TypeError: Cannot read properties of undefined`. `createScore(engine, { mood })` with such a mood throws that at construction; `score.setMood(mood)` (a mood driven by a computed metric that went NaN) is accepted, then every bar's last step throws it from `stateAt` inside `onStep`, so `write(next)` never runs: the score keeps replaying its last bar with the old tempo, `state()` never advances, and the scheduler logs an error each bar. `setMood` should refuse a non-finite axis with `RangeError` (as audio does elsewhere, docs/unruled.md:1606), or `inRange` should map NaN to an end.
- evidence: read
- severity: low

## One event that throws at its play call stops the pattern player for good while `isPlaying()` stays true
- where: packages/audio/src/patternPlayer.ts:159-189 (fire)
- scenario: the step's events are played (lines 159-172) before the `try/finally` that books the next step (lines 178-189). Any event whose `engine.play/playNote/playNoise` throws at the call — a pitch name it cannot read (`{ step: 4, pitch: 'H4' }` via `setEvents`), an unknown `bus`, a bad partial, a `detune` drift function returning NaN (`checkFinite` → RangeError), or the drift function itself throwing — escapes `fire`; the scheduler catches and logs it, but `book()` never runs, so no later step is ever scheduled. `running` stays true: `isPlaying()` reports a playing player that is silent forever, `start()` is a no-op, and the events after the bad one in that step never sound either. The `finally` comment at line 182 guards exactly this outcome for `onStep`, but not for the event loop above it. `createScore` inherits it (a bad `bus` in `ScoreBarOptions`).
- evidence: read
- severity: medium

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

(packages/audio/src/worklet/voiceProcessor.gen.ts was only grepped to confirm it carries the current kernel and mixer code; it is generated, and `npm run check:audio-worklet` holds it to its sources.)

<!-- done: 9 findings, files read: 45 -->
