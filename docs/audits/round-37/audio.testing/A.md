## engineHarness keeps one timer slot, so any non-scheduler timer replaces (or clears) the scheduler's pass
- where: packages/audio/src/testing/engineHarness.ts:10-11 (engineHarness setTimer/clearTimer)
- scenario: `createAudioEngine` hands the same `timers` pair to the scheduler and to `createBusGraph`, `createStreamStarters` and `patchGraphs` (createAudioEngine.ts:218-241), which wait through `atAudioTime` (audioTime.ts:36). When an insert fade, a stream start or a patch transition arms `atAudioTime`, `pass = cb` overwrites the scheduler's pass; from then on `run` calls the `check` callback each 25 ms, and once it finishes nothing re-arms the scheduler, so later booked voices never fire. Its cancel calls `clearTimer`, which ignores the handle (always `1`) and nulls whatever is in the slot, again killing the scheduler. Expected: one entry per handle, as `graphHarness` keeps with its `Map`.
- evidence: read
- severity: medium

## dueToEnd ignores a buffer source's start offset and playback rate
- where: packages/audio/src/testing/fakeSources.ts:100 (dueToEnd)
- scenario: a non-looping source on a 1 s buffer started with `start(0, 0.5)` (the engine does this: synthStarters.ts:135, graph/sources.ts:35) and/or `playbackRate.value = 2` (createAudioEngine.ts:102) really ends at 0.5 s (or 0.25 s at rate 2); the fake ends it at `started[0] + duration` = 1 s, ignoring the offset it records in `offsets` and the rate. `onended` fires late, so tests of voice cleanup/voice counts after a seek or a pitched voice see the voice alive too long.
- evidence: read
- severity: medium

## FakeNode.connect records a duplicate connection, and one disconnect leaves it connected
- where: packages/audio/src/testing/fakeNode.ts:55-72 (node connect/disconnect)
- scenario: `a.connect(b); a.connect(b); a.disconnect(b)`. Web Audio ignores a second connection between the same output and input, so `a` is then unconnected. The fake pushes `b` twice into `connectedTo`/`connectedFrom`, and the targeted disconnect splices only one copy, leaving `a → b` in place; `edgeCount` and `allPaths` also count the double edge. A test then sees a live edge (or a doubled path) that a browser would not have.
- evidence: read
- severity: medium

## renderEngineStereo's `later` suspend collides with the worklet hold for an early `later.at`, and its failure is dropped
- where: packages/audio/src/testing/renderEngine.ts:48 and :56 (renderEngineStereo)
- scenario: `OfflineAudioContext.suspend` quantizes to the 128-frame render quantum and rejects a second suspend at the same quantized time (and any time ≥ the render length). With `synthVoices: 'worklet'` and `later.at` < 128/rate (e.g. 0), `suspend(later.at)` is registered first, so `suspend(0)` at :56 rejects and `await held` throws. With any `later.at` past the render length, the `void`-ed promise rejects unhandled and `later.run` silently never runs, so the test renders without the late action.
- evidence: read
- severity: low

## engineHarness.run overshoots durations that aren't multiples of 25 ms
- where: packages/audio/src/testing/engineHarness.ts:19-23 (run)
- scenario: `run(10)` advances the clock 25 ms; `run(30)` advances 50 ms. A test asserting that something has not happened yet at 10 ms sees state from 25 ms. Expected: the last step advances `ms - t`.
- evidence: read
- severity: low

## rmsEnvelope hangs on a window of 0 (or below)
- where: packages/audio/src/testing/spectrum.ts:109 (rmsEnvelope)
- scenario: `rmsEnvelope(x, 0)`: `i + 0 <= x.length` is always true and `i += 0` never advances, so the loop pushes `0` forever until memory runs out. A computed window (`Math.floor(rate * ms / 1000)` with a small ms) can reach 0. Expected: throw a RangeError, or return `[]`.
- evidence: read
- severity: low

## FakeBuffer.getChannelData returns undefined for an out-of-range channel instead of throwing
- where: packages/audio/src/testing/fakeAudioContext.ts:90 (createFakeBuffer)
- scenario: `ctx.createBuffer(1, 10, 48000).getChannelData(1)` returns `undefined`; a real `AudioBuffer` throws `IndexSizeError`. The file's header promises the fake throws where the spec says a real one throws, so code writing to a channel it never asked for crashes later with a TypeError (`undefined.set`) far from the cause, or passes silently if it only reads.
- evidence: read
- severity: low

## FakeNode.disconnect sets `disconnected` even when the targeted form throws
- where: packages/audio/src/testing/fakeNode.ts:61-66 (node disconnect)
- scenario: `a.disconnect(b)` with `b` not connected throws InvalidAccessError, but `a.disconnected` is already `true`. A test that catches the error and then asserts `disconnected` sees a cut that never happened.
- evidence: read
- severity: low

## Files read
packages/audio/src/testing/engineHarness.ts
packages/audio/src/testing/fakeAnalyser.ts
packages/audio/src/testing/fakeAudioContext.ts
packages/audio/src/testing/fakeMediaElement.ts
packages/audio/src/testing/fakeNode.ts
packages/audio/src/testing/fakeSources.ts
packages/audio/src/testing/fakeWorker.ts
packages/audio/src/testing/fakeWorklet.ts
packages/audio/src/testing/graphHarness.ts
packages/audio/src/testing/graphWalk.ts
packages/audio/src/testing/renderEngine.ts
packages/audio/src/testing/spectrum.ts
packages/audio/src/testing/worklet.ts

<!-- done: 8 findings, files read: 13 -->
