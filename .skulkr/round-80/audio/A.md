## createDelayEffect throws on its own default time when only a short maxTime is given
- where: packages/audio/src/effects.ts:149 (createDelayEffect)
- scenario: `createDelayEffect(ctx, { maxTime: 100 })` (a short slapback line, time to be set later with `setTime`). `maxTime` passes its check, then `checkTime(opts.time ?? 250, 100)` throws "delay time 250 is outside 0..100 ms" for a time the caller never gave. The default `time` should be capped at `maxTime` (or the docs should say a `maxTime` under 250 requires `time`); as documented, `time` defaults to 250 and `maxTime` may be anything above 0.
- evidence: read
- severity: low

## patternVoicePeaks loops once per pass across a long finite tail, so a long release or hitMs hangs it
- where: packages/audio/src/patternLoad.ts:64 (patternVoicePeaks)
- scenario: tempo 120, the default 16-step pass (2000 ms), and one hit with `hitMs: () => 1e12` (or a note whose envelope release is 1e12 ms). Both pass the finiteness check. `passes = ceil(longest / passMs)` comes to 5e8, and the nested loop pushes 2 edges per pass per span: about 1e9 objects. That runs out of memory or hangs, where it should return a peak. The overlap from a long tail can be counted in closed form (each span overlaps `floor`/`ceil` of its length over passMs copies of itself), or passes can be capped once every span covers a whole pass.
- evidence: read
- severity: low

## An unknown bus name is silently dropped as `locked` before unlock, but throws after it
- where: packages/audio/src/voices.ts:279 (createVoices.launch)
- scenario: `engine.play(sound, { bus: 'sfxx' })` (a typo) while the context is still suspended. `launch` returns at the `ctx.state !== 'running'` check: it reports `onDrop('locked')` and returns a dropped handle without ever calling `deps.requireSlots(busName)`. The same call after unlock throws `unknown bus "sfxx"`, and so does any call on a disposed engine with a valid name. So one decision gets two answers: the typo is reported only once the context runs, and before that it looks like an ordinary locked drop. `playNote`, `playNoise` and `stream` all go through the same path. The bus name should be resolved before the lock and dispose checks.
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
