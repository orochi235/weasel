I wasn't allowed to write `.skulk/out/findings.md`, so here is the whole findings document. I also couldn't confirm the frozen commit: `git rev-parse HEAD` in this tree gives `7095f874ee`, not `aac71b545e`, and the commands to compare the two weren't approved. The line numbers below are from the tree as it stands.

# Audit round 38: audio.testing

## engineHarness keeps one timer slot for every timer the engine sets, so a fade or stream timer can replace the scheduler's pass
- where: packages/audio/src/testing/engineHarness.ts:10-11 (engineHarness, setTimer/clearTimer)
- scenario: `createAudioEngine` gives the same `setTimer`/`clearTimer` pair to the scheduler, the bus graph's faders, insert pumps, patch graphs and stream starters (createAudioEngine.ts:182-241, each through `atAudioTime`).
  - The harness's `setTimer` overwrites a single `pass` variable and always returns `1`. Its `clearTimer` sets `pass` to null whatever handle it is given.
  - A test that triggers an insert crossfade, or a streamed voice with a `when`, replaces the scheduler's pending pass with the fade's `check`. The scheduler only re-arms from inside `pass` (scheduler.ts:94), so it never runs again, and voices booked past the lookahead never fire.
  - Cancelling a fade (`clearTimer(1)`) drops the scheduler's pass the same way.
  - `run` calls whatever callback is in the slot every 25 ms, so a fade's `check` gets called as if it were the scheduler.
  - The fix is a map keyed by distinct handles, as `graphHarness` does (graphHarness.ts:48-53).
- evidence: read (engineHarness.ts, createAudioEngine.ts:179-241, scheduler.ts:90-115, audioTime.ts:23-48)
- severity: medium

## Fake `connect` records a repeated connection twice, and `disconnect(target)` removes only one copy
- where: packages/audio/src/testing/fakeNode.ts:55-72 (node: connect/disconnect)
- scenario: `a.connect(b); a.connect(b); a.disconnect(b)`.
  - In Web Audio the second identical connection is ignored, so after the disconnect `b` is cut off.
  - The fake pushes `b` into `a.connectedTo` twice (and `a` into `b.connectedFrom` twice), and the targeted `disconnect` removes only one entry. The `a → b` edge is still listed.
  - So `allPaths`, `reachesCycle` and `edgeCount` report an edge a browser has already removed, and `edgeCount` counts the doubled connection as two edges.
  - `connect` should skip a target that is already in `connectedTo`.
- evidence: read
- severity: medium

## `dueToEnd` ignores the start offset and the playback rate, so a buffer source ends late
- where: packages/audio/src/testing/fakeSources.ts:96-102 (dueToEnd)
- scenario: The engine starts buffer sources with an offset (synthStarters.ts:135, graph/sources.ts:35) and sets `playbackRate.value = voice.rate` (createAudioEngine.ts:102, synthStarters.ts:139).
  - Take a non-looping 1 s buffer started at t=0 with offset 0.5, or with `playbackRate.value = 2`. A browser fires `onended` at 0.5 s.
  - The fake computes `started[0] + duration` and ends it at 1 s, even though it records `offsets` and has a `playbackRate` param.
  - Tests of what happens when a voice ends therefore run against the wrong end time for any offset or rate-changed voice.
  - It should end at `started[0] + (duration - offset) / playbackRate.value`.
- evidence: read
- severity: medium

## Fake context's `resume`/`suspend` on a closed context succeed and reopen it instead of rejecting
- where: packages/audio/src/testing/fakeAudioContext.ts:108-110
- scenario: After `close()`, calling `resume()` sets `state` to `'running'` and fires `statechange`.
  - A real context rejects both `resume` and `suspend` with `InvalidStateError` once closed.
  - The file's own header says the fake throws where the spec says a real implementation throws.
  - So an `unlock()` or `resume()` after `dispose()` passes in tests and rejects in a browser.
- evidence: read
- severity: low

## Fake `getChannelData` returns `undefined` for an out-of-range channel instead of throwing
- where: packages/audio/src/testing/fakeAudioContext.ts:90 (createFakeBuffer)
- scenario: On a one-channel buffer, `getChannelData(1)` returns `undefined`. A real buffer throws `IndexSizeError`.
  - The caller then fails later and somewhere else, in its own `.set(...)`, or not at all.
  - `createBuffer` also accepts a non-positive or non-finite `sampleRate`, which gives a `duration` of Infinity or NaN. A real context rejects it with `NotSupportedError`.
- evidence: read
- severity: low

## Fake `disconnect(target)` marks the node disconnected even when it throws
- where: packages/audio/src/testing/fakeNode.ts:61-66
- scenario: `n.disconnect(notConnected)` sets `disconnected = true` before it throws `InvalidAccessError`.
  - The node then reports `disconnected` although no edge was cut.
  - A test that catches the error and then checks `disconnected` sees the wrong value.
- evidence: read
- severity: low

## renderEngineStereo's `later` suspend can reject with no handler, so `later.run` never runs
- where: packages/audio/src/testing/renderEngine.ts:47-53
- scenario: `void ctx.suspend(later.at).then(...)` has no rejection handler. `OfflineAudioContext.suspend` rejects in two cases:
  - `later.at` is at or past the end of the render (for example `later.at = seconds`).
  - With worklet voices, `later.at` is under 128 / rate, so it lands in the same render quantum as the `suspend(0)` at line 56.
  - Either way the rejection is unhandled, `later.run` never runs, and the test asserts on a render that never got the change it was meant to make.
- evidence: read (the rejection conditions come from the Web Audio spec; not run here)
- severity: low

## FakeWorker `_fail` still fires after `terminate`, while `_reply` does not
- where: packages/audio/src/testing/fakeWorker.ts:41-43
- scenario: After `terminate()`, `_fail()` still calls the `error` listeners, but `_reply()` is dropped.
  - A terminated real worker delivers neither event.
  - A test that code ignores a late error after tearing down its worker sees the error fire anyway.
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