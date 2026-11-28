# Findings: audio (blind review)

## A voice started ahead of its `when` reports `onDone` when stopped, but `onDrop('stopped')` when released
- where: packages/audio/src/voices.ts:179 (voiceHandle.stop), also createVoices.cancelKey / stopAll (teardown path)
- scenario: `play(sound, { when: now() + 80, onDone, onDrop })`. The voice's `when` is inside the 100 ms lookahead, so `startVoice` runs in the next microtask and the voice gets a source before it is heard. If you call `release()` before `when`, the handle takes the "started ahead of its time but not yet heard" branch: it clears `source.onended`, tears the voice down and reports `onDrop('stopped')`. If you call `stop()`, `engine.cancelKey(key)` or `engine.stopAll()` at that same moment, the voice goes through `teardown`, which calls `source.stop()` and leaves `onended` set, so `onDone` fires instead. The voice was never heard. `stop(fadeMs)` is worse: the level ramps from now while the source only starts at `when`, and `source.stop(now + fade)` can fall before the start. The voice is then cut at its onset or never sounds, and `onDone` still fires. `VoiceDropReason` says `stopped` covers "stopped, released or cancelKeyed before it came due", so all four calls should give one answer.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: "not yet heard" checked on the release path only
- confidence: sure

## `patternVoicePeaks` under-counts voices for fractional steps: a slot is taken a lookahead before the event's step, not its own time
- where: packages/audio/src/patternLoad.ts:62 (patternVoicePeaks, `from: at - lead`)
- scenario: The player books a fractional event with the whole step it sits in (`eventsByStep` floors the step). That step's booking fires up to a lookahead before `floor(step) * stepMs`, and `voices.launch` takes the slot in the next microtask, because the event's `when` is already inside the window. So the slot is held from `floor(step)*stepMs - lead`, but the code uses `step*stepMs - lead`. Example: 120 bpm with 4 steps per beat (125 ms steps) and lead 100. Hit A on step 0 lasts 300 ms. Hit B is on step 3.9. B's slot is taken at about 275–300 ms while A is still sounding, so 2 voices are held. The computed span for B starts at 387.5 ms, so the function reports a peak of 1. With `voiceLimit: 1` the real playback steals A.
- evidence: read
- severity: medium
- size: line
- cause: lead measured from the fractional time, not the booking step
- confidence: likely

## A voice whose starter throws has already stolen another voice's slot
- where: packages/audio/src/voices.ts:120 (startVoice)
- scenario: The bus pool is full, and a play comes due whose `starter.start` throws (for example, a buffer source creation that fails). `pool.acquire` has already evicted the victim and `teardown(victim)` has stopped it. Then `start` throws and the new voice is torn down as `failed`. A healthy sounding voice is cut off and nothing replaces it. The steal should happen only once the new source exists, or the victim should be chosen after a successful start.
- evidence: read
- severity: low
- size: function
- cause: steal committed before the fallible start
- confidence: sure

## `SoundCache.clear()` (and so `engine.dispose()`) lets in-flight loads repopulate the cache afterward
- where: packages/audio/src/soundCache.ts:85 (clear) and :48 (load task)
- scenario: Call `engine.load(url)`, then call `engine.dispose()` before the fetch resolves. `clear()` empties `buffers`, `byUrl` and `urlById` but not `inflight`. The task then completes, `store`s the decoded buffer and sets `byUrl`/`urlById`, so a disposed engine holds a decoded buffer and the caller gets a live-looking handle. After a plain `clear()` on a live cache, the "cleared" url comes back as already loaded.
- evidence: read
- severity: low
- size: function
- cause: clear does not invalidate in-flight loads
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

<!-- done: 4 findings, files read: 47 -->
