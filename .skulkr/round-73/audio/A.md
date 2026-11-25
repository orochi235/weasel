# Audit round 73 — audio

## An invalid `voiceLimit` or an empty `buses` throws after the engine has created its own AudioContext, which leaks
- where: packages/audio/src/createAudioEngine.ts:230 (createAudioEngine; busSlots at :135)
- scenario: `createAudioEngine({ voiceLimit: 0 })` or `createAudioEngine({ buses: [] })` without `context`. `new AudioContext()` runs at :230, then the bus check (:234) or `createVoicePool`'s limit check (via `busSlots`, :237) throws. The comment at :227 says checks run "before anything is made", but these two run after. The context is never closed, and browsers cap how many live contexts a page can hold. Both checks should run before the context is made.
- evidence: read
- severity: medium

## `stopAll` and `dispose` skip the `catchUp` that `stop`, `release` and `cancelKey` run, so a worklet voice that is already sounding gets reported as dropped
- where: packages/audio/src/voices.ts:316 (createVoices.stopAll) vs :321 (cancelKey) and :173 (voiceHandle.stop)
- scenario: `synthVoices: 'worklet'`, and the main thread stalls past a note's `when`. The processor is playing the note, but the scheduler has not fired `startVoice`, so `voice.source` is still null. Then `engine.stopAll()` (or `dispose()`) runs. `teardownVoice` sees no source and calls `reportDrop(onDrop, 'stopped')`. `onDone` never fires, though the voice was heard. `cancelKey(key)` on the same voice calls `catchUp` first and reports it correctly. The two paths answer the same question differently.
- evidence: read
- severity: low

## On dispose, `onDone` never fires for a started worklet voice
- where: packages/audio/src/createAudioEngine.ts:310 (dispose) with packages/audio/src/worklet/workletVoices.ts:144 (dispose)
- scenario: A worklet note is playing and `engine.dispose()` runs. `stopAll` posts `stop` to the processor. `synth.dispose()` then posts `dispose` and nulls `port.onmessage`, so the processor's `ended` reply is never received and `onDone` never fires. A node voice in the same state gets `onDone` from its source's `onended`. `PlayOptions.onDone` promises the call for any voice "stopped … after it started".
- evidence: read
- severity: low

## `setPan` stops position tracking but keeps the last position's distance attenuation in the voice's level
- where: packages/audio/src/voices.ts:209 (voiceHandle.setPan)
- scenario: `play(s, { position: far })` gives `spatialGain` 0.05. `h.setPan(0)` then clears `position` but leaves `spatialGain` at 0.05. The voice stays almost silent, and every later `setGain(v)` writes `v * 0.05`. An explicit-pan voice launched the same way gets a spatial gain of 1 (:280). Two voices with identical explicit-pan options end up at different levels.
- evidence: read
- severity: low

## Duplicate names in `buses` leave a fader wired to master that nothing can reach
- where: packages/audio/src/buses.ts:76 (createBusGraph)
- scenario: `buses: ['sfx', 'sfx']`. Each loop pass creates a fader, connects it to `master` and builds an insert chain, and the second `states.set` overwrites the first. The first fader stays connected to master and is never disposed. The chain pool is also sized for two buses. Neither the engine nor `createBusGraph` rejects duplicates.
- evidence: read
- severity: low

## One effect object can be added to two buses' insert chains, so one bus's removal disposes it under the other
- where: packages/audio/src/inserts.ts:93 (createInsertChain, the `used` WeakSet)
- scenario: `bus('sfx').inserts.add(delay)`, then `bus('music').inserts.add(delay)`. The once-only guard is per chain, so both adds succeed and both buses' signals mix through one effect. A later `remove()` on sfx calls `delay.dispose()`, which disconnects the delay and its feedback loop, so music's slot silently loses its wet path. The doc says "An effect goes in one slot, once."
- evidence: read
- severity: low

## `patternVoicePeaks` returns `{}` for a pattern holding a non-finite step, where the player throws
- where: packages/audio/src/patternLoad.ts:41 (patternVoicePeaks)
- scenario: Events include `{ step: NaN, … }` and no `length` is given. `patternLength` returns NaN, and every span fails `Math.floor(e.step) < length`, so the result is `{}`: no voices on any bus. `createPatternPlayer`/`setEvents` throw a RangeError on the same events (`eventsByStep`). A caller sizing `voiceLimit` from the peaks gets "0 voices" for a pattern the player refuses.
- evidence: read
- severity: low

## The score names the wrong bar when a stall skips all of bar 0
- where: packages/audio/src/score.ts:84 (createScore beforeStep)
- scenario: The first `fire` lands more than 16 steps late, so `count` jumps to bar 1 or later. With `reported === -1` the code skips `stateAt`/`write`, so bar 0's events play and `onBar` receives `state.bar === 0` while the music is in bar ≥ 1. The next bar's `cueBar` is then counted from that wrong bar. `ScoreOptions.onBar` promises the skipped bar is reported at the first step it books.
- evidence: read
- severity: low

## Kernel voices do not check `gain`, so a NaN or Infinity gain renders the whole buffer as NaN
- where: packages/audio/src/voiceKernel.ts:93 (createKernel)
- scenario: `renderNote({ pitch: 'A4', duration: 100, gain: NaN }, 48000)` returns all-NaN samples. `checkShaping` and `resolveNote` validate every other number in the patch, and `tuning` checks rate and detune, but `patch.gain` reaches the output unchecked. `engine.playNote` checks gain via `checkVoice`, so the exported kernel API is the only path with this hole.
- evidence: read
- severity: low

## `createTickTimer` hands a computed delay straight to `setTimeout`, so `Infinity` fires at once
- where: packages/audio/src/tickTimer.ts:73 (arm) and the worker source at :8; also packages/audio/src/audioTime.ts:8 (defaultTimers)
- scenario: `createTickTimer` is public API. `createTickTimer().setTimer(cb, Infinity)`, or any delay past 2^31 − 1, fires `cb` on the next tick in both the fallback and the worker, instead of waiting through `after`. In-package callers clamp first (`atAudioTime`, the scheduler interval check), but an external caller has nothing protecting them.
- evidence: read
- severity: low

## `stream(url)` starts fetching the media before the play is checked, even when it then throws or drops
- where: packages/audio/src/streamStarter.ts:108 (restream)
- scenario: `engine.stream('big.mp3', { gain: NaN })` throws in `checkVoice`, or a locked context drops the play, after `streams.element` has already made an `Audio` element with `preload = 'auto'` and `src` set. The browser downloads and buffers the media for an element that is never played or returned. Repeated retries before unlock each start a new download.
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

<!-- done: 11 findings, files read: 47 -->
