Loupe ignores `hostRef` inside a camera (A): fixed 7629976bda

Press on a reticle over a Split seam drags the seam (A): fixed 86f349da14

`<LensOverlay>` doesn't re-render on a Follow override hold (A): fixed f1c789e89a

Clone copy uses the x scale on both axes (A): fixed 1722266c22

Round Split lens's seam hit box takes presses outside the lens (B): fixed fe3d25ac52

`useFrameSchedule` drops all but the last function handed to it (B): fixed cd4eb45bd9

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/lens/compare.test.ts`: pass (16 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/lens/lensHitBoxes.test.ts`: pass (5 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/lens/cloneSource.test.ts`: pass (12 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/lens/useFrameSchedule.test.tsx`: pass (2 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/LoupeGestures.test.tsx`: pass (8 passed)
- `packages/labkit/src/loupe/lens/LensOverlay.browser.test.tsx`: unrun (browser test; it holds the new test for the override hold)
- `npm run checks:gate`: pass (all 33 passed)
- `npm run lint -w @weasel-js/labkit`: pass

tally: 6 of 6 fixed, 0 extra fixed