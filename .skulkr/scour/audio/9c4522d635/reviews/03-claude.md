# Findings: audio (blind reviewer)

## A finite value past float32's range passes every audio check, then throws from the AudioParam after `writeParam` has already canceled the ramp in flight
- where: packages/audio/src/param.ts:20 (writeParam / checkParam / checkGain / checkFinite / checkRate)
- scenario: `engine.bus('music').setGain(1e39, 200)` while the bus is ramping: `checkGain` accepts the value because it is finite, `s.gain = 1e39` is kept, and `writeParam` calls `cancelScheduledValues(now)` and then `linearRampToValueAtTime(1e39, …)`. WebIDL's `float` conversion throws a TypeError on any double that rounds past ±2^128, and `AudioParam.value`, `setValueAtTime` and `linearRampToValueAtTime` all take `float`. So the call throws after the ramp in flight is gone, which is the outcome `writeParam`'s own comment says the early check exists to prevent. Because the value is kept, every later `apply()` that recomputes the bus (an unmute, an unsolo) throws again; `checkGain`'s doc names exactly this trap. The voice path breaks the same way. `voice.setGain(1e39)` stores `baseGain` and then throws. After that, `place()` throws for that voice on every `setPosition`, and `engine.setListener` → `respatialize()` throws partway through its loop, so the voices after it are never respatialized. The worklet path plays the same input: `voiceKernel`'s `tuning` clamps to FLOAT32_MAX, and the posted level is a JS number. So the two voice paths disagree on the same input.
- evidence: read
- severity: medium
- fix: packages/audio/src/param.ts, packages/audio/src/voices.ts, packages/audio/src/buses.ts
- size: function
- cause: finiteness check where the param needs a float32 range check
- confidence: likely

## A voice `pan` past float32's range leaks a voice chain wired to the bus
- where: packages/audio/src/voiceChains.ts:46 (createChainPool.take), packages/audio/src/voices.ts:270 (launch)
- scenario: `engine.play(sound, { pan: 1e39 })`: `checkVoice` → `checkFinite('voice pan')` passes, and `chains.take` writes the gain, then sets `panner.pan.value = 1e39`, which throws a TypeError (WebIDL `float`). On the step-gain path `amp.connect(bus)` comes after that line, so a fresh chain is merely lost. A chain reused from `idle` was popped first and is never pushed back. Later, on a live voice, `handle.setPan(1e39)` clears `voice.position` and sets `spatialGain = 1` in `place()`, then throws from `out.pan` before the level is rewritten. The voice keeps its old distance gain at the sound level while its state says it has no position and a gain of 1. The worklet path takes the same pan and clamps it (`voiceMixer` render).
- evidence: read
- severity: low
- fix: packages/audio/src/param.ts, packages/audio/src/voices.ts
- size: line
- cause: finiteness check where the param needs a float32 range check
- confidence: likely

## `stop()`, `cancelKey` and `stopAll` before a voice's `when` call `onDone` once the lookahead has started its node, and `onDrop('stopped')` otherwise
- where: packages/audio/src/voices.ts:163 (voiceHandle.stop), packages/audio/src/voices.ts:330 (cancelKey / stopAll)
- scenario: `const v = engine.play(s, { when: engine.now() + 80, onDone, onDrop }); v.stop();`. The scheduler's lookahead (100 ms) has already run `startVoice`, so `voice.source` exists. `stop()` goes straight to `teardown`, which reports no drop because the source is non-null, and calls `source.stop()`. The source's `onended` still fires and calls `onDone()`, although nothing was ever heard. The same call with `when: now + 500` (not yet started) reports `onDrop('stopped')` and never calls `onDone`. `release()` handles this window explicitly: it checks `ctx.currentTime * 1000 < voice.when`, nulls `onended` and reports `stopped`. That matches the `VoiceDropReason` doc ("stopped, released or `cancelKey`ed before it came due") and the 2026-11-23 ruling in `docs/unruled.md`, whose reason was that the outcome otherwise depends on lookahead timing the caller cannot see. `stop`, `cancelKey` and `stopAll` still answer it the other way. The `stop(fadeMs)` fade path does the same for a voice whose `when` lies past the fade's end.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: release's not-yet-heard branch not shared with stop/cancelKey
- confidence: sure

## A load in flight when the cache is cleared (engine dispose) repopulates the cleared cache
- where: packages/audio/src/soundCache.ts:52 (load task) and :86 (clear)
- scenario: `engine.load(url)`, then `engine.dispose()` before the fetch resolves, on a consumer-owned context that stays open. `clear()` empties `buffers`, `byUrl` and `urlById`, but `inflight` is left alone. The task then decodes and calls `store(buffer)` and `byUrl.set(url, …)`, so a decoded buffer is held in a cache its engine has disposed. `clear()`'s doc says it frees every handle, and the engine's doc says dispose frees every sound. The same holds for `free` and `clear` called on a standalone cache while a load is pending: the buffer comes back after the clear.
- evidence: read
- severity: low
- fix: packages/audio/src/soundCache.ts
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
