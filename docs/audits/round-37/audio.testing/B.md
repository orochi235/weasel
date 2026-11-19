# Audit round 37 — audio.testing findings

## A buffer source's end ignores its start offset and playback rate, so a resumed clip ends late in the fake
- where: packages/audio/src/testing/fakeSources.ts:100 (dueToEnd)
- scenario: the graph's clip source resumes a non-looping buffer with `start(when, offset)` (`graph/sources.ts:35`), e.g. a 1 s buffer at offset 0.9. A real node ends 0.1 s after `when`; `dueToEnd` computes `started[0] + duration` and ends it 1 s after `when`, so `onended` (and the graph's `onEnd` "played out" path) fires 0.9 s late in every test using the fake. `offsets` is recorded but never read here; `playbackRate.value` (set by the engine, `synthStarters.ts:139`) is likewise ignored, so a rate-2 clip ends at twice its real length.
- evidence: read
- severity: medium

## Connecting the same pair twice records two edges; Web Audio ignores the repeat
- where: packages/audio/src/testing/fakeNode.ts:55 (node → connect)
- scenario: `a.connect(b); a.connect(b)`. The spec ignores a duplicate output→input connection, so the graph holds one edge and one `a.disconnect(b)` removes it. The fake pushes `b` twice; `edgeCount` (graphHarness.ts:69) counts 2, `allPaths` returns the path twice, and after `a.disconnect(b)` the fake still shows `a → b` connected where a real graph has nothing. A test of reconnect idempotence passes or fails on the double's artifact rather than the code.
- evidence: read (spec behavior from the Web Audio specification's `connect()` definition)
- severity: medium

## A targeted disconnect that throws still marks the node disconnected
- where: packages/audio/src/testing/fakeNode.ts:61 (node → disconnect)
- scenario: `n.disconnect(notConnected)` sets `n.disconnected = true`, then throws InvalidAccessError. The node's connections are untouched, but a test asserting `disconnected` (the documented "disconnect has been called in any form") after a caught error sees `true` for a call a real implementation rejected without effect. The flag should be set after the validity check.
- evidence: read
- severity: low

## resume/suspend on a closed fake context succeed and reopen it
- where: packages/audio/src/testing/fakeAudioContext.ts:108-110 (resume, suspend, close)
- scenario: `await ctx.close(); await ctx.resume()` → fake state becomes 'running' and `statechange` fires. A real context rejects with InvalidStateError and stays 'closed'; the header promises the double "throws where the specification says a real implementation throws". An engine path that resumes after dispose/close would look like it revived the context in tests.
- evidence: read
- severity: low

## The analyser's function spec gets the read length, not the bin count, so a bin's value depends on the array size
- where: packages/audio/src/testing/fakeAnalyser.ts:17-19 (fill)
- scenario: with the default `_analyserBytes = (i, length) => 255*i/length`, reading 1024 frequency bins into a 1024 array gives bin 511 ≈ 127; reading into a 512 array gives bin 511 ≈ 255. On a real analyser bin i's value does not change with the output array's length. `spec(i, n)` should receive `bins`, not `min(out.length, bins)`.
- evidence: read
- severity: low

## stubWorkerGlobals' restore unstubs every global in the test, not just its own
- where: packages/audio/src/testing/fakeWorker.ts:73 (stubWorkerGlobals → restore)
- scenario: a test stubs `AudioContext` with `vi.stubGlobal`, then calls `stubWorkerGlobals()` and, mid-test, `restore()`. `vi.unstubAllGlobals()` also removes the `AudioContext` stub, so the rest of the test runs against the real (or absent) global. restore should put back only `Worker` and `Blob`.
- evidence: read
- severity: low

## FakeWorker._fail fires error listeners on a terminated worker; _reply does not
- where: packages/audio/src/testing/fakeWorker.ts:41 (_fail)
- scenario: code terminates a worker and the test then delivers `_fail()`; error listeners still run, whereas `_reply` after terminate is dropped. A terminated real worker delivers neither, so a test can see an error handler fire for a worker the code already disposed (or one that leaked its listener appears harmless only for messages).
- evidence: read
- severity: low

## The fake worklet node's disconnect leaves its edges in place, answering "is it connected" differently from FakeNode
- where: packages/audio/src/testing/fakeWorklet.ts:43-44 (FakeAudioWorkletNode connect/disconnect)
- scenario: `connect` pushes to `connectedTo` without updating the target's `connectedFrom`, and `disconnect()` only sets a flag. After the engine disposes a worklet voice, `allPaths(workletNode, dest)` (graphWalk.ts) still finds the path, and a walk upstream from the bus input never sees the worklet node. FakeNode answers the same questions by maintaining both lists and clearing them on disconnect. `connect` also returns `undefined` where a real node returns its target, so a chained `node.connect(a).connect(b)` throws only in tests.
- evidence: read
- severity: low

## Failing the fake addModule before anything awaits it raises an unhandled rejection
- where: packages/audio/src/testing/fakeWorklet.ts:29-31,56 (installFakeWorklet → _load)
- scenario: the `pending` promise is created at install with no handler. A test that calls `_load(new Error('csp'))` before the engine has called `audioWorklet.addModule` (e.g. before `unlock`) rejects a promise nobody holds yet; vitest reports an unhandled rejection and fails the run even if the engine later handles the failure correctly.
- evidence: read
- severity: low

## engineHarness's clearTimer clears whatever is armed, regardless of handle
- where: packages/audio/src/testing/engineHarness.ts:10-11 (engineHarness)
- scenario: every `setTimer` returns handle 1 and `clearTimer` nulls `pass` unconditionally. If the engine arms its next pass and then clears a stale handle (or two clients share the pair), the live pass is dropped and the scheduler silently stops in the test, where a real timer pair would keep the new one. graphHarness.ts:52-53 tracks handles properly; the two harnesses answer the same question two ways.
- evidence: read
- severity: low

## powerSpectrum accepts a non-power-of-two size and returns garbage
- where: packages/audio/src/testing/spectrum.ts:43 (powerSpectrum)
- scenario: `powerSpectrum(x, 48000, 1000)`: the radix-2 `fft` silently computes a wrong transform (its bit reversal and butterflies assume a power of two), and an odd size makes `start += size / 2` fractional so `x[start + i]` is `undefined` → NaN power. Nothing throws; tests comparing band powers get meaningless numbers. The precondition is stated only on the private `fft`.
- evidence: read
- severity: low

## createFakeBuffer.getChannelData returns undefined for an out-of-range channel
- where: packages/audio/src/testing/fakeAudioContext.ts:90 (createFakeBuffer)
- scenario: `ctx.createBuffer(1, 128, 48000).getChannelData(1)` returns `undefined`; a real AudioBuffer throws IndexSizeError. Code filling the wrong channel crashes later with a TypeError on `undefined` (or is silently skipped), instead of failing where the spec says. Same file's createBuffer validates channels/length but not `sampleRate` (0 gives `duration: Infinity`).
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

<!-- done: 12 findings, files read: 13 -->
