I fixed 13 of the 15 findings in 12 commits; the other two are questions that need a decision from you. One pair of findings was a duplicate (A3 and B6), so the 12 commits cover 13 findings. The gate passes and every touched unit test passes locally.

- WebGL `limits.samples` read whichever framebuffer was bound, not the canvas's (A): fixed 2ec9d9fe98
- WebGL `beginFrame` didn't reset blend equation, rasterizer discard, sample coverage, or polygon offset (A): fixed d8c82b418c
- WebGL read-backs ran under pack state another tenant of the context left set (A): fixed bbe3eedd53
- WebGL `readIds` on a target without ids returned its color bytes as ids (A): fixed f3a13aec61
- `stride: 0` with several attributes meant different layouts on the two backends (A): fixed 6c475d545b. A shared `packedStride` in `gpu/vertexLayout.ts` now gives both backends the same answer.
- A multisampled target with ids could not be drawn into on either backend (A): fixed c4f7d7555d. I made the strict call: `createTarget` now throws on both backends, with no override. It's recorded in `docs/unruled.md`.
- An image uploaded into an `r8` texture was RGBA on WebGL (A): fixed dab88296db
- WebGPU premultiplies every ImageBitmap, whatever `premultiply` asks (A): question. Neither backend can tell whether a bitmap was made with `premultiplyAlpha: 'none'` or the defaults. Fixing this would change how the font atlas uploads (`premultiply: false`, default-option bitmap) on WebGPU, or on both backends if WebGL goes through a canvas. Only a browser run can check that. Do you want `premultiply: false` to mean straight texels on both backends, verified by the text parity browser test? I started the WebGPU-only change and reverted it.
- WGSL reflection didn't handle nested block comments or hex constants (A): fixed 4ac81e3473. One stripper in `wgslLexical.ts` now serves `wgslReflect`, `wgslEntries` and `customPrelude`, and hex is read in consts and array sizes. One commit, two changesets.
- WebGPU draws with a pipeline before it knows the GPU refused it, which voids that whole submit (B): question. Deferring draws until the verdict arrives would drop the first frame of every valid new pipeline. Avoiding that needs something new: a signal telling the consumer the frame was voided, or a renderer that repaints its last commands itself. The renderer has neither today, and the current design (`refusedProgram.browser.test.ts`) accepts losing the first frame. Should the renderer get a repaint signal for this?
- A GL program deleted before it settled leaked both shaders (B): fixed f041054dbf. It adds `GlProgram.delete()`.
- WebGL `set` with `count: 0` uploaded the rest of the array (B): fixed 61e11f062f. An offset at the array's end is covered too.
- `samples: 1` made a multisampled target with no color texture on WebGL (B): fixed 35974798bd
- A null adapter after a device loss was cached for the page's life (B): fixed d6a0cacea9
- WebGL read-backs ignored pack state (B): duplicate of the A pack-state finding, fixed in bbe3eedd53

I found no extra defects. A sweep found no other copy of the old comment-strip regex.

Checks:
- `npx vitest run --maxWorkers=1`, file by file: `webgl/WebGLDevice.test.ts` pass (22), `webgl/GlProgram.test.ts` pass (11), `webgpu/requestRendererDevice.test.ts` pass (3), `webgpu/WebGPUDevice.test.ts` pass (14), `webgpu/wgslReflect.test.ts` pass (20). Untouched but related: `webgpu/wgsl/kitPrograms.test.ts` pass (50) and `webgpu/wgsl/paintPrelude.test.ts` pass (4). Each new test failed against the original source before its fix.
- Unrun: no browser test was touched, so none was run.
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run lint -w @weasel-js/renderer`: not run, because the renderer has no `lint` script (npm says "Missing script"). The root `npm run lint` inside the gate passed.
- Tree clean, `.skulkr/` untouched.

tally: 13 of 15 fixed, 0 extra fixed