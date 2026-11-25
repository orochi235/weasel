Departing child loses the paint it inherits from its removed group (A+B): fixed c80e57ede6

Content-bounds cache ignores the camera that `boundsOf` reads (A): fixed c60d6e994e

useViewportActions effect never rereads the registry in scope (B): fixed 80e8e5ef70

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.test.tsx`: pass (10 tests)
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/SceneCanvas/useViewportActions.test.ts`: pass (2 tests)
- `npx vitest run --maxWorkers=1 packages/core/src/canvas/SceneCanvas/useContentBounds.test.ts`: pass (5 tests). Its new camera test also failed with the fix taken out.
- `npm run checks:gate`: pass, "checks:gate: all 33 passed"
- `npm run check:changesets`: pass, "OK — 549 changeset(s)"
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script (npm said so). The root `npm run lint` ran inside the gate and passed.

tally: 3 of 3 fixed, 0 extra fixed