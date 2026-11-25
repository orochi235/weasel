Kept marks stay from the first storage when the instrument's storage changes, and the next save writes them into the new storage (A+B): fixed 36a42eaf5b

Zoom control shows for a trial with no camera, and its writes put a 2D view into the record (A): fixed 263a0e2141

Undo history started live has no `rebuild`, unlike the restored one (B): fixed cfd7978703. Reproduced: restoring it threw `HistoryRestoreError: cannot rebuild "labkit:trialEdit"`.

watch3d's retries use a computed `setTimeout` delay instead of `after` (B): fixed 37a67880a4. Nothing a user sees changes, so it has no test and no changeset. The other deferred timers in the same file now go through `after` too.

WebGPU watch holds every canvas a device configured strongly, for the device's life (B): fixed b562c16466. A test can't show memory being freed without forcing garbage collection, so the new tests cover only that canvases are still reported, with repeat `configure` calls counted once.

A canvas that turns on depth testing before it joins a trial is never reported (B): fixed c5bc07ab5c. The fix covers the WebGL and WebGPU paths alike.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `useKeptMarks.test.tsx`: pass (1)
  - `useTrialChromeContext.test.tsx`: pass (2)
  - `chromeIdentity.test.tsx`: pass (4)
  - `watch3d.test.ts`: pass (2)
  - `watch3d.depth.test.ts`: pass (3)
  - `useTrialSnapshot.test.ts`: pass (1)
- Related files I didn't edit, run before the final rebase: `Trial.annotations*` (3 files), `Trial.setZoom`, `Trial.canvas`, `Trial.orbit`, `Trial.test`, `Trial.undoPersist`, `Trial.undoOrder` and `Trial.resetHistory`: all pass.
- Every new test failed before its fix, except the WebGPU test that checks several canvases on one device, which passes either way and stays as a regression test.
- `npm run checks:gate`: pass (all 32 passed)
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run check:changesets`: pass (OK — 6 changesets)

tally: 6 of 7 fixed, 0 extra fixed