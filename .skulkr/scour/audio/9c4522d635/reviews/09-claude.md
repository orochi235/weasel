# audio — blind review findings

## stop(), cancelKey and stopAll report a voice started early by the lookahead but never heard as onDone, where release() reports it as onDrop('stopped')
- where: packages/audio/src/voices.ts:148 (startVoice / voiceHandle.stop)
- scenario: a voice with `when` 80 ms ahead is started by the scheduler inside its lookahead (source created, `start(when)`). Calling `release()` before `when` takes the branch at voices.ts:178–183: it nulls `onended`, tears down and reports `onDrop('stopped')`. Calling `stop()` (or `stop(fadeMs)`, `cancelKey`, `stopAll`, or a steal) on the same voice tears down with `onended` still set; the source raises `ended` even though it was stopped ahead of its start (endedBeforeStart.browser.test.ts confirms this), so `onDone` fires and `onDrop` never does. One question, "did this voice play?", gets two answers depending on which call ended it. `VoiceDropReason` documents `stopped` as "stopped, released or cancelKeyed before it came due", and `onDone` as "stopped... after it started". With `stop(fadeMs)` the fade ends before `when`, so nothing is heard either, and it still reports `onDone`.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: the not-yet-heard check lives only in release()
- confidence: likely

## A voice whose start throws has already stolen a sounding voice
- where: packages/audio/src/voices.ts:133 (startVoice)
- scenario: on a full bus, `startVoice` acquires a slot and tears down the victim (line 133) before calling `starter.start`. If the start then throws, the new voice is torn down as `failed` and the stolen voice stays dead, so a play that never sounded silences one that was playing. Ways a start can throw: a stream whose element is already routed into another AudioContext (`createMediaElementSource` throws), or a stream `rate` the element refuses (see the next finding).
- evidence: read
- severity: low
- fix: packages/audio/src/voices.ts
- size: function
- cause: steal is committed before the start succeeds
- confidence: likely

## A stream's rate passes checkRate but makes the element's playbackRate setter throw a non-RangeError
- where: packages/audio/src/streamStarter.ts:91 (createStreamStarters.starter / retune)
- scenario: `engine.stream(el, { rate: 20 })` or `handle.setRate(20)` on a stream voice passes `checkRate` (any positive finite number is accepted). `el.playbackRate = 20` then throws `NotSupportedError` in Chromium, which only accepts roughly 0.0625–16. At start that fails the voice, after a steal; on `setRate` the throw escapes with `voice.rate` already set to 20. The setter is documented as throwing a RangeError only on a rate that is not positive and finite. The node voices accept any finite rate (the node clamps it), so one rate gets two answers.
- evidence: read
- severity: low
- fix: packages/audio/src/streamStarter.ts, packages/audio/src/voices.ts
- size: function
- cause: media element rate range not checked or clamped
- confidence: likely

## The 'quietest' steal policy ranks a fading or releasing voice at its pre-fade gain
- where: packages/audio/src/voices.ts:167 (voiceHandle.stop / release)
- scenario: a voice on `steal: 'quietest'` is given `stop(2000)` and ramps toward 0. The pool's record keeps `baseGain * spatialGain` (poolGain is never called with 0 on fade or release), so when the bus is full, `victim()` picks a quieter voice that is still sounding rather than the one that is already on its way out. `VoiceRecord.gain` is documented as "Current gain, consulted by the 'quietest' steal policy".
- evidence: read
- severity: low
- fix: packages/audio/src/voices.ts
- size: line
- cause: pool gain not updated on fade or release
- confidence: likely

## checkScoreMood lets a missing axis through, so every bar's notes throw
- where: packages/audio/src/scoreMood.ts:59 (checkScoreMood)
- scenario: `score.setMood({ valence: 0.5, tension: 0.2 })` from JS, or a mood built by spreading an object with an `undefined` axis. `Number.isNaN(undefined)` is false, so the check passes. `clamp(undefined, 0, 1)` then gives NaN, `resolveScoreMood` returns a NaN register and tempo, and `player.setTempo(NaN)` throws inside `beforeStep`. The pattern player catches that and keeps going on the old tempo, but every note's `{ midi: NaN }` pitch throws in `toFrequency`. The result is a silent score that logs an error on every step, not one RangeError at `setMood`.
- evidence: read
- severity: low
- size: line
- cause: NaN check instead of a finite-number check
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

<!-- done: 5 findings, files read: 47 -->
