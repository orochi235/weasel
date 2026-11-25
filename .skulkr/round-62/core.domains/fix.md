[r62? no — r42-9] createCanvasCamera.target() stale heading during a glide it didn't start (carried) — fixed 55f411bc0c. An earlier commit, f20931c24a, had fixed this for handles that expose `viewAnimationTarget`. The fallback path for handles without it was still wrong: a glide started over the camera's own glide cancels it without calling `onDone`, so `target()` kept returning the canceled heading. A test reproduced this before the fix. `PresentationCanvas` now requires `viewAnimationTarget()`, which `SceneCanvasApi` already has, and the camera no longer keeps a heading of its own. `createCanvasCamera` hasn't been released yet (it only appears in pending changesets), so making the method required breaks nobody. The pending `canvas-camera-stale-heading` changeset already describes this behavior, so I added no new one.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/domains/presentation/presentationStep.test.ts`: pass (8 passed).
- `npm run checks:gate`: pass ("all 32 passed").
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. The gate's root `npm run lint` passed, and `eslint` on the two changed files passed.
- Tree is clean apart from `.skulkr/`.

tally: 1 of 1 fixed, 0 extra fixed