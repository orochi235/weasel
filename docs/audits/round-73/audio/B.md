## createAudioEngine leaks the AudioContext it made when its bus list or voice limit is refused
- where: packages/audio/src/createAudioEngine.ts:240 (createAudioEngine)
- scenario: `createAudioEngine({ buses: [] })`, or `{ voiceLimit: 0 }` / `{ voiceLimit: NaN }` (refused by `createVoicePool` inside `busSlots`). Only the scheduler timing and the insert fade are checked before `new AudioContext()`. The bus-count check (line 245) and the voice-limit check (in `busSlots`, line 249) run after it, so the throw leaves a running context of the engine's own that nothing can close. Each bad call strands one more context and its audio thread. The comment at line 237 says validation runs "before anything is made" so this cannot happen. Both checks should run before the context is created.
- evidence: read
- severity: medium

## An insert crossfade cut short by a suspension clicks when the context resumes
- where: packages/audio/src/insertPump.ts:48 (pump), packages/audio/src/insertRoute.ts:65 (spliceIn) / :76 (spliceOut)
- scenario: `bus.inserts.add(effect)` while the context is running starts a 15 ms crossfade: the old link ramps 1→0 and the new one 0→1. The tab is hidden and the context suspends halfway. `atAudioTime`'s timer then sees the context is not running and calls `finish` at once, which unlinks the old route while it is still at about 0.5. On resume the incoming ramp carries on from 0.5, so the bus output steps from (0.5 old + 0.5 new) down to 0.5 and then ramps back up. That step is the click the crossfade exists to avoid. The same happens in `spliceOut`, where `from` is cut mid-ramp. `atAudioTime`'s doc says "nothing is heard meanwhile", which is true during the suspension, but the cut is heard once the context resumes. `finish` should either snap the surviving link to its target before unlinking, or wait until the clock actually passes the ramp's end.
- evidence: read
- severity: low

## A pattern player started on a disposed engine, or running when the engine is disposed, reports isPlaying() true forever
- where: packages/audio/src/patternPlayer.ts:241 (start) / :207 (book)
- scenario: `engine.dispose()`, then `player.start()`. `engine.schedule` silently drops the booking (createAudioEngine.ts:288), but `running` is already true, so `isPlaying()` stays true and no step ever fires. The same happens to a player that was running when the engine was disposed: `scheduler.clear()` drops the pending step and nothing resets `running`. A score (score.ts) inherits this, and its `start()` becomes a permanent no-op, because it checks `player.isPlaying()`. The fire path's comment ("or `isPlaying()` stays true over a silent player") shows the invariant is meant to hold.
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
