## stop(), cancelKey() and stopAll() on a voice started inside the lookahead but not yet heard report onDone, where release() reports onDrop('stopped')
- where: packages/audio/src/voices.ts:173 (voiceHandle.stop), packages/audio/src/voices.ts:191 (voiceHandle.release)
- scenario: `engine.play(sound, { when: engine.now() + 50, onDone, onDrop })` with the default 100 ms lookahead. The scheduler's microtask flush runs startVoice, so the voice has a source but nothing is audible yet. Then `handle.stop()` goes to `teardown`: the source is stopped before its start time, its `onended` fires, and `onDone` runs. `handle.release()` at the same moment clears `onended`, tears down, and calls `onDrop('stopped')`. The same `stop()` on a voice booked 150 ms out, past the lookahead, also gives `onDrop('stopped')`. So whether the owner hears "played" or "never played" depends on which method it called and on the lookahead, not on whether the voice sounded. `VoiceDropReason` says `stopped` covers "stopped, released or cancelKeyed before it came due". `stop`, `cancelKey` and `stopAll` (through `teardownVoice`) should take the not-yet-heard branch that `release` takes.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: the "started ahead, not heard" check lives only in release()
- confidence: likely

## catchUp() on a voice that is being torn down can steal an unrelated sounding voice
- where: packages/audio/src/voices.ts:174 (voiceHandle.stop), packages/audio/src/voices.ts:340 (cancelKey), packages/audio/src/voices.ts:333 (stopAll)
- scenario: Run `synthVoices: 'worklet'` with a bus at its voice limit. The main thread stalls, which is the case worklet voices exist for, so a booked voice's time passes before its scheduler pass. Calling `handle.stop()`, `release()` or `engine.cancelKey(k)` on that voice first runs `voice.catchUp()` → `begin` → `startVoice`. That calls `slots.pool.acquire`, which takes the bus's oldest or quietest voice and tears it down, and then the caught-up voice is torn down too. Stopping one voice silences another, unrelated one. `cancelKey` does the same for every keyed voice it catches up. Catch-up should mark the voice started without acquiring a slot, or skip the steal when teardown follows at once.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: catch-up reuses the full start path, slot acquisition and steal included
- confidence: sure

## A freed sound's drop warns that the engine "never loaded" it
- where: packages/audio/src/createAudioEngine.ts:107 (bufferStarter.ready), packages/audio/src/voiceDrops.ts:40 (unknownSound)
- scenario: `const s = await engine.load(url); engine.free(s); engine.play(s)`. The voice drops as `unready`, which is what `SoundCache.free` documents. But the console reports that the engine was handed a sound "which this engine never loaded… A handle belongs to the engine that produced it", which points the consumer at a cross-engine mix-up that never happened. The warning is latched once per engine, so a later real cross-engine mistake goes unreported after it.
- evidence: read
- severity: low
- fix: packages/audio/src/voiceDrops.ts, packages/audio/src/soundCache.ts
- size: function
- cause: one warning covers both "freed" and "foreign handle"
- confidence: sure

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
