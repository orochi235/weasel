I couldn't write `.skulk/out/findings.md`: permission to create `.skulk/out` and write the file was denied. As the brief allows, here is the whole document.

# Audit round 37: area `audio`

## Synth patch numbers aren't checked when `playNote`/`playNoise` is called: node voices throw when they start, worklet voices fill their bus with NaN
- where: packages/audio/src/envelope.ts:24 (resolveEnvelope); packages/audio/src/synthVoice.ts:82 (resolvePartials), :111 (resolveNote); packages/audio/src/voiceKernel.ts:59 (filterStage), :117 (createNoteKernel), :85 (createKernel); packages/audio/src/worklet/workletVoices.ts:127 (note)
- scenario: `playNote({ pitch: 'A4', envelope: { attack: NaN } })`. The same happens with `duration: NaN`, `glide: { to: 'A5', ms: NaN }`, `filter: { frequency: NaN }` (or NaN `Q`, `gain` or `amount`), a partial with `gain: NaN`, or a partial with `decay: Infinity` (which passes `p.decay > 0`). None of these is checked when the call is made: `resolveEnvelope` keeps NaN because `Math.max(0, NaN)` is NaN, and `resolvePartials` checks only `ratio` and `decay > 0`. On nodes, the AudioParam call throws a TypeError when the scheduler fires, so the voice drops as `failed`. Examples are `linearRampToValueAtTime(…, NaN)`, `setValueAtTime(NaN)`, `stop(NaN)` and `setTargetAtTime(0, t0, Infinity)`. With `synthVoices: 'worklet'`, the kernel computes NaN levels, NaN filter coefficients or a NaN gate, and the mixer adds that NaN into the bus's left and right buffers, which silences every other voice on that bus. `param.ts`'s `checkFinite` exists to prevent exactly this ("the voice processor would mix it into its whole bus as NaN"), and `SynthStarters.note` promises to throw "at the call rather than when it comes due". The two backends handle the same input differently.
- evidence: read
- severity: medium

## A negative or zero `setRate` on a synth voice: node notes throw a TypeError from the handle, worklet noise fills the bus with NaN
- where: packages/audio/src/synthStarters.ts:119 (note retune); packages/audio/src/voiceKernel.ts:166-171 (createNoiseKernel source); packages/audio/src/voices.ts:187 (setRate)
- scenario: `h = engine.playNote(…)`, then `h.setRate(0)` or `h.setRate(-1)`. `checkFinite` passes it. The node retune writes `osc.detune.value = detune + 1200*log2(0)`, which is -Infinity (NaN for -1), so the `float` attribute setter throws a TypeError out of `setRate`. `voice.rate` stays bad, so every later `setDetune` throws too. The handle documents only a RangeError for non-finite input. On the worklet, `setRate(-1)` on a `playNoise` voice drives `at = (at + tune) % loop.length` negative. `loop[Math.floor(at)]` is then `undefined`, `lerp` returns NaN, and the whole bus goes NaN. A node noise voice with the same rate just plays its buffer backwards. A worklet note at rate 0 is silent, where the node note throws.
- evidence: read
- severity: medium

## An empty harmonic `wave` isn't checked when the call is made: node voices throw at start, worklet voices are silent
- where: packages/audio/src/synthVoice.ts:111 (resolveNote); packages/audio/src/periodicWave.ts:16 (periodicWave); packages/audio/src/oscillator.ts:64 (harmonicShape)
- scenario: `engine.playNote({ pitch: 'A4', wave: [] })` returns a live handle, because `resolveNote` validates only inharmonic waves. On nodes, `createPeriodicWave` gets arrays of length 1 and throws IndexSizeError (Web Audio requires length ≥ 2). The voice drops as `failed` and the scheduler logs a thrown callback. On the worklet, `harmonicShape([])` finds a peak of 0, sets scale to 0, renders silence and reports no drop. `wave: [NaN]` also goes unchecked on both paths.
- evidence: read
- severity: low

## `stream()` stops the element's current stream before the new call is known to start
- where: packages/audio/src/createAudioEngine.ts:260-267 (stream)
- scenario: `engine.stream(el, { bus: 'typo' })` while `el` is already streaming. `checkVoice` passes, `streams.streaming.get(el)?.stop()` stops the music that was playing, and then `voices.launch` throws "unknown bus" from `requireSlots`. The comment on line 261 says the checks run "before the earlier stream stops", but the bus check comes after. The same ordering applies when the context is suspended or the engine is disposed: the old stream stops, the new one drops as `locked` or `disposed`, and the dropped handle is stored as the element's stream. The call should fail or drop without touching the voice that is playing.
- evidence: read
- severity: low

## A NaN axis in a `ScoreMood` throws a TypeError from `readScoreCue`, and a running score then fails on every step
- where: packages/audio/src/scoreMood.ts:64-75 (readScoreCue); packages/audio/src/score.ts:58, :113 (stateAt, setMood)
- scenario: `score.setMood({ valence: NaN, tension: 0.5, urgency: 0.5 })` is accepted without a check. `clamp(NaN)` is NaN, so every distance and raw weight is NaN, `raw.indexOf(Math.max(...raw))` is -1, and `SCORE_CUES[-1].name` throws a TypeError. That happens inside `onStep` at the bar line. `reported` never advances, so every later step's `onStep` calls `stateAt` again and throws again, which is 16 console errors per bar. `onBar` never fires again and the score keeps replaying the last bar it wrote. `createScore` with a NaN mood throws the same TypeError rather than a RangeError. The doc says out-of-range values are read as their nearest end but doesn't cover NaN, and nothing rejects it.
- evidence: read
- severity: low

## `lookahead`, `tickInterval` and `insertFadeMs` are not validated
- where: packages/audio/src/scheduler.ts:64-65, :94 (createScheduler/pass); packages/audio/src/inserts.ts:86, :95 (createInsertChain fade); packages/audio/src/createAudioEngine.ts:177 (engineClock)
- scenario: `createAudioEngine({ lookahead: NaN })` makes `horizon` NaN, so `entry.when <= NaN` is never true. No voice or `schedule` callback ever fires, and nothing warns. `tickInterval: Infinity`, or anything over 2^31−1 ms, reaches `setTimeout` directly (in the worker or the fallback), which fires at once, so the scheduler runs passes back to back. That is the computed-delay timer case `after` exists for. `insertFadeMs: NaN` makes `fade()` NaN, so `writeParam(…, NaN)` throws from inside `spliceIn` after `link()` has already wired the new route, which leaves the chain half-wired.
- evidence: read
- severity: low

## `StreamOptions.offset` isn't checked; a NaN offset throws from the scheduler
- where: packages/audio/src/streamStarter.ts:80 (starter.start); packages/audio/src/voices.ts:212 (checkVoice)
- scenario: `engine.stream(el, { offset: NaN })`. `checkVoice` doesn't look at `offset`. When the scheduler fires, `el.currentTime = NaN` throws a TypeError inside `starter.start`, so the voice drops as `failed` and the scheduler logs the error. The call itself should throw a RangeError, as every other non-finite voice option does.
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
packages/audio/src/worklet/voiceProcessor.gen.ts (header and grep only; it is one generated line)
packages/audio/src/worklet/voiceProcessor.ts
packages/audio/src/worklet/workletVoices.ts

<!-- done: 7 findings, files read: 46 -->