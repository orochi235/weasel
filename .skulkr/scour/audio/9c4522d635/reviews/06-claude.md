# Audit findings: audio (blind reviewer)

## stop(), cancelKey() and stopAll() report a started-ahead, never-heard voice as done, where release() reports it dropped
- where: packages/audio/src/voices.ts:173 (voiceHandle.stop), packages/audio/src/voices.ts:340 (cancelKey), packages/audio/src/voices.ts:334 (stopAll)
- scenario: `play(sound, { when: now + 80, onDone, onDrop })` with the default 100 ms lookahead. The scheduler starts the source at once, and its start time is 80 ms out. Calling `handle.release()` before 80 ms takes the "started ahead of its time, but not yet heard" branch: it clears `onended`, tears down, and calls `onDrop('stopped')`. Calling `handle.stop()` (or `engine.cancelKey(key)`, or `stopAll()`) in the same window goes straight to `teardown`. `teardownVoice` sees a non-null source, so it reports no drop. `source.stop()` ends a source that never sounded, and its `onended` calls `onDone`. So one silent voice gets `onDone` from stop/cancelKey/stopAll and `onDrop('stopped')` from release. `VoiceDropReason`'s `stopped` ("stopped, released or cancelKeyed before it came due") says both should drop. A `stop(fadeMs)` in that window has the same result.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: "not yet heard" check exists only in release()
- confidence: sure

## The 'quietest' steal policy never sees a fading or releasing voice's level fall
- where: packages/audio/src/voices.ts:184 (voiceHandle.setGain), packages/audio/src/voices.ts:173 (stop fade path)
- scenario: The bus is full and uses `steal: 'quietest'`. One voice is fading out after `stop(500)`, or running its release after `release()`, and goes to silence while still holding its slot. Its pool record keeps the gain from before the fade, because `stop(fadeMs)` and `release()` never call `poolGain`, and `setGain` returns early while fading. The next play therefore steals the voice with the lowest recorded gain. That can be an audible quiet voice, while the one already on its way to silence keeps its slot.
- evidence: read
- severity: low
- fix: packages/audio/src/voices.ts, packages/audio/src/voicePool.ts
- size: function
- cause: pool gain not updated on fade/release
- confidence: likely

## A worklet voice that ended before the scheduler reached it still takes a pool slot, and can steal a live voice
- where: packages/audio/src/voices.ts:128 (startVoice), packages/audio/src/worklet/workletVoices.ts:36 (workletSource onended setter)
- scenario: With `synthVoices: 'worklet'`, a short note (50 ms) is booked and then the main thread stalls for 300 ms. The processor plays the note and posts `ended`, and `source.end()` sets `ended`. When the stalled pass finally runs `begin`, `startVoice` acquires a slot on a full bus and tears down the stolen victim. Only after that does the `onended` setter queue the teardown of a voice that is already over. After a stall, a backlog of finished worklet notes evicts voices that are still sounding.
- evidence: read
- severity: low
- fix: packages/audio/src/voices.ts, packages/audio/src/worklet/workletVoices.ts
- size: function
- cause: no "already ended" check before acquire
- confidence: likely

## Inharmonic partial gains near the double range overflow the normalizing total and silence the note
- where: packages/audio/src/synthVoice.ts:107 (resolvePartials)
- scenario: `wave: { partials: [{ ratio: 1, gain: 1e308 }, { ratio: 2, gain: 1e308 }] }`. `checkFinite` accepts both gains, but `total` sums to Infinity, so every normalized gain is `1e308 / Infinity = 0`. The note is silent on both the node path and the kernel path. Only the ratios should matter, as they do for harmonic levels, which `toUnitPeak` scales first in oscillator.ts and periodicWave.ts.
- evidence: read
- severity: low
- fix: packages/audio/src/synthVoice.ts
- size: line
- cause: sum not scaled to largest gain first
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
