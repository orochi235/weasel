WebGL `writeBuffer` with a `length` of 0 writes the rest of the array (A): fixed 9b9f916bae

The same `writeBuffer` zero-length finding (B): duplicate of A's

`GlProgram.has` answers false for a uniform array it looked up (A): fixed 7ae808b56d

`setSampling` with an explicit `undefined` key leaves the record and GL disagreeing (A): fixed 4885cb8e8c. Strict call: an `undefined` key now means "leave this setting as it is" on both backends. Both merge through one new `mergeSampling` in `packages/renderer/src/gpu/samplingMerge.ts`, which also fixes WebGPU taking `undefined` as the new value. Nothing about this went into `docs/unruled.md`.

The same `setSampling` undefined-key finding (B): duplicate of A's

`resolve` into an id target writes color over its id attachment (B): fixed 2688045294

No extra defects found.

Checks:
- Before the fixes, all four new tests in `WebGLDevice.test.ts` failed, and so did the `samplingMerge` test.
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgl/WebGLDevice.test.ts`: pass (36/36)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/samplingMerge.test.ts`: pass (1/1)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgl/GlProgram.test.ts`: pass (13/13)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/WebGPUDevice.test.ts`: pass (22/22)
- `npm run check:changesets`: pass ("OK — 1250 changeset(s), 102 with warnings"; none of the warnings are on the four new changesets)
- `npm run checks:gate`: first run failed (typecheck and typecheck:packages, TS2339 on `tex.sampling` in the new test). I fixed it and amended it into 4885cb8e8c; the rerun passed ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/renderer`: not run, because the renderer package has no `lint` script. I ran eslint on every changed `.ts` file instead: pass, no output.
- The tree is clean, with four commits on top of the frozen commit.

tally: 6 of 6 fixed, 0 extra fixed