parityDevice can let an old device's loss clear the newer device from the cache, when releaseDevice runs while an open is pending (A): fixed 409e8e3579

trimClip's `paint` leaves every WebGL context it opens live until collection (A): fixed 926105f682

The GL recorder returns a new number for every getAttribLocation and getUniformLocation call and ignores bindAttribLocation (A): fixed ea318b6105. Locations are now per program and name, bound indices are honored, and unbound attributes take the lowest free index. It has a changeset, since `testing/glRecorder` is a published entry. `drawPath.vertexColor.test.ts` relied on every attribute location being unique, so it now finds the vertex-color draw by its program instead.

createRecorderCtx never disposes its renderer, so its image cache stays in the module-wide `live` set (B): fixed 3dcff6804b. The renderer is now disposed through `onTestFinished`, which covers all 80 call sites without touching them.

The recorder context draws through a second `webglDevice` whose state cache disagrees with the renderer's (B): not a defect. `webglDevice` is a `createPart`, memoized per context, so `webglDevice(recorder.gl)` returns the renderer's own device.

parityDevice can drop the next device when an earlier open was released (B): duplicate of A's parityDevice finding, fixed 409e8e3579

The fake GPU device has no `dispatchEvent`, which wpuPipelines uses to re-raise pipeline errors (B): fixed 86fd613317

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` passed on each file I touched: `parityHarness.test.ts` (5/5), `fakeGpuDevice.test.ts` (5/5), `recorderCtx.test.ts` (3/3), `trimClip.test.ts` (2/2), `glRecorder.test.ts` (11/11) and `drawPath.vertexColor.test.ts` (7/7).
- I also ran all 121 non-browser test files that use the recorder in one `--maxWorkers=1` run: 1 failed, 120 passed. The failure was `drawPath.vertexColor.test.ts`; it was rewritten as above and now passes on its own. Every recorderCtx caller (16 files) also passed one at a time after the dispose change.
- The `trimClip.*.browser.test.ts` files were not run, since browser tests can't run here.
- `npm run checks:gate`: "all 32 passed", exit 0, run before the last commit. After that commit, `npm run typecheck` exited 0, `npm run check:size` passed and `npm run check:changesets` was OK.
- `npm run lint -w @weasel-js/renderer` can't run because the renderer has no `lint` script. Eslint on every changed file exited 0, and the gate's `npm run lint` passed.

tally: 6 of 7 fixed, 0 extra fixed