- A refused WGSL pipeline still draws until the async refusal arrives, voiding that first pass (A): question. Neither way out is a fix I could make here. `createRenderPipelineAsync`, or holding draws until validation settles, would drop the first-use draws of every program, kit programs included. Then a static scene would never show them, because nothing asks for a repaint. The voided frame can only be repainted once the renderer has a way to ask its host for a redraw. Which of these to build is a design call. `refusedProgram.browser.test.ts` already accepts the first-frame void.
- WGSL reflection depends on declaration order (A): fixed f8988b6866
- WebGPU `readCanvas` flips by the canvas's current height, not the read texture's (A+B): fixed 16352298f6
- WebGL `beginFrame` doesn't reset pixel-store or unpack-buffer state (A): fixed 030b0fe827
- A zero-sized WebGPU canvas remakes its buffers on every view lookup (A+B): fixed ea5df0f967
- The flat member table lets a group-1 member that shares a kit member's name take the kit's writes (B): fixed a6f39c0ffa
- A throw in a premultiplied GL upload leaves `UNPACK_PREMULTIPLY_ALPHA_WEBGL` on (B): fixed cc03d298dd
- `readCanvas` turns the rect over by the current height (B): duplicate of A's `readCanvas` finding
- The zero-width canvas reallocates on every view call (B): duplicate of A's zero-sized canvas finding
- WebGPU `writeBuffer` zero-pads past the write and drops odd offsets (B): fixed e09e0464f6. This is a strict call: it now throws on an unaligned write that doesn't end at the buffer's end, recorded in `docs/unruled.md`.
- `GpuProgram.set`'s `offset`/`count` doc says elements, but both backends count components (B): fixed 4522393c51 (doc only; there is no failing test for a doc fix)
- WebGPU targets report the requested `samples`/`bytes`, not what was allocated (B): fixed b941c42762
- A straight-alpha `ImageBitmap` with `premultiply: false` is premultiplied on WebGPU (B): question. Nothing reports whether a bitmap's alpha is premultiplied, so WebGPU can't match GL's "as held" for both kinds of bitmap. `premultipliedAlpha: data.premultiply` fixes the reported case but breaks parity for default (premultiplied) bitmaps. Someone has to rule what `premultiply: false` means for a bitmap.

Extra: none. 7c3ef6d673 and 7086e78911 only shorten changeset titles that `check:changesets` refused.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/WebGPUDevice.test.ts`: pass (13)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgpu/wgslReflect.test.ts`: pass (17)
- `npx vitest run --maxWorkers=1 packages/renderer/src/gpu/webgl/WebGLDevice.test.ts`: pass (13)
- Untouched but exercising the changed code: `WeaselRenderer.target.test.ts` pass (16), `drawBatch.test.ts` pass (60), `cache/premultipliedUploads.test.ts` pass (3), `cache/GLTextureCache.rgba.test.ts` pass (2), `retain/RetainedSurfaces.pbt.test.ts` pass (1), `core/src/canvas/canvasRenderer.webgpu.test.ts` pass (2)
- Each new test fails with its fix reverted: confirmed for all seven test-backed fixes.
- `npm run checks:gate`: "1 of 32 failed" (check:changesets, a title of 142 characters). After shortening it, `npm run check:changesets`: "OK — 2598 changeset(s)". The whole gate was not rerun.
- `npm run check:size`: pass
- `npm run lint -w @weasel-js/renderer`: the renderer has no lint script. `npx eslint packages/renderer/src/gpu packages/renderer/src/testing/glRecorder.ts`: pass, no output.
- Browser tests: not run here. None was edited.

tally: 9 of 13 fixed, 0 extra fixed