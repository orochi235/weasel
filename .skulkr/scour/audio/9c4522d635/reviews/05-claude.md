## `stop()`, `cancelKey` and `stopAll` on a voice started ahead by the lookahead report `onDone`, not `onDrop('stopped')`, unlike `release()`
- where: packages/audio/src/voices.ts:178 (voiceHandle.stop), packages/audio/src/voices.ts:65 (teardownVoice)
- scenario: `play(sound, { when: now() + 80, onDone, onDrop })`, then `handle.stop()` 20 ms later. The scheduler's lookahead has already run `startVoice`, so `voice.source` is set; `teardown` stops the source without `reportDrop`, and the source's `onended` calls `onDone` for a voice nobody heard. The same `stop()` a few ms earlier, before the pass, reports `onDrop('stopped')` and no `onDone`. `release()` was ruled (docs/unruled.md, 2026-11-23) to cancel in exactly this window with `onDrop('stopped')` because otherwise "the same call cancels or sounds depending on lookahead timing the caller cannot see"; `stop()`, `engine.cancelKey` and a pattern/score `stop()` (which goes through `cancelKey`) still answer it the other way. `VoiceDropReason`'s `stopped` says "stopped, released or `cancelKey`ed before it came due".
- evidence: read
- severity: medium
- fix: packages/audio/src/voices.ts
- size: function
- cause: pre-`when` cancel check exists only in `release()`
- confidence: likely

## An insert effect whose nodes cannot be wired wedges the whole chain: `add` throws but leaves the slot in `order`, and every later edit throws again
- where: packages/audio/src/inserts.ts:130 (chain.add), packages/audio/src/insertSlot.ts:27 (buildSlot)
- scenario: `bus.inserts.add({ input: nodeFromAnotherContext, output: … })` (an effect built on an `OfflineAudioContext`, say). `used.add(effect)` and `order.splice` happen, then `pump()` → `spliceIn` → `buildSlot` → `n.in.connect(effect.input)` throws `InvalidAccessError`. The slot stays in `order` with `nodes: null`, so every later `add`, `moveTo`, `remove` or `clear` on that bus calls `pump()`, whose `nextStep` returns the same `in` step and throws again; `settled()` never resolves. The effect is also marked used forever. Expected: a failed add leaves the chain as it was.
- evidence: read
- severity: low
- fix: packages/audio/src/inserts.ts, packages/audio/src/insertRoute.ts
- size: function
- cause: state committed before the throwing splice
- confidence: likely

## Partials whose gains sum past the double range normalize to 0, so a note with large gains is silent
- where: packages/audio/src/synthVoice.ts:107 (resolvePartials)
- scenario: `playNote({ pitch: 'A4', wave: { partials: [{ ratio: 1, gain: 1e308 }, { ratio: 2, gain: 1e308 }] } })`. `total` overflows to Infinity, each `gain / total` is 0, and both the node path and the kernel play silence. Only the ratios are meant to matter ("scaled so their levels sum to 1"), as `toUnitPeak` already ensures for harmonic levels.
- evidence: read
- severity: low
- fix: packages/audio/src/synthVoice.ts
- size: line
- cause: sum not scaled by largest gain first
- confidence: sure

## `resolveEnvelope` passes NaN through, though it promises every value in range
- where: packages/audio/src/envelope.ts:24 (resolveEnvelope)
- scenario: `resolveEnvelope({ sustain: NaN })` returns `sustain: NaN` (`Math.min(1, Math.max(0, NaN))` is NaN), and `envelopeLevel` / `envelopePoints` on it return NaN levels. It is exported and its type says "every default filled in and every value in range". Voice paths are guarded by `checkEnvelope`, so this bites a direct caller only.
- evidence: read
- severity: low
- size: line
- cause: Math.min/max do not clamp NaN
- confidence: sure

## `createNoiseKernel` / `renderNoise` read past the loop when `random` returns 1 (or a negative), writing NaN
- where: packages/audio/src/voiceKernel.ts:186 (createNoiseKernel)
- scenario: `renderNoise({ noise: 'white', duration: 50 }, 48000, () => 1)`. `at = floor(1 * loop.length) = loop.length`, `loop[at]` is undefined, and the first sample is NaN. A negative return does the same at every sample until `%` brings it back in range. The `random` parameter's doc states no range, and the node path (`random() * duration` as a start offset) plays fine with 1, so the two paths disagree.
- evidence: read
- severity: low
- size: line
- cause: start index not wrapped into the loop
- confidence: sure

## A `load` in flight when the engine is disposed refills the cleared sound cache, and `load` after dispose still fetches and decodes
- where: packages/audio/src/soundCache.ts:52 (load), packages/audio/src/createAudioEngine.ts:316 (dispose)
- scenario: `engine.load('big.ogg')`, then `engine.dispose()` before it resolves. `sounds.clear()` empties the maps, then the task resolves and does `buffers.set` / `byUrl.set`, so the decoded buffer stays held by a disposed engine for as long as anything references the engine. `engine.load` after `dispose()` also fetches and decodes with no disposed check, unlike `analyser` and `graph`, which throw.
- evidence: read
- severity: low
- fix: packages/audio/src/soundCache.ts, packages/audio/src/createAudioEngine.ts
- size: function
- cause: no disposed state in the cache
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
