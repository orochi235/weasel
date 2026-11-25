- engineHarness keeps one timer slot, so another timer can replace or clear the scheduler's pass (A+B): fixed cca3df5118. Both harnesses now share a new `fakeTimers` that gives each timer its own handle.
- engineHarness.run moves the clock past the time it is given, e.g. 25 ms for `run(10)` (A): fixed ffa958eff8
- dueToEnd ignores the start offset and playback rate (A+B): fixed 31d0ddfb2f. It now also counts detune, never ends a source at rate 0, and handles a negative rate.
- A repeated connect records a duplicate edge, and one disconnect leaves it in place (A+B): fixed 78bb66b257
- A targeted disconnect that throws still sets `disconnected` (A+B): fixed ef62c55b69
- getChannelData returns undefined for a channel the buffer doesn't have (A+B): fixed f6f8080f9e
- createBuffer accepts a sample rate of 0, giving an Infinity duration (B, side note): fixed 4941c881a5. The fake now refuses a rate that is not positive and finite. It still takes rates below the spec's 3000 Hz floor, because `graph/sources.test.ts`, `graph/processors.test.ts` and `graph/wrapper.test.ts` use 100 Hz buffers so a second is 100 frames. Enforcing the full range broke 16 of their tests.
- resume, suspend and close on a closed context succeed and reopen it (B): fixed 1f2f65db4e
- The analyser's function spec gets the read length instead of the bin count (B): fixed cd78409dc2. The existing test that relied on the old length now sets `fftSize = 8`.
- stubWorkerGlobals' restore removes every global the test stubbed (B): fixed 570d8f01eb
- FakeWorker._fail still fires on a terminated worker (B): fixed 884744c640
- The fake worklet node keeps its edges after disconnect, records no back-edge, and connect returns undefined (B): fixed 25bb3ad703. It is now built on `node()`, so it has a FakeNode's edges.
- Failing the fake addModule before anything awaits it causes an unhandled rejection (B): fixed 3da5caba39
- engineHarness's clearTimer clears whatever is armed, whatever the handle (B): duplicate of the first finding (cca3df5118)
- powerSpectrum accepts a frame size that is not a power of two (B): fixed dba272a79a. It now throws RangeError.
- rmsEnvelope hangs on a window of 0 or less (A): fixed 18b0584e9c. It throws RangeError, and a fractional window does too. I didn't run the pre-fix test because it would hang; the loop that never advances is plain in the code.
- renderEngineStereo's `later` suspend collides with the worklet hold, and its failure is dropped (A): fixed f41545d546. With worklet voices, a `later.at` inside the first render quantum now runs during the first hold. A `later.at` outside the render throws RangeError, and a failed pause fails the render. This one is untested here: its test is a browser test.

Extra defects found while fixing: none.

**Same harness elsewhere.** 18 other test files in `packages/audio/src` define their own local copy of the single-slot harness (`setTimer: (cb) => { pass = cb; return 1; }`). They are outside `testing/`, and each one's `tick` relies on that single slot, so I left them alone. Moving them onto `fakeTimers` is a separate pass.

**Changesets and unruled.md.** No changesets: `packages/audio/package.json` exports only `.`, so `src/testing/` is never published and no consumer can see these changes. No `docs/unruled.md` entries either: every fix follows the spec or turns a silent failure into a throw, so none needed a behavior call.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: engineHarness.test.ts pass (4), fakeAudioContext.test.ts pass (31), fakeWorker.test.ts pass (3), fakeWorklet.test.ts pass (2), spectrum.test.ts pass (2)
- `packages/audio/src/testing/renderEngine.browser.test.ts`: unrun (browser)
- I also ran every audio test file outside the browser project, since every audio test uses these doubles (`--project=weasel-ui packages/audio/src`): pass, 86 files, 668 tests
- `npm run typecheck:packages -- audio`: pass (`1/1 audio ok`)
- `npm run typecheck`: pass (exit 0)
- eslint on `packages/audio/src/testing`: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1720 changeset(s).")
- Tree clean, 16 commits on top of ec211b97fa.