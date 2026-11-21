[A] entered-group frame drifts off the group far from the origin: fixed e9fa9e7cfc

[A] workspace tint's page cut-out misses the page edge far from the origin: fixed 39871204b0

[B] pose run left running when a lazy `poses` iterable throws: fixed 69af985783

[B] view-marker drag projects through the target camera captured at press: not a defect. `moveTo` projects the world point through the press-time space and `pannedIn` unprojects it back through that same space. That round trip gives back the world point exactly, so the aim moves by `world − pressWorld`, and `world` comes from the current camera. The marker stays under the pointer whatever the target camera does.

[B] `mergeVisibilityRules` loses a `__proto__` chrome id: fixed cf573402f3

[r42-9] `createCanvasCamera.target()` gives a stale heading during a glide it didn't start (carried): not a defect (no longer applies). `target()` now reads `canvas.viewAnimationTarget()`, which reports the canvas's glide in flight whoever started it.

Each fix has a test that failed before it and passes after.

Checks:
- `npx vitest run --maxWorkers=1`:
  - `enteredGroupFrame.test.ts`: pass (7)
  - `enteredOperands.test.ts`: pass (3)
  - `modeLayers.test.ts`: pass (13)
  - `usePoseRun.test.ts`: pass (18)
  - `usePoseRun.paint.test.tsx`: pass (1)
  - `resolve.test.ts`: pass (3)
  - `chrome-caps.test.ts`: pass (39)
  - `useChromeCaps.test.tsx`: pass (11)
- `npm run checks:gate`: all 32 passed. The first run failed `check:changesets` on two titles over 140 characters; I shortened them and folded them into their commits.
- `npm run lint -w packages/core`: not run, because `@weasel-js/core` has no `lint` script. Instead, eslint on every changed file: pass.
- The tree is clean.

tally: 4 of 6 fixed, 0 extra fixed