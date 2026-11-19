# Audit round 38 — area `audio`

Note: the checkout's HEAD reads 7095f874ee84ae7fc8454ba425cb6ba5ac5bbbe8, not the brief's aac71b5; findings cite the tree as checked out.

## A worklet synth voice with a non-finite envelope, duration or filter number mixes NaN into its whole bus and never ends
- where: packages/audio/src/worklet/workletVoices.ts:126 (note / noise), packages/audio/src/voiceKernel.ts:80 (createKernel)
- scenario: engine with `synthVoices: 'worklet'`, after unlock: `playNote({ pitch: 'A4', duration: 200, envelope: { release: NaN } })` (or `envelope: { sustain: NaN }`, `duration: NaN`, `filter: { frequency: NaN }`). `checkVoice` checks only when/gain/rate/detune/pan/position, and `workletVoices.note` checks only pitch and partials through `resolveNote`; `playNoise` checks nothing of its patch. In the kernel, `resolveEnvelope` keeps NaN (`Math.max(0, NaN)` is NaN), so `envelopeLevel` returns NaN past the gate (or throughout, for sustain/duration), and `t >= gate + env.release` is never true, so the voice never ends. The mixer adds NaN into the processor's shared `left`/`right` output, silencing every other voice on that bus, poisoning any biquad/convolver insert state downstream, and the voice stays in the mixer forever (its slot is never released either, since no `ended` is posted). On the node path the same call throws when it comes due and drops as `'failed'`. Should be refused at the call with a `RangeError`, on both paths.
- evidence: read
- severity: high

## A negative `rate` on a worklet noise voice indexes the loop at negative positions and outputs NaN onto the bus
- where: packages/audio/src/voiceKernel.ts:166-171 (createNoiseKernel source)
- scenario: `synthVoices: 'worklet'`; `playNoise({ noise: 'white', rate: -1 })`, or `handle.setRate(-1)` on a running worklet noise voice. `checkFinite` accepts -1. The source does `at = (at + tune) % loop.length`; JS `%` keeps the sign, so `at` goes below 0 within at most one loop, `loop[Math.floor(at)]` is `undefined`, and `lerp(undefined, …)` is NaN — added into the bus's shared output, muting the bus. On the node path the same call plays the buffer backwards (`AudioBufferSourceNode.playbackRate` accepts negatives). The two paths answer the same input differently; the kernel should wrap with a positive modulo (or the rate be refused on both).
- evidence: read
- severity: high

## `setRate(0)` or a negative rate on a node `playNote` voice throws a TypeError from the handle, and drops the voice as `'failed'` at start
- where: packages/audio/src/synthStarters.ts:118-120 (note retune)
- scenario: node synth voices (default). `const v = engine.playNote({ pitch: 'C4' }); v.setRate(0)` → retune writes `osc.detune.value = voice.detune + 1200 * Math.log2(0)` = -Infinity, and an AudioParam's `value` setter throws `TypeError` on a non-finite value. `setRate(-1)` gives NaN, same throw. `voices.ts` `setRate` documents throwing only a `RangeError` on non-finite input and passes both values. A voice launched with an untyped `rate: 0` (launch reads `common.rate`) throws inside `synthStart` → `startVoice` tears it down as `'failed'` and rethrows into the scheduler's console.error. A buffer voice and a noise voice take rate 0 fine, so the handle's contract differs by voice kind.
- evidence: read
- severity: medium

## An event whose play throws stops a pattern for good while `isPlaying()` stays true
- where: packages/audio/src/patternPlayer.ts:159-172 (fire)
- scenario: `createPatternPlayer(engine, { tempo: 120, events: [{ step: 0, pitch: 'H4' }] })` (unreadable note name), or a hit with `bus: 'nope'`, or `gain: NaN`. `setEvents` validates nothing; in `fire` the events loop calls `engine.playNote`/`play`, which throws (`resolveNote`, `requireSlots`, `checkVoice`). The loop sits outside the `try/finally` that books the next step, so the throw escapes to the scheduler's catch, no further step is ever booked, and `running` stays true: `isPlaying()` reports a playing, silent player, and `start()` is then a no-op until `stop()`. The `finally` comment shows the intent ("Booked even when `onStep` throws, or `isPlaying()` stays true over a silent player") but covers only `onStep`. The same applies to `createScore`, whose events come from the player.
- evidence: read
- severity: medium

## `inserts.settled()` never resolves when called after the bus graph is disposed mid-crossfade
- where: packages/audio/src/insertPump.ts:59-67 (settled / stop)
- scenario: `engine.bus('sfx').inserts.add(createFilterEffect(ctx))` on a running context starts a 15 ms crossfade (`busy = true`); `engine.dispose()` within those 15 ms calls `stop()`, which cancels the timer but leaves `busy` true, then `release()` resolves the waiters already queued. A later `await engine.bus('sfx').inserts.settled()` sees `busy` and pushes a waiter that nothing will ever resolve, so the await hangs forever (also for any `settled()` from teardown code running after dispose). `stop()` should clear `busy`, or `settled()` should resolve once `stopped`.
- evidence: read
- severity: low

## An empty harmonic waveform throws on node voices when it comes due, but plays silence on worklet voices
- where: packages/audio/src/periodicWave.ts:13-16 (periodicWave), packages/audio/src/synthVoice.ts:111-118 (resolveNote)
- scenario: `playNote({ pitch: 'A4', wave: [] })`. `resolveNote` checks pitch and inharmonic partials but not a harmonic array, so nothing throws at the call (as `SynthStarters.note` promises for a bad wave). On nodes, `periodicWave` calls `createPeriodicWave` with length-1 arrays, which Web Audio refuses (IndexSizeError, fewer than 2 elements) — the voice is dropped as `'failed'` with a scheduler console.error. In the worklet, `harmonicShape([])` has peak 0 and renders a silent voice that holds its slot for its whole gate. Two answers to one input; it should be refused at the call.
- evidence: read
- severity: low

## The per-context PeriodicWave cache has no bound
- where: packages/audio/src/periodicWave.ts:4-19 (periodicWave)
- scenario: a consumer that varies a harmonic waveform per note — `playNote({ pitch, wave: [1, Math.random(), 0.3] })`, or a timbre morph over a slider — mints a new key per call; `wavesIn(ctx)` keeps every `PeriodicWave` for the context's lifetime, so a long-running engine grows without limit. An LRU cap (the voice only needs the wave at `setPeriodicWave`) would bound it.
- evidence: read
- severity: low

## A score bar entered after a stall reports its new state but plays the previous bar's events on its first booked step
- where: packages/audio/src/score.ts:86-95 (onStep), packages/audio/src/patternPlayer.ts:159-179 (fire)
- scenario: a stall skips step 15 of bar 3 (where `next` is normally written), and the player lands on, say, step 2 of bar 4. `fire` books step 2's events from the still-installed bar-3 event map, then calls `onStep`, where the score computes bar 4's state, `write`s it, and reports it to `onBar` as what bar 4 plays. That step sounds bar 3's chord (and, if the tempo changed with the mood, at bar 3's gate lengths) while `state()`/`onBar` name bar 4's cue and params.
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

(voiceProcessor.gen.ts only skimmed: it is the generated bundle of voiceProcessor.ts and its imports, read above.)

<!-- done: 8 findings, files read: 45 -->
