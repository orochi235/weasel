- engineHarness keeps one timer slot, so a second engine timer replaces or cancels the scheduler's pass (A+B): fixed 0ffe9b639d
- engineHarness.run overshoots a duration that isn't a multiple of 25 ms (A): fixed 0ffe9b639d. Same file and same `run` loop as the timer fix, so it went into that commit.
- Repeated `connect` records a duplicate edge, and a targeted `disconnect` removes only one copy (A+B): fixed c205e8cb86
- A targeted `disconnect` that throws still marks the node disconnected (A+B): fixed 20b96ab5ca
- `dueToEnd` ignores the start offset and playback rate, and `start` drops its `duration` argument (A+B): fixed ca5a2c80db. `start` now also throws a RangeError for a negative time, offset or duration, as the spec does.
- `resume`/`suspend` on a closed fake context reopen it (A+B): fixed 46d2b0fe1b. `close` on a closed context now rejects too.
- `createBuffer` accepts any sample rate, and `getChannelData` returns undefined for a channel the buffer doesn't have (A+B): fixed 73ef67e2e7
- The fake analyser's canned bytes depend on the destination array's length, not the bin count (A): fixed 6ad04fbb23
- `FakeWorker._fail` fires after `terminate` (A+B): fixed 9e4418696b
- `stubWorkerGlobals().restore` unstubs every global in the test, not just its own (A): fixed 05a758d5b5
- renderEngineStereo hangs when `later.run` throws, and its `suspend` rejects unhandled when `later.at` is out of range (A+B): fixed e8efbaa43a. I made the strict call: a `later.at` the render can't pause at throws a RangeError. That covers a time outside the render, or inside the first quantum when worklet voices hold it. It is recorded in `docs/unruled.md` in 630ddbe5e5. A `later.run` that throws now lets the render finish and then rejects with its error.

Extra defects found while fixing:
- Tests in `graph/sources.test.ts`, `graph/processors.test.ts` and `graph/wrapper.test.ts` built buffers at 10 Hz and 100 Hz, which a browser refuses. They now build them at 48 kHz with the same durations: fixed 73ef67e2e7.

No changesets: `packages/audio/src/testing` is not in the package's `exports`, and nothing outside `packages/audio` imports it, so no consumer can notice these changes.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `testing/engineHarness.test.ts` 3 passed
  - `testing/fakeNode.test.ts` 2 passed
  - `testing/fakeAudioContext.test.ts` 28 passed
  - `testing/fakeWorker.test.ts` 2 passed
  - `testing/renderEngine.test.ts` 2 passed
  - `graph/sources.test.ts` 20 passed
  - `graph/processors.test.ts` 15 passed
  - `graph/wrapper.test.ts` 2 passed
- The whole `packages/audio` directory, locally, because these doubles are used across the package: 94 files, 701 tests passed.
- Unrun: the renderEngineStereo path where `later.run` throws needs a real `OfflineAudioContext`. It is not covered by any test, and the existing `*.browser.test.ts` files that use `renderEngineStereo` were not run here.
- `npm run typecheck:packages -- audio`: `1/1 audio ok`
- eslint on the changed `.ts` files: exit 0, no output
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run check:changesets`: "[changesets] OK — 1730 changeset(s)."
- `npm run check:test-projects`: "all 5354 vitest files are collected by `npm test`."
- Tree clean apart from the untracked `.skulk/`.