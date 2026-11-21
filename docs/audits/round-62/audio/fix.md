[r37-3] `stream()` stops the element's current stream before the new one is known to start (carried): not a defect (no longer applies). Commit d62b0810b7 fixed it. `restream` in `packages/audio/src/streamStarter.ts:102-117` now launches the new stream first. It stops the earlier stream only if the new one is playing, so a stream that throws or drops leaves the earlier one sounding.

[r37-10] a non-finite `insertFadeMs` / `fadeMs` throws out of `InsertChain.add` halfway through a splice (carried): not a defect (no longer applies). Commit 3edbcb1252 fixed it. `createAudioEngine` checks `insertFadeMs` with `checkSpan` before it builds anything (`createAudioEngine.ts:212`). `createInsertChain` checks `fadeMs` on construction (`inserts.ts:87`) and `createAudioGraph` does the same (`graph/createAudioGraph.ts:30`). A bad fade now throws a `RangeError` before any route is wired, and never inside `add`.

No extra defects found. I made no commits, and the tree is clean.

Checks run:
- `npx vitest run --maxWorkers=1 packages/audio/src/createAudioEngine.stream.test.ts`: pass (16 passed)
- `npx vitest run --maxWorkers=1 packages/audio/src/createAudioEngine.finite.test.ts`: pass (7 passed)
- `npx vitest run --maxWorkers=1 packages/audio/src/createAudioEngine.inserts.test.ts`: pass (3 passed)
- I did not run `checks:gate` or `lint`, because nothing changed.

tally: 0 of 2 fixed, 0 extra fixed