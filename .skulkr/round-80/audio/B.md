# Audit round 80, area `audio` — reviewer findings

## SoundCache keeps every registered or decoded buffer for the engine's lifetime, with no way to release one
- where: packages/audio/src/soundCache.ts:36 (store), :71 (decode), :73 (register)
- scenario: `renderNote`'s doc (voiceKernel.ts) suggests putting a note's samples in an `AudioBuffer` and `engine.register`ing it to play the note as a sound. A consumer that does this per note, or calls `engine.decode(bytes)` for each recording or generated clip, adds a new `snd_N` entry to `buffers` on every call. Nothing ever removes one (no unregister or release on `SoundCache` or `AudioEngine`), and the engine's `dispose()` does not clear it either, so a long session's decoded audio grows without bound. A cache this unbounded should have a cap or an explicit release.
- evidence: read
- severity: medium

## createDelayEffect throws on an explicit `maxTime` below 250 ms unless `time` is passed as well
- where: packages/audio/src/effects.ts:147-151 (createDelayEffect)
- scenario: `createDelayEffect(ctx, { maxTime: 200 })` asks for a short delay line and leaves `time` at its documented default. `maxTime` passes its own check, then `checkTime(opts.time ?? 250, 200)` throws `RangeError: delay time 250 is outside 0..200 ms`. Expected: a default `time` that fits inside the `maxTime` the caller gave, for example `min(250, maxTime)`, or a doc saying `time` must be given with any `maxTime` below 250. Only the unset-`maxTime` default is written to cover `time`.
- evidence: read
- severity: low

## Whether release() before a note sounds cancels it or plays a release tail depends on lookahead timing the caller cannot see
- where: packages/audio/src/voices.ts:206-217 (voiceHandle.release); packages/audio/src/synthStarters.ts:44-52 (synthStart voice.release); packages/audio/src/types.ts:58-61 (VoiceHandle.release doc)
- scenario: `playNote({ pitch, when: now + 500, envelope: { attack: 0, release: 300 } })`. If `release()` is called 400 ms before `when`, the voice has not been started, so it is torn down: canceled, with `onDrop('stopped')`, which matches the doc ("released before it starts is canceled"). If it is called 60 ms before `when`, the scheduler's lookahead (100 ms) has already run `startVoice`. In that case `voice.release` is live, `amp.release(t0)` schedules a release from `envelopeLevel(env, 0)`, which is full level when the attack is 0, and a 300 ms tail sounds at `when`, followed by `onDone`. The worklet path does the same once its scheduler entry has fired. The same call, made before the note sounds, cancels it or plays it depending on scheduler internals. Expected: a release before `when` cancels the voice every time, as documented.
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
