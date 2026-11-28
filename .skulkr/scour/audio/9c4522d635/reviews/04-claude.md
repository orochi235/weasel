## `setTempo` called outside a step moves the already-booked step's end, unlike the in-`onStep` path
- where: packages/audio/src/patternPlayer.ts:285 (createPatternPlayer → setTempo)
- scenario: a player is running at 120 bpm (125 ms steps), and the step at T has been booked with its notes gated to 125 ms. A UI calls `setTempo(240)` between steps. `nextAt = max(lastAt + stepMs(), now)` puts the next step at T + 62.5 ms, using the new length, so it overlaps the booked step's notes. At 60 bpm it would leave a gap instead. Called from `onStep`, the same change books the next step at `when + ms`, the old length ("which keeps its own length"). The next step should come at `lastAt` plus the length that step was booked with.
- evidence: read
- severity: medium
- fix: packages/audio/src/patternPlayer.ts
- size: line
- cause: next time recomputed from the new tempo instead of the booked step's length
- confidence: likely

## `stop()` / `cancelKey` on a voice the lookahead started but nobody has heard yet call `onDone`, where `release()` reports `onDrop('stopped')`
- where: packages/audio/src/voices.ts:178 (voiceHandle.stop), packages/audio/src/voices.ts:333 (cancelKey)
- scenario: `play(sound, { when: now() + 50, onDone, onDrop })`. The microtask flush runs `startVoice`, so the voice has a source. Then `handle.stop()` (or `cancelKey`, or `stop(fadeMs)`) runs while `currentTime*1000 < when`. Teardown sees a source, so no drop is reported, and `source.onended` is still set, so `onDone` fires for a voice that never sounded. `release()` in the same window nulls `onended`, tears the voice down and reports `onDrop('stopped')`. docs/unruled.md (2026-11-23, round 80) rules this cancel for `release()` because "the same call otherwise cancels or sounds depending on lookahead timing the caller cannot see". `stop`/`cancelKey` still behave that way: before the flush they report `onDrop('stopped')`, after it they call `onDone`.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: "not yet heard" cancel applied in release() only
- confidence: likely

## Stopping or cancelling a booked worklet voice can steal an unrelated sounding voice on a full bus
- where: packages/audio/src/voices.ts:179 (voiceHandle.stop → voice.catchUp), packages/audio/src/voices.ts:328,336 (stopAll/cancelKey)
- scenario: `synthVoices: 'worklet'`, and the bus already holds `voiceLimit` sounding voices. Then `const v = engine.playNote({ pitch: 'A4' }); v.stop();` runs in the same task (or `engine.cancelKey(k)` on a just-played keyed note). `when === bookedAt`, so `catchUp`'s `currentTime*1000 >= when` holds. It calls `begin` → `startVoice` → `pool.acquire`, which steals and tears down the oldest sounding voice. The new voice is then torn down, and its stop reaches the processor in the same batch as its note, so it never renders. Net effect: cancelling a silent note kills an audible one. In node mode the same calls find `source === null` and steal nothing. That breaks the `synthVoices` doc's promise that stealing behaves as a node voice's does. The canceled worklet voice also ends through `onDone` rather than `onDrop('stopped')`.
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: catch-up acquires a pool slot for a voice that is about to be torn down
- confidence: likely

## `patternVoicePeaks` leads each voice by `lookahead` only, but the slot is taken up to `lookahead + tickInterval` early
- where: packages/audio/src/patternLoad.ts:52 (patternVoicePeaks, `lead`)
- scenario: a step's booking is a `waited` scheduler entry, so it fires on a pass anywhere in (at − lookahead − interval, at − lookahead]. Its voices are booked inside the window and take their slots at that microtask. Take a voice ending at t and the next voice on its bus sounding at t + lookahead + 10 ms: the computed spans don't overlap, but the engine can hold both slots at once. The peak is then one short, and against `voiceLimit` it fails to warn of a steal. Neither `tickInterval` nor the pass jitter shows up in the options.
- evidence: read
- severity: low
- fix: packages/audio/src/patternLoad.ts
- size: line
- cause: pass interval jitter not in the lead
- confidence: likely

## `setEvents(events, length)` from `beforeStep` applies the new events to a step index computed with the old length
- where: packages/audio/src/patternPlayer.ts:220 (fire: `step = count % length` read before `beforeStep`)
- scenario: a loop of length 16 at count 12. `beforeStep` calls `setEvents(newEvents, 8)`. `step` is still 12, so `byStep.get(12)` of the new 8-step pattern plays (nothing, or an event past its length that should never sound), and `onStep` reports step 12 of an 8-step pattern. The `!loop && count >= length` end check also ran against the old length. `beforeStep`'s doc promises "events ... set here apply to this step".
- evidence: read
- severity: low
- fix: packages/audio/src/patternPlayer.ts
- size: line
- cause: step derived before the hook that may change length
- confidence: likely

## `SoundCache.clear()` (and so `engine.dispose()`) leaves in-flight loads that store a buffer afterward
- where: packages/audio/src/soundCache.ts:89 (clear)
- scenario: `engine.load(url)` is pending on a context the consumer owns, which stays open. `engine.dispose()` runs `sounds.clear()`. The fetch and decode then finish and `store()` writes the buffer into `buffers`, `byUrl` and `urlById` of a cleared cache, which keeps it for as long as the engine object lives. A later `load(url)` within that window returns the handle. `inflight` is never cleared and the task has no cleared flag.
- evidence: read
- severity: low
- size: function
- cause: clear() ignores in-flight tasks
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

<!-- done: 6 findings, files read: 47 -->
