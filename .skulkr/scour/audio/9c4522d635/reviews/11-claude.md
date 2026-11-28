## stop() and cancelKey on a voice the lookahead has started but not yet sounded report onDone, where release() reports onDrop('stopped')
- where: packages/audio/src/voices.ts:162 (voiceHandle.stop), packages/audio/src/voices.ts:335 (createVoices.cancelKey)
- scenario: `const v = engine.play(s, { when: engine.now() + 50, onDone, onDrop })`. The scheduler's 100 ms lookahead starts it at once, so `voice.source` is set. Then `v.stop()` (or `engine.cancelKey(key)`, or `v.stop(20)`) before `when`: teardown stops the source with it still set, so no drop is reported, and the source's `onended` calls `onDone`. The voice never made a sound. `v.release()` in the same window cancels it and reports `onDrop('stopped')`, as `docs/unruled.md` ruled on 2026-11-23 (audit round 80) for the reason "the same call otherwise cancels or sounds depending on lookahead timing the caller cannot see". So stop and cancelKey still answer by that hidden timing: one microtask earlier the same call reports `onDrop('stopped')`, and after it reports `onDone`. `VoiceDropReason`'s `stopped` says "stopped, released or `cancelKey`ed before it came due".
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: the not-yet-heard check lives in release() only
- confidence: likely

## A tiny insert fade finishes inside afterRamp, and the pump then keeps a stale cancel for the next fade
- where: packages/audio/src/insertPump.ts:49 (createInsertPump.pump)
- scenario: `insertFadeMs: 0.0005` (checkSpan accepts any finite value ≥ 0) with the context running. `fade()` returns 0.0005. `afterRamp` → `atAudioTime` sees `left = 5e-7 ≤ 1e-6` and calls its callback synchronously. That callback sets `busy = false` and `cancel = null`, runs `finish()`, and calls `pump()` again, which starts the next step and stores that step's canceller in `cancel`. Control then returns to the outer `cancel = afterRamp(...)`, which overwrites it with the first step's canceller, already spent. A later `stop()` (bus graph or engine dispose) cancels nothing. The live fade's timer fires after `route.drop()` and runs `finish` on links that are already cut: `l.from.disconnect(l.gain)` throws, and `links.splice(links.indexOf(l), 1)` with index -1 removes an unrelated link. The cancel should be assigned before the callback can run, or `fade()` should treat a span this small as 0.
- evidence: read
- severity: low
- fix: packages/audio/src/insertPump.ts
- size: line
- cause: cancel assigned after a callback that can run synchronously
- confidence: likely

## A stream's rate outside the media element's supported range throws a DOMException that setRate does not document
- where: packages/audio/src/streamStarter.ts:99 (createStreamStarters.starter start / voice.retune)
- scenario: `engine.stream(url, { rate: 20 })` passes `checkRate` (any positive finite number). At start, `el.playbackRate = 20` throws `NotSupportedError` in Chromium, whose supported range is 0.0625..16, so the voice drops as `failed`. On a playing stream, `handle.setRate(20)` sets `voice.rate` first and then throws that DOMException out of `retune`, where `VoiceHandle.setRate` promises a `RangeError` only for a rate that is not a positive finite number. The buffer and synth paths accept the same rate. The fix is either to clamp to the element's range or to check it at the call.
- evidence: read
- severity: low
- fix: packages/audio/src/streamStarter.ts, packages/audio/src/voices.ts
- size: function
- cause: element playbackRate range unchecked
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

<!-- done: 3 findings, files read: 47 -->
