# Findings: audio

## `stop()` on a voice the lookahead has started but not yet sounded reports `onDone`, where `release()` reports `onDrop('stopped')`
- where: packages/audio/src/voices.ts:154 (voiceHandle.stop)
- scenario: `play(sound, { when: now() + 80, onDone, onDrop })`. The scheduler's lookahead (100 ms) runs `startVoice` at once, so the voice has a source. Calling `handle.release()` inside those 80 ms clears `onended`, tears it down and reports `onDrop('stopped')`. That follows the 2026-11-23 ruling in `docs/unruled.md:1313`. Calling `handle.stop()` (with or without `fadeMs`) in the same window goes to `teardown`, or to a fade whose `source.stop(now + fade)` lands before the source's start. The source's `onended` still fires, so `onDone` runs and `onDrop` never does, for a voice that never made a sound. A voice stopped before its `when` with a larger lookahead (no source yet) gets `onDrop('stopped')`. So the same `stop()` call reports two different outcomes depending on lookahead timing the caller cannot see, which is the reason the ruling gives for `release`.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: early-cancel check lives in `release` only
- confidence: likely

## Stopping or `cancelKey`ing an overdue booked worklet voice steals an unrelated voice from the pool
- where: packages/audio/src/voices.ts:350 (createVoices.cancelKey; also stopAll and voiceHandle.stop/release via `catchUp`)
- scenario: `synthVoices: 'worklet'` with the bus at `voiceLimit`. A voice is booked under key `'a'`. The main thread stalls past its `when`, so the scheduler has not run it yet. `cancelKey('a')` calls `voice.catchUp()`, which calls `begin` → `startVoice`. `startVoice` runs `slots.pool.acquire`, which finds the pool full, steals the oldest voice on the bus (not under `'a'`) and tears it down. Only then is the canceled voice torn down itself. A voice that was not named loses its sound just so a voice being canceled can be accounted as started. The same happens for `handle.stop()` / `release()` on such a voice.
- evidence: read
- severity: low
- fix: packages/audio/src/voices.ts
- size: function
- cause: catch-up start takes a slot (and steals) even when it is followed at once by teardown
- confidence: likely

## A fade short enough to finish synchronously makes the insert pump overwrite the cancel of the next crossfade
- where: packages/audio/src/insertPump.ts:52 (pump)
- scenario: `insertFadeMs: 0.0005`, which `checkSpan` accepts. Then `left = ms / 1000 ≤ 1e-6`, so `afterRamp` → `atAudioTime` runs its callback synchronously, inside the `afterRamp(...)` call. The callback sets `busy = false`, finishes the step and calls `pump()` recursively. That nested pump starts the next step and stores that step's async cancel in `cancel`. Back in the outer frame, `cancel = afterRamp(...)` then overwrites it with the spent cancel of the first ramp. A later `stop()` (bus `dispose`) cancels nothing, so the second step's timer still fires after `route.drop()`. Its `finish` then unlinks links that are already gone: `l.from.disconnect(l.gain)` throws from a timer callback, or `links.splice(-1, 1)` drops an unrelated link from the bookkeeping.
- evidence: read
- severity: low
- fix: packages/audio/src/insertPump.ts
- size: line
- cause: cancel assigned after a call that can re-enter pump
- confidence: likely

## A load in flight across `SoundCache.clear()` / engine `dispose()` still stores its buffer afterward
- where: packages/audio/src/soundCache.ts:52 (load)
- scenario: `engine.load(url)` is called, and `engine.dispose()` runs before the fetch resolves, on a context the consumer passed in (so it stays open and decoding succeeds). `dispose` calls `sounds.clear()`. The task then resumes and runs `store(buffer)`, `byUrl.set` and `urlById.set` on the cleared cache. The decoded buffer is retained in a disposed engine's cache, and the caller gets a handle for an engine that will never play it. `clear()` promises to `free` every handle, but it cannot reach one that is still loading.
- evidence: read
- severity: low
- fix: packages/audio/src/soundCache.ts
- size: function
- cause: clear does not invalidate in-flight loads
- confidence: likely

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
