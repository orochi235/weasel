# Audit round 74 — area `audio` — findings

## A sound handle from one engine plays a different engine's sound instead of being dropped
- where: packages/audio/src/soundCache.ts:27 (createSoundCache, `store`); read by packages/audio/src/createAudioEngine.ts:98 (bufferStarter.ready/start)
- scenario: two engines, each with its own cache, each `load` one sound. Both caches number from `snd_1`, so engine A's handle `{ id: 'snd_1' }` passed to `engineB.play(handle)` finds B's `snd_1` and plays B's buffer. The `unknownSound` warning ("A handle belongs to the engine that produced it") fires only when the id is missing, so a cross-engine handle plays the wrong sound silently whenever B has loaded at least as many sounds. It should be dropped as `unready` with the warning, which needs an id unique across caches (a module-wide counter) or a per-cache identity check on the handle.
- evidence: read
- severity: medium

## A non-looping pattern player's `stop()` does nothing once its last step has passed, leaving its voices sounding
- where: packages/audio/src/patternPlayer.ts:226 (fire, `!loop && count >= length`) and :250 (stop, `if (!running) return`)
- scenario: `createPatternPlayer(engine, { loop: false, events: [{ step: 0, sound, loop: true }] })`, or a note with a long `length` or release. When the step after the last one fires, it sets `running = false` and returns, but does not release `voices` or clear them. A later `player.stop()` then returns at `if (!running)`, so the looping hit, or the ringing notes, are never released, although `stop()` promises to "release every voice the player started". `Score.stop()` inherits the same problem. `stop()` should release `voices` whether or not the player is still booking, or the natural end should release them.
- evidence: read
- severity: medium

## `engine.stream` stops the earlier stream even when the new one is then dropped as it starts
- where: packages/audio/src/streamStarter.ts:110 (restream)
- scenario: the comment says launching first "leaves it playing" if the new voice throws or drops. But `launch` only books the voice: `handle.isPlaying()` is true at that point, so `streaming.get(el)?.stop()` runs at once. The new voice's `start` runs a microtask later and can still fail. For example, `createMediaElementSource` throws for an element already routed into another context, which tears it down as `failed`. The earlier stream has already been stopped, so both end up silent. A drop as the voice starts (rather than at the call) can't be told apart from success at the moment restream decides.
- evidence: read
- severity: low

## An insert crossfade interrupted by an OS `interrupted` state is cut short instead of waiting
- where: packages/audio/src/audioTime.ts:56 (afterRamp, the `ctx.state !== 'suspended'` checks)
- scenario: Safari/iOS moves a context to `'interrupted'` (a phone call, another app's audio) mid-crossfade. When the timer fires, `atAudioTime` sees a context that is not running and calls back. `afterRamp` then tests only for `'suspended'`, so it runs `cb` (unlinking the fading route) at once, half-way through the ramp. That is the click the 2026-11-22 ruling avoids for a suspension. If the context is already waiting on a suspension, the same thing happens on a `statechange` to `'interrupted'`. Only `'closed'` should end the wait early.
- evidence: read
- severity: low

## The voice kernel's noise-loop cache is keyed by sample rate and never evicted
- where: packages/audio/src/voiceKernel.ts:150 (noiseLoop, module-level `loops`)
- scenario: `renderNoise(noise, sampleRate)` and `createNoiseKernel` are public and take any sample rate. Each new `color:sampleRate` pair caches a 2-second Float32Array (≈384 KB at 48 kHz) for the life of the page. A consumer rendering at varying rates, such as an offline resample or pitch trick or a sweep of rates in a tool, grows the map without bound. It needs a cap, as `PERIODIC_WAVE_CACHE` gives periodic waves.
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

<!-- done: 5 findings, files read: 47 -->
