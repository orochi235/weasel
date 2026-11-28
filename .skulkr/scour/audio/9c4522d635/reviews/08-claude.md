## `stop()` and `release()` give opposite outcomes for a voice the lookahead started but nobody has heard yet
- where: packages/audio/src/voices.ts:183 (voiceHandle.stop; compare release at :206)
- scenario: `engine.play(sound, { when: engine.now() + 80, onDone, onDrop })`. The scheduler starts the buffer source about one lookahead before `when`, so `voice.source` exists and `currentTime*1000 < voice.when`. Calling `release()` in that window sees "started ahead … but not yet heard", clears `onended`, tears down and reports `onDrop('stopped')`. Calling `stop()` (or `cancelKey`, or `stopAll`) on the same voice goes to `teardown`, which leaves `source.onended` in place, so `onDone` fires and `onDrop` never does. `types.ts` says a buffer voice's `release()` "is `stop()`". `stop(fadeMs)` in that window is worse: it ramps the chain to 0 starting now, before the voice is heard, and books `source.stop(now + fade)`. A fade shorter than `when - now` never sounds yet still reports `onDone`. A longer one plays a fragment that is already fading. All of these should take the same canceled-before-heard path that `release()` takes.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: the "not yet heard" check exists only in release()
- confidence: sure

## A pattern's `beforeStep` that changes the length plays the step under the old length's index
- where: packages/audio/src/patternPlayer.ts:233 (createPatternPlayer → fire)
- scenario: `fire` computes `const step = count % length` (and the `!loop && count >= length` end check) before calling `opts.beforeStep`. The docs say events set in `beforeStep` "apply to this step". Take a 16-step player at count 12 whose `beforeStep` calls `setEvents(events8, 8)`. That step looks up `byStep.get(12)` in the new 8-step map and finds nothing, so it plays silence, and `onStep` reports step 12 of an 8-step pattern. The new pattern's step 4 should play. The next step jumps to `13 % 8 = 5`. The index (and the non-loop end check) should be computed after `beforeStep`, or recomputed after it.
- evidence: read
- severity: low
- fix: packages/audio/src/patternPlayer.ts
- size: line
- cause: step index read before the hook that may change length
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

<!-- done: 2 findings, files read: 47 -->
