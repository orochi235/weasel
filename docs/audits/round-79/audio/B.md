## A worklet or offline noise voice whose rate × 2^(detune/1200) overflows renders NaN into its bus
- where: packages/audio/src/voiceKernel.ts:50 (tuning), packages/audio/src/voiceKernel.ts:183 (createNoiseKernel source)
- scenario: `playNoise({ noise: 'white', detune: 1.3e6 })` with `synthVoices: 'worklet'`, or `handle.setDetune(1.3e6)` on such a voice, or `rate: 1e308, detune: 1200`. `checkFinite`/`checkRate` pass both values, but `tuning` returns `Infinity`. The noise source then sets `at = (at + Infinity) % loop.length = NaN`. From the next sample `loop[NaN]` is `undefined`, `lerp(undefined, undefined, NaN)` returns `undefined`, and `out[i] += …` writes NaN into the mixer's left and right for the whole bus. A delay insert's feedback loop then keeps that NaN. The node path clamps an out-of-range `detune.value`, so the same call there plays normally. `renderNoise` returns NaN samples too. The kernel should clamp or reject a tune that is not finite, as the node path effectively does. (A note voice is not affected: `dt >= 0.5` skips the tone.)
- evidence: read
- severity: low

## `PatternPlayer.setDetune` (and `opts.detune`) accepts a non-finite number, and every later step then throws
- where: packages/audio/src/patternPlayer.ts:285 (setDetune), packages/audio/src/patternPlayer.ts:180 (createPatternPlayer drift)
- scenario: `player.setDetune(NaN)`, or `createPatternPlayer(engine, { tempo: 120, detune: Infinity, … })`. Nothing checks the value. On each step, `playStep` computes `detune = e.detune + NaN`, and `checkVoice` throws a RangeError for every event. The player keeps booking, so it reports `isPlaying()` true and the scheduler logs a "callback threw" error on every step, but no event ever sounds. `setTempo` and `setEvents` refuse a bad value at the call and keep the old one; `setDetune` should do the same for a number, as the package's rule of checking at the call rather than when it comes due says.
- evidence: read
- severity: low

## A voice stopped before its `when` stays in the scheduler queue until that time
- where: packages/audio/src/voices.ts:330 (launch → scheduler.schedule), packages/audio/src/voices.ts:52 (teardownVoice)
- scenario: `const v = engine.play(s, { when: engine.now() + 600_000 }); v.stop();`, repeated, for example by a consumer re-booking a far cue whenever state changes. `teardown` marks the voice dead, but nothing removes its `begin` entry from the scheduler, so the queue keeps one entry per canceled booking, holding the `LiveVoice` and its starter, until each one's `when`. Every pass, every 25 ms, walks the whole queue. Only a keyed voice can be removed, through `cancelKey`. Teardown should drop its own entry, or the queue should skip canceled voices.
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
packages/audio/src/patchCheck.ts
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
packages/audio/src/worklet/voiceProcessor.gen.ts
packages/audio/src/worklet/voiceProcessor.ts
packages/audio/src/worklet/workletVoices.ts

<!-- done: 3 findings, files read: 47 -->
