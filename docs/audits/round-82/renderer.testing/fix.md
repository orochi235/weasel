openBackends leaks the WebGPU renderer when the build scope's pop rejects (A+B): fixed 8cf3a6467e

scoped() lets a popErrorScope rejection replace the error fn threw (A): fixed 3ae2c25a98

metricCases' doc says open shapes only, but it runs every shape (A): fixed 47264bc0b8

paintCases' reasoning docblock sits on the StrokePaint type, not on paintCases (A): fixed 2ba1811012

ownDrawRect's doc says 10x10 at `x`, but `y` and `size` are parameters (A): fixed fca3288eba

createRecorderCtx draws through a second WebGLDevice with its own state cache (B): not a defect (`webglDevice` is `createPart`, which keeps one device per GL context in a WeakMap. The renderer's `openWebGL` calls `webglDevice(recorder.gl)` on the same context, so `ctx.gpu` is the renderer's own device and there is only one cache.)

openBackends also leaks both contexts when the error scope's pop fails (B): duplicate of A's openBackends finding (fixed 8cf3a6467e)

No changesets: every touched module is package-internal test support. `@weasel-js/renderer` exports only `testing/glRecorder` and `testing/vertexUploads`.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/testing/parityHarness.test.ts`: pass (7 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/testing/recorderCtx.test.ts`: pass (3 passed)
- `npx vitest run --maxWorkers=1 packages/renderer/src/testing/trimClip.test.ts`: pass (2 passed)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/renderer`: not run, because the package has no `lint` script. I ran eslint on the changed files instead: pass (exit 0)

tally: 6 of 7 fixed, 0 extra fixed