Scene delta that throws in the worker is still acked as drawn (A+B): fixed 14f44ec1e0
Worker layer visibility ignores whole-`scene` hiding, `defaultVisible` and `alwaysOn` (A): fixed 4b14716261
A hidden canvas shown again after its worker was released throws `InvalidStateError` (A+B): fixed 6ef229aad2
A worker stack whose second worker fails to start leaks the first (A): fixed 7064d2d46a
`snapshotStack` never closes the worker bitmaps it composes (A+B): fixed b2d6b95af2
`answerImage` stops waiting for the sharper raster when any image on the page lands (A+B): fixed cf26a7cead
The client's warn-once set grows without bound (A): fixed 1bfe095617
`hostSceneRender` has no teardown, and a second host takes over the realm-wide image loader (B): fixed d1ccac464e. This was a behavior call nobody had made, so it is recorded in `docs/unruled.md`: images are asked of each hosted page in turn, oldest first, and `hostSceneRender`/`serveSceneRender` now return a stop function. Its changeset is `minor`, because the return value is new API.

Extra while fixing:
Several gaps of the same kind: a frame whose overrides, scroll or resize threw also counted as landed; the worker now answers such a frame as lost too, and still applies its view, size and animator calls. It asks the page for a retry once, so a frame that is refused every time does not resend the whole scene every frame: fixed 14f44ec1e0
The new rule for a canvas shown again after hiding, and the lost-frame row in the failure table, are now in the render-worker README: a7939f7191
`check:size` failed on `hostSceneRender` (133 lines) and `useWorkerStack` (123 lines); each now has part of its work in a helper of its own: a39bfc7e66

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `serveSceneRender.test.ts` 11 passed, `startSceneRenderWorker.failure.test.ts` 12 passed, `startSceneRenderWorker.setup.test.ts` 5 passed, `startSceneRenderWorker.test.ts` 12 passed, `workerStack.test.ts` 8 passed, `WorkerSceneView.test.tsx` 4 passed, `useWorkerStack.test.tsx` (new) 2 passed, `workerImages.test.ts` 6 passed, `frameWriter.test.ts` 5 passed, `SceneCanvas/useSceneWorkerSurface.test.ts` 5 passed. Each new test failed against the frozen code before its fix.
- `npm run checks:gate`: all 32 passed. The first run failed 3 checks (a typecheck error in the setup test, five changeset titles over 140 characters, and `check:size`); all three are fixed.
- `npm run check:changesets`: OK, 1900 changesets.
- `npm run lint -w @weasel-js/core`: no such script, since core has no `lint` script. `npx eslint packages/core/src/canvas/renderWorker` instead: pass.
- No `*.browser.test.*` file was touched. Tree clean.