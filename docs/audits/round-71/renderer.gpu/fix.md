WebGL samples a deleted texture as whatever its unit last held (A): fixed 70174779ad

WebGL samples an unset or drawn-into texture as opaque black, WebGPU as transparent (A): fixed 74b6dc405e. WebGL now binds a 1×1 transparent texel in every such slot, including a slot with no texture set. The shared device frees that texel when the last renderer using it calls `dispose`. To make that possible, `openWebGL` now calls a new `retain()` on the device, and the doc for `GpuDevice.dispose` now says a shared device implements it too. The test recorder answers `isTexture` now. It is published as `testing/glRecorder`, so it has its own changeset.

`GlProgram.ready()` stays false forever on a lost or restored context (B): fixed 890a45bb8b. A `null` completion status now counts as settled. The device still doesn't request `KHR_parallel_shader_compile` again after a restore, so programs built after one compile in the foreground. That is correct, just slower.

GL `setTexture` with an out-of-range sampler index writes into another sampler's unit (B): fixed 640e14da7f. I made the strict call: both backends now throw a `RangeError`, and a sampler the shader doesn't have is still ignored. It is recorded in `docs/unruled.md`.

WebGPU `resolve` doesn't clip like GL's blit, so the submit is lost (B): fixed 5c6704a2c4

GL `writeTexture` that resizes a mipmapped texture samples black (B): fixed 2828ac96dd. WebGL now keeps `TEXTURE_MAX_LEVEL` at 0 until `generateMipmaps` runs, and sets it back to 0 after a write that resizes the texture. This also fixes a `mipmap: true` texture whose mipmaps were never made, which had the same problem.

WebGPU `writeBuffer` misses a write running past the buffer's end (B): fixed 05baf7e79d. Both backends now throw a `RangeError` for it. WebGL tracks each buffer's size to do that. This strict call is also recorded in `docs/unruled.md`.

`identityNdcGroups` makes a GPU buffer per call and never frees it (B): fixed 070707f03d. It now makes one per device through `createPart`.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass. That covers `GlProgram.test.ts`, `WebGLDevice.test.ts`, `WebGPUDevice.test.ts`, `wgpuTargets.test.ts`, `testNdc.test.ts`, `drawBatch.image.test.ts` and `WeaselRenderer.patternEviction.test.ts`.
- `packages/renderer/src` together with `packages/core/src/canvas` and `packages/core/src/core`: pass, 709 files and 5459 tests.
- Browser tests that use the changed code: unrun here. That covers `wgsl.browser.test.ts`, `kitPrograms.browser.test.ts` and the parity browser tests.
- `npm run checks:gate`: pass, "all 33 passed". The first run failed `check:part-caches` on a hand-rolled cache in `testNdc.ts`; I rewrote it with `createPart`.
- `npm run lint -w @weasel-js/renderer`: unrun, because the package has no `lint` script. In its place, eslint on every changed `.ts` file: pass.
- `npm run check:changesets`: pass.

tally: 8 of 8 fixed, 0 extra fixed