# Audit round 78 — audio — findings

## A voice's chain gain is not seeded on `.value`, so a `setGain` ramp right after `play` starts from 1 (or the last voice's level), not from the play's gain
- where: packages/audio/src/voiceChains.ts:45 (createChainPool, take)
- scenario: `const v = engine.play(s, { gain: 0 }); v.setGain(1, 2000);` in one task — the classic fade-in. `take` writes the gain only through `writeParam` (`setValueAtTime(0, now)`), never `.value`. `setGain` → `level` → `writeParam` cancels events at ≥ now (removing that `setValueAtTime(0, now)`) and anchors the ramp at `param.value`, which is still 1 on a fresh `GainNode` (no render quantum has run) or whatever the previous voice left on a reused chain (e.g. 0.3, or 0 after a fade). The voice starts at full level with no fade-in, or at the stale level. Should start at 0 and ramp. `initParam` exists for exactly this trap and `insertRoute.link`/`buildSlot` both set `.value` first; `take` does not.
- evidence: read (Web Audio: `.value` getter reports the current value, which a `setValueAtTime` updates only at render; `cancelScheduledValues(t)` removes events at ≥ t)
- severity: high

## `writeParam` anchors a ramp at `param.value`, which lags any write made earlier in the same task, so the second of two writes in one task ramps from the pre-task value
- where: packages/audio/src/param.ts:20 (writeParam)
- scenario: `engine.bus('music').setGain(0); engine.bus('music').setGain(1, 3000);` in one task (fade a bus in). The first write is `setValueAtTime(0, now)`; the second cancels it (time ≥ now) and anchors at `param.value`, still 1, so it "ramps" 1 → 1 and the bus never fades in. Same for a voice `setGain(0)` then `setGain(1, ramp)`, and for `place()` re-writing a level right after a `setGain`. The doc says writeParam's anchor fixes the "second ramp jumps" trap; within one task it does not.
- evidence: read (inference from Web Audio semantics)
- severity: medium

## Worklet voices' `onended` (and so the consumer's `onDone`) fires synchronously inside `engine.dispose()`; an `onDone` that throws aborts the rest of dispose
- where: packages/audio/src/worklet/workletVoices.ts:149 (createWorkletVoices, dispose) via workletSource.end
- scenario: `synthVoices: 'worklet'`, a playing note with `onDone: () => engine.analyser()` (or any throw). `engine.dispose()` sets `disposed`, runs `voices.stopAll`, then `synth.dispose()` → `source.end()` → `fire()` calls `onended` → `teardown` + `onDone` synchronously; `analyser()` throws "engine is disposed", which propagates out of `dispose()` before `patches.dispose()`, `graph.dispose()`, `graph.master.disconnect()` and `ctx.close()`. Since `disposed` is already true, a second `dispose()` returns early, so the context and graph leak for good. `SourceLike` promises `onended` "fires asynchronously, once", and `mediaSource` queues it for this very reason ("the engine may be inside the teardown"); `end()` should queue too.
- evidence: read
- severity: medium

## A node synth voice started late (its `when` already past) skips its attack and loses part of its gate; a worklet or buffer voice plays whole
- where: packages/audio/src/synthStarters.ts:31 (synthStart) with envelopeOnParam in synthVoice.ts
- scenario: a pattern step fires up to a step late (stalled main thread; `missedSteps` keeps it), or an `engine.schedule` callback fires late on resume and hands its original `when` to `playNote`. `synthStart` uses `t0 = when` in the past: the oscillators start now, but the envelope's `setValueAtTime(0, t0)` / `linearRamp(1, t0 + attack)` already lie in the past, so the gain is at the sustain level from the first sample (the click the 5 ms default attack avoids), and `stopAll(t0 + gate + release)` cuts the note short by the lateness. A worklet voice (kernel counts from its own first sample) and a buffer voice (`start(past)` plays from offset 0) play the whole sound, so one call answers two ways depending on `synthVoices`.
- evidence: read (inference from Web Audio automation semantics)
- severity: medium

## `BusHandle.setGain(v)` without a ramp is skipped while a ramp to `v` is in flight, so it cannot snap the bus to its target
- where: packages/audio/src/buses.ts:108 (createBusGraph, apply)
- scenario: `bus.setGain(0, 2000)` (fade out), then `bus.setGain(0)` to cut it now. `apply(undefined)` sees `ramp?.bus !== s` and `value === s.written` (0 was recorded when the ramp was written) and skips the write, so the 2 s fade carries on. A step write should cancel the ramp and set the value at once, as `writeParam` with no ramp does everywhere else.
- evidence: read
- severity: low

## `AnalyserTap.dispose()` throws when the tapped node was disconnected elsewhere first
- where: packages/audio/src/analyser.ts:101 (createAnalyserTap, dispose)
- scenario: `const tap = createAnalyserTap(ctx, myNode); myNode.disconnect(); tap.dispose();` — `source.disconnect(node)` throws `InvalidAccessError` because the edge is gone, so a teardown that disconnects its graph before its taps throws. `insertSlot.destroy` wraps the same targeted disconnect in try/catch for this case; the tap does not, and its doc says idempotent.
- evidence: read
- severity: low

## Linear rolloff reaches 0 at `maxDistance` only when `rolloffFactor` is 1, against the option's doc
- where: packages/audio/src/spatialize.ts:78 (spatialize)
- scenario: `rolloff: 'linear', rolloffFactor: 0.5, refDistance: 1, maxDistance: 100`: at distance 100 the gain is 0.5, and it keeps falling past `maxDistance` to reach 0 at 199. The doc says `maxDistance` is "Distance at which linear rolloff reaches 0". (A `PannerNode`'s linear model instead clamps the distance at `maxDistance`, holding 1 − factor.) Either the doc or the clamp is wrong.
- evidence: read
- severity: low

## `scoreBar`'s `gain` is documented as the most one step's notes add up to, but releases crossing the bar line and mid-bar bass take it past that
- where: packages/audio/src/scoreBar.ts:96 (scoreBar)
- scenario: a pulsed score with 4 layers: at step 8 the new bass (0.3) starts while the step-0 bass (0.3, release 120 ms) is still in release, beside the ostinato (0.4), the previous ostinato's tail and the pad (0.15); at step 0 the previous bar's pad (release 200 ms) also overlaps the new pad. The sum reaches about 1.2–1.4 × `gain`, not "at most" `gain`.
- evidence: read (arithmetic on the layer levels and envelopes)
- severity: low

## `engine.analyser('')` taps the master, not the bus named ''
- where: packages/audio/src/createAudioEngine.ts:288 (analyser)
- scenario: `createAudioEngine({ buses: ['', 'fx'] })` is accepted by `checkBusNames`; `engine.analyser('')` tests `busName ?` truthiness and taps `graph.master`, while `graph('')`, `bus('')` and `play({ bus: '' })` all use the '' bus (`??`). One question answered two ways.
- evidence: read
- severity: low

## `patternVoicePeaks` returns a plain object keyed by bus name, so looking up a bus the pattern does not use can return an `Object.prototype` member
- where: packages/audio/src/patternLoad.ts:77 (patternVoicePeaks)
- scenario: buses `['sfx', 'constructor']`, a pattern only on `sfx`: `peaks['constructor'] ?? 0` gives `Object`, a function, not 0, so `peaks[bus] > voiceLimit` compares a function. A user-keyed table should be null-prototype (or a Map).
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

<!-- done: 10 findings, files read: 47 -->
