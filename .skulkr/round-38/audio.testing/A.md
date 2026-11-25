I couldn't write `.skulk/out/findings.md` because the permission was denied, so the full findings document is below.

## engineHarness keeps one timer slot, so any second engine timer replaces or cancels the scheduler's pass
- where: packages/audio/src/testing/engineHarness.ts:10-11 (engineHarness, setTimer/clearTimer)
- scenario: The engine gives the same `timers` pair to the scheduler and to the `atAudioTime` callers (streamStarter.ts:39, insertPump.ts:48, graph/fader.ts:55, graph/transport.ts:34). A stream started at a future `when` arms an `atAudioTime` check. That `setTimer` call overwrites `pass`, so `run` now calls only the check. The scheduler's `handle` is still non-null (scheduler.ts:94), so it never re-arms, and notes booked afterward never fire. Canceling that check calls `clearTimer`, which nulls `pass` whatever handle it was given, so the scheduler stops too. The double should keep a map of handles, as graphHarness does.
- evidence: read
- severity: medium

## A buffer source's end time ignores the start offset and the playback rate
- where: packages/audio/src/testing/fakeSources.ts:100 (dueToEnd)
- scenario: `start(0, 0.6)` on a 1 s buffer records `offsets: [0.6]`, but `endsAt = started[0] + duration` gives 1 s, where a real source ends at 0.4 s. `playbackRate = 2` is also ignored. As a result `_advance` fires `onended` late. `start`'s third `duration` argument is not accepted at all.
- evidence: read
- severity: medium

## resume() and suspend() on a closed fake context reopen it
- where: packages/audio/src/testing/fakeAudioContext.ts:108-110 (resume, suspend)
- scenario: `await ctx.close(); await ctx.resume()` leaves `state === 'running'` and fires `statechange`. A real context rejects with InvalidStateError and stays `'closed'`. So an engine that resumes after `dispose` (for example, a late gesture unlock) passes here but throws in a browser. This contradicts the file header's promise to throw where the spec throws.
- evidence: read
- severity: medium

## connect() records a duplicate edge for a repeated connection, and a targeted disconnect removes only one copy
- where: packages/audio/src/testing/fakeNode.ts:55-72 (node.connect, node.disconnect)
- scenario: `a.connect(b); a.connect(b)` pushes `b` twice, where in Web Audio the second connect is a no-op. `a.disconnect(b)` then removes one copy and leaves `a` still connected to `b`. `edgeCount` (graphHarness.ts:75) and `allPaths` both count the duplicate.
- evidence: read
- severity: medium

## renderEngineStereo hangs forever when `later.run` throws, and leaks an unhandled rejection when `later.at` is out of range
- where: packages/audio/src/testing/renderEngine.ts:47-53 (renderEngineStereo)
- scenario: If `later.run` throws, `ctx.resume()` is never reached and the `void`ed promise rejects with no handler. The render stays suspended, so `startRendering` never settles and the test times out instead of reporting the error. If `later.at` is at or past `seconds`, `suspend` rejects with no handler, and `later.run` silently never runs.
- evidence: read
- severity: medium

## A targeted disconnect that throws still marks the node disconnected
- where: packages/audio/src/testing/fakeNode.ts:61-65 (node.disconnect)
- scenario: `a.disconnect(c)` with `c` not connected sets `disconnected = true` before throwing InvalidAccessError. A real node is unchanged by the failed call.
- evidence: read
- severity: low

## stubWorkerGlobals' restore unstubs every global in the test, not just its own
- where: packages/audio/src/testing/fakeWorker.ts:73 (restore)
- scenario: `vi.unstubAllGlobals()` also reverts globals the test stubbed itself, such as a `fetch` stubbed before the call. It should put back only `Worker` and `Blob`.
- evidence: read
- severity: low

## FakeWorker._fail fires error listeners after terminate, unlike _reply
- where: packages/audio/src/testing/fakeWorker.ts:41-43 (_fail)
- scenario: After `terminate()`, `_reply` does nothing, but `_fail` still dispatches `error`, which a terminated real worker never delivers.
- evidence: read
- severity: low

## The fake analyser's canned bytes depend on the caller's array length, not the bin count
- where: packages/audio/src/testing/fakeAnalyser.ts:16-20 (fill)
- scenario: The default ramp uses `length = min(out.length, bins)`. With 1024 bins, bin 255 reads 254 into a 256-byte array and 64 into a 1024-byte array. A real bin's value doesn't depend on the destination array, and the doc promises a function of "window length".
- evidence: read
- severity: low

## createBuffer accepts any sample rate, and getChannelData returns undefined for a missing channel
- where: packages/audio/src/testing/fakeAudioContext.ts:80-91 (createFakeBuffer)
- scenario: `createBuffer(1, 10, 0)` gives `duration: Infinity`, so a source on it never ends; the spec throws NotSupportedError. `getChannelData(1)` on a mono buffer returns undefined where the spec throws IndexSizeError.
- evidence: read
- severity: low

## engineHarness.run overshoots a duration that is not a multiple of 25 ms
- where: packages/audio/src/testing/engineHarness.ts:19-23 (run)
- scenario: `run(30)` advances the clock 50 ms, so events due up to 50 ms fire.
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

<!-- done: 11 findings, files read: 13 -->