# Audit round 78, area `audio` — findings

## A bus gain step asked for during a ramp to the same value is dropped, so the slow ramp keeps running
- where: packages/audio/src/buses.ts:110 (createBusGraph, apply)
- scenario: `bus.setGain(0, 5000)` starts a five-second fade and sets `written = 0`. A moment later `bus.setGain(0)` (no ramp) asks for silence now. `apply(undefined)` reaches the bus with `ramp?.bus !== s` true and `value === s.written` (0 === 0), so it `continue`s and writes nothing. The fade keeps going for the full five seconds when it should step to 0 at once. The same happens for any value: a step to the value a ramp in flight is heading for never lands.
- evidence: read
- severity: medium

## A mute or solo toggled during a bus gain ramp snaps the bus to the ramp's end instead of resuming the ramp
- where: packages/audio/src/buses.ts:105 (createBusGraph, apply)
- scenario: `bus.setGain(0.2, 3000)` ramps from 1 down, and `written` becomes 0.2. Within the ramp, `other.solo(true)` steps this bus to 0, then `other.solo(false)` runs `apply()` with no ramp: the value is 0.2, not 0, so `writeParam` steps straight to 0.2 and the remaining ramp is lost. The same happens for `mute(true)` then `mute(false)`. Voices made the opposite call for the same situation: `place` in voices.ts reschedules an interrupted `setGain` ramp to its original end through `rampEnd`. So one question (does a level write cancel a ramp still owed?) is answered two ways in two places.
- evidence: read
- severity: low

## A score's chord progression restarts on every cue change, because `createScore` passes the cue's bar count where `scoreBar` wants bars since the start
- where: packages/audio/src/score.ts:72 (createScore, eventsOf) → packages/audio/src/scoreBar.ts:78 (scoreBar)
- scenario: `scoreBar(params, bar)` documents `bar` as "bars since the score began: it picks the chord, by the harmonic rhythm, and how many layers…". `ScoreState.cueBar` is documented as what "a pulsed score's layers build up from". `eventsOf` passes `state.cueBar` for both. Take a score in bar 3 of a progression with harmonicRhythm 1 (on chord IV) whose mood crosses into another cue: `cueBar` resets to 0, so the next bar jumps back to the tonic chord (`PROGRESSION[0]`) mid-phrase rather than going on to the next chord. The layer build-up resetting is intended; the harmony resetting with it contradicts both docs.
- evidence: read
- severity: low

## Linear rolloff keeps falling past `maxDistance` when `rolloffFactor` is below 1
- where: packages/audio/src/spatialize.ts:72 (spatialize)
- scenario: With `{ rolloff: 'linear', refDistance: 1, maxDistance: 100, rolloffFactor: 0.5 }`, a source at distance 100 gets gain 0.5 and a source at distance 199 gets gain 0, because `distance` is never clamped to `maxDistance`. A `PannerNode`'s linear model clamps distance to `[ref, max]`, so gain stops falling at `max`: 1 − 0.5 = 0.5 there and beyond. `maxDistance`'s own doc ("distance at which linear rolloff reaches 0") does not hold for any factor except 1.
- evidence: read
- severity: low

## The exported `patternLength` accepts any `stepsPerBeat` and returns NaN or a fractional length
- where: packages/audio/src/patternPlayer.ts:97 (patternLength)
- scenario: `patternLength(events, 0)` gives `Math.max(1, Math.ceil(x / 0)) * 0` = `Infinity * 0` = NaN, and `patternLength(events, 2.5)` gives a non-whole step count. The player and `patternVoicePeaks` both run `checkSteps('steps per beat', …)` before calling it, but `patternLength` is public API (index.ts) and checks only the event steps. It should throw a `RangeError` the way its siblings do.
- evidence: read
- severity: low

## An unknown `steal` policy is silently treated as `'oldest'`
- where: packages/audio/src/voicePool.ts:62 (createVoicePool, victim); packages/audio/src/createAudioEngine.ts:240 (createAudioEngine)
- scenario: `createAudioEngine({ steal: 'quiet' })` (a typo, or a JS caller) is not checked anywhere. `victim()` uses `steal === 'quietest' ? rec.gain : rec.startedAt`, so the engine evicts the oldest voice with no warning. Every other engine option (lookahead, interval, voiceLimit, bus names, fade) throws at construction. The listener's `rolloff` in `checkListener` has the same gap: any value other than `'linear'` runs as inverse.
- evidence: read
- severity: low

## Effect options that are not finite throw a TypeError from the AudioParam rather than the package's RangeError
- where: packages/audio/src/param.ts:79 (initParam), reached from packages/audio/src/effects.ts:29,165,218 (createFilterEffect, createDelayEffect, createCompressorEffect)
- scenario: `createFilterEffect(ctx, { frequency: NaN })` runs `initParam`, which assigns `param.value = NaN` *before* `writeParam` gets to `checkParam`. `AudioParam.value` is a restricted `float`, so the browser throws its own `TypeError`, and the package's `RangeError` ("a param is set to a finite value…") is never reached. A caller catching `RangeError`, which is how every other non-finite audio input is reported, misses it. Checking first, then assigning `.value`, fixes it.
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

<!-- done: 7 findings, files read: 47 -->
