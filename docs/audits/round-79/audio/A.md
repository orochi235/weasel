# Audit round 79 — area `audio` (reviewer findings)

## patternVoicePeaks hangs when any event's span is infinite
- where: packages/audio/src/patternLoad.ts:51-62 (patternVoicePeaks)
- scenario: a looping buffer hit (`{ step: 0, sound, loop: true }`) with `hitMs: (h) => h.loop ? Infinity : 100`, the natural answer for a hit that never stops, makes `longest` Infinity and `passes = Math.ceil(Infinity / passMs)` Infinity. The loop `for (let pass = 0; pass <= passes; pass++)` then pushes edges forever, so the call hangs and grows memory until the tab dies. A note or noise with `length: Infinity` or an envelope `release: Infinity` does the same: neither is validated here (`resolveEnvelope` clamps only the low end, and nothing calls `checkShaping`). It should throw a `RangeError`, or count such a voice as held from its start with no more passes. A `NaN` from `hitMs` fails the other way: `passes` is NaN, the pass loop never runs, and that bus is reported as 0 voices.
- evidence: read
- severity: medium

## A node synth voice released before it sounds is silent, where the worklet voice plays a release blip
- where: packages/audio/src/synthStarters.ts:44-50 (synthStart, `voice.release`); compare packages/audio/src/voiceKernel.ts:113-116 (createKernel release)
- scenario: `synthVoices: 'nodes'`, the note `{ envelope: { attack: 0, decay: 200 }, when: now()+80 }` is started by the scheduler a lookahead early. `release()` is then called at `now`, before `t0`. The node path releases from `at = ctx.currentTime`, not from `max(at, t0)`. It reads level 1 at elapsed 0, ramps it to 0 by `now+30ms`, and books `stop(now+30ms)` before the oscillator's `start(t0)`, so the note never sounds. The same call on a worklet voice sets the kernel's gate to 0 and plays a 30 ms release tail from level 1 at `t0`. So one note and one `release()` give two different results depending on `synthVoices`, which `AudioEngineOptions.synthVoices` says behave alike.
- evidence: read
- severity: low

## `loadAll` returns a record with a prototype, so a misspelled key finds an `Object.prototype` member
- where: packages/audio/src/soundCache.ts:66-70 (loadAll)
- scenario: `const s = await engine.loadAll({ hit: '/hit.wav' }); engine.play(s.constructor)` (or `s.toString`, `s.valueOf`) hands `play` a function rather than `undefined`. The voice is dropped, but the warning names the function source as the sound id. Any `key in s` or `s[key] ?? fallback` check by a consumer finds a value that is not a handle. `patternVoicePeaks` already returns a null-prototype record for this reason. `loadAll` should do the same: `Object.assign(Object.create(null), …)`.
- evidence: read
- severity: low

## The timer-delay ceiling is defined twice
- where: packages/audio/src/audioTime.ts:14 (MOST_TIMER_MS)
- scenario: `MOST_TIMER_MS = 2 ** 31 - 1` repeats `LONGEST_TIMER_MS` from `@weasel-js/registry`. `scheduler.ts` and `tickTimer.ts` in this same package import the registry's constant. If one of the two changes, `atAudioTime` would clamp against a different limit from the scheduler's interval check and the worker's re-wait.
- evidence: read
- severity: low

## A misplaced doc comment: `checkSteal` carries `checkVoiceLimit`'s doc
- where: packages/audio/src/voicePool.ts:46-47 (checkSteal / checkVoiceLimit)
- scenario: "Throws unless `limit` is a whole number, 1 or more." sits directly above `checkSteal`'s own doc block, and `checkVoiceLimit` has no doc at all. An editor hover on `checkSteal` (exported, and imported by the engine) can show the limit text, and `checkVoiceLimit` documents nothing.
- evidence: read
- severity: low

## A misplaced doc comment: `checkEventSteps` carries `eventsByStep`'s doc
- where: packages/audio/src/patternPlayer.ts:107-108 (checkEventSteps / eventsByStep)
- scenario: "`events` under the step each starts in." describes `eventsByStep`, but it is stacked above `checkEventSteps` (exported, and used by `patternLoad`) with that function's own doc, and `eventsByStep` is left undocumented.
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

<!-- done: 6 findings, files read: 47 -->
