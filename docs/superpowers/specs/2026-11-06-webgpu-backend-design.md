# WebGPU backend for WeaselRenderer — design

**Status: partly built (2026-11-06).** Work in flight on branch `webgpu` (`/Users/mike/src/weasel-webgpu`); the
stage list at the end says which parts have landed. Delete this file when the last stage merges; the WGSL
contract already lives in `packages/renderer/README.md` ("Writing WGSL").

For whoever builds or reviews a stage: how one draw-code path drives both WebGL2 and WebGPU, what a WGSL
shader author is promised, and the order the work lands in.

## Shape: one draw path over a GPU layer

The draw code (batching, clips, paths, text, effects, retained surfaces, ids) is written once, against a
GPU layer in `packages/renderer/src/gpu/`. Two implementations sit under it: `gpu/webgl/` and
`gpu/webgpu/`. After stage 1, `gl.` appears nowhere outside `gpu/webgl/` and the test recorder.

Not a GL shim on WebGPU: that would need GLSL compiled to WGSL in the browser, and custom shaders are
ruled to bring their own WGSL (2026-11-06). Not a parallel renderer: the clip, batch and retained logic is
most of the code and the hardest won, and two copies would drift.

The layer is draw-time state, not GL's state machine, because WebGPU bakes blend, color writes and stencil
masks into a pipeline:

| Layer call | WebGL2 | WebGPU |
|---|---|---|
| `beginPass({ target, viewport, scissor, clear })` | bind framebuffer, viewport, scissor, `clear` inside the scissor | `beginRenderPass`, `loadOp: 'clear'` for an unscissored clear, else `'load'` and a clear draw |
| `setViewport` / `setScissor` mid-pass | `viewport` / `scissor` | `setViewport` / `setScissorRect` |
| `draw({ program, blend, colorWrite, stencil, ids }, geometry, count, firstIndex)` | apply the state that differs from the last draw, bind the program's textures, `drawElements` | pipeline from a cache keyed on the state and the geometry's layout, the program's uniforms packed into a ring buffer at a dynamic offset |
| `program.set*(name, …)`, `program.setTexture(name, texture, index)` | `uniform*` at once; a unit per sampler, bound at draw | written into the program's CPU copy of its uniform struct; textures and samplers in its bind group |
| `clearStencilBits(mask)` | `stencilMask(mask); clear(STENCIL)` | a full-target draw, write mask `mask`, op `zero` |
| `resolve(msaaTarget, into, width, height, x, y)`, outside a pass | the two `blitFramebuffer`s that were `surfaceGl.ts` | `resolveTarget`, then `copyTextureToTexture` |
| `readIds(target, rect)` → `Promise`; `readIdsSync` where the backend has it | `readPixels` | `copyTextureToBuffer`, `mapAsync`; no sync form |
| `createTexture(format, sampling, data)`, `writeTexture`, `writeSubTexture`, `generateMipmaps`, `setSampling`: `rgba8`, `r8`, mipmapped `rgba8` | `texImage2D`, `texSubImage2D`, `generateMipmap`, `texParameteri` | `writeTexture` / `copyExternalImageToTexture({ premultipliedAlpha: true })`, mips drawn level by level, a sampler per sampling |
| `createBuffer` / `writeBuffer` / `resizeBuffer`, `createGeometry({ vertexBuffers, indexBuffer, indexFormat })` | buffers and a VAO | buffers; the layout goes in the pipeline key |

Uniforms and textures are held by the program until set again, as GL holds them, so the draw-time state carries
neither (2026-11-06, stage 1). Rects in the layer (viewport, scissor, read and resolve rects) count from the
target's bottom-left corner as GL does, and the WebGPU backend flips them against the target's height
(2026-11-06, stage 1: the draw code's tile and read arithmetic is all bottom-up, and flipping it once in one
backend is less to get wrong than rewriting it). The layer is `packages/renderer/src/gpu/types.ts`.

Stencil states are a closed set (clip test at a depth, parity write, parity paint, clip push simple and
even-odd, clip pop, aligned fill, aligned ribbon inner and outer): compare, masks and op go in the pipeline
key, the reference is dynamic. Blend modes are the premultiplied default and the 11 Porter-Duff operators of
`effects/compositeOp.ts`, plus off.

Two GL tricks go, on both backends: the negative-origin viewport (`groupEffects.ts`, `retained.ts`) moves
into the projection, since WebGPU validates viewport bounds. Stage 1 did this for a group's effects buffer only
(2026-11-06). A retained group's tiles keep one projection and slide the viewport: a projection per tile rounds
differently at the seams, and `retained.tiles.browser.test.ts` fails on it (4 pixels off by up to 40 levels).
`compositeOver` in `draw/effects.ts` also still sets a viewport over the composited rect, which reaches past an
effects buffer's edge when that buffer is offset. So the WebGPU backend clamps such a viewport to its target and
folds the rest into the clip position: every WGSL vertex entry point passes its position through `weasel_clip`, a scale and offset at bind group 2 the device sets per draw; and the pick id moves from a disabled generic
vertex attribute to a uniform, written to attachment 1 only when the draw state's `ids` is set (WebGL:
`drawBuffers`; WebGPU: that target's `writeMask`).

The main canvas target is 4× multisampled with a stencil attachment on WebGPU, resolving into the canvas
texture, to match WebGL's antialiased default framebuffer. Hull clipping stays off on a multisampled target,
as it is now.

## Uniforms and textures, by name, on both backends

Draw code sets uniforms by name (`u_model`, `u_color`, …) as it does now. The WebGL backend writes
`uniform*`. The WebGPU backend reflects each program's WGSL: the struct bound at `@group(0) @binding(0)`
gives every member's offset under WGSL's layout rules, and textures are matched by variable name, each
`texture_2d<f32>` named `x` paired with a `sampler` named `x_sampler`. A name the program does not declare
is ignored on both backends, as `gl.uniform*(null, …)` is now.

The kit's own programs are written twice by hand, GLSL and WGSL, with the same uniform names, and both live
in one module per program. The batch shader samples inside branches on a flat varying, which WGSL rejects
for `textureSample`; its WGSL uses `textureSampleGrad` with derivatives taken before the branch.

## The WGSL contract for custom shaders

Moved to `packages/renderer/README.md` ("Writing WGSL"), where shader authors read it: a program supplies
plain functions and the kit the entry points, and WGSL origins are top-left everywhere (2026-11-06). Paint
kinds got a prelude of the same shape (`gpu/webgpu/wgsl/paintPrelude.ts`).

## Choosing a backend

- `new WeaselRenderer({ gpu: { device, canvas } })` builds a WebGPU renderer synchronously from a device
  the caller already holds. `requestRendererDevice()` returns the process's one shared `GPUDevice`, or
  `null` where WebGPU is unavailable.
- Core's canvas paint options take `backend: 'webgl2' | 'webgpu' | 'auto'`, default `'webgl2'` until the
  visual suite passes on WebGPU; `CanvasBackendProvider` sets it for a subtree. A canvas can hold only one
  kind of context, so the choice is made when its first renderer is built and kept for the element:
  `'auto'` takes WebGPU when a device is ready and every program registered so far has WGSL. Until the
  device resolves, the lease returns `null` and repaints through its `restored` signal, the path context
  restore already uses; a lost device is rebuilt on the next one the same way. `'webgpu'` where there is no
  device paints nothing and says so, so a WebGPU run cannot pass on WebGL. A tile of a shared canvas stays on
  WebGL 2: each WebGPU renderer keeps a buffer of its own and presents all of it, which would erase its
  co-tenants (2026-11-06).
- A program with no WGSL registered after a canvas went WebGPU draws nothing there and is reported once,
  the mirror of a WGSL-only program on WebGL (my call, 2026-11-06: a canvas cannot change context kind
  mid-life, and swapping the element would lose its listeners and layout).
- `renderIds` stays synchronous on WebGL. `renderIdsAsync` exists on both and is the only form on WebGPU.
  Core's `pickAt` and `readIds` moved to it and return promises. The select tool's `'pixels'` picking must
  answer inside the pointer event, so it reads `readIdsSync`, which is `null` on WebGPU, and walks the shapes
  there instead. `RasterSession.renderIds` stays synchronous: a raster session is WebGL only.

## Public surface that changes

- `PaintBindContext.gl` and paint kinds calling `useProgram` / `uniform*` themselves go. A kind's `bind`
  names its program and returns uniforms and textures by name, which either backend binds.
- `DrawContext` and `ShaderProgram` stop exposing `WebGL*` types.
- `WeaselRendererOptions` gains `gpu`.

## Testing

- jsdom tests keep driving the WebGL backend through `glRecorder`; a test pinning a GL call sequence that
  stage 1 legitimately reorders is rewritten to pin the behavior instead.
- WebGPU tests are `*.browser.test.ts` on the fleet. The browser project launches Chromium with
  `--enable-unsafe-webgpu`, which gives headless Chromium a SwiftShader adapter (probed on teitou,
  2026-11-06; without the flag `requestAdapter` returns `null`).
- A parity suite renders one corpus of command lists through both backends in the same page and diffs the
  pixels. It is the evidence the fleet can produce, since the visual baselines are Linux captures. It runs in
  the browser project's `browser (gpu)` instance, launched with `--enable-gpu`, so both backends draw on the
  node's GPU (ANGLE Metal and Dawn Metal), and skips where either is on SwiftShader. Headless Chromium puts
  WebGL on SwiftShader too without that flag, and there the backends part at edges for SwiftShader's reasons
  (`testing/parityHarness.ts`; measured 2026-11-06).
- One divergence is the APIs' own: a horizontal edge exactly on a row of pixel centers inks the row below it
  on WebGPU and the row above it on WebGL, whose window coordinates run bottom-up. A parity case pins it.
- The visual suite takes `WEASEL_VISUAL_BACKEND=webgpu`, which the site reads as `?backend=webgpu`. The TODO
  entry closes when that run passes on CI.

## Stages

Each stage ends green on its own tests and merges through a batch. The work landed in a different order
from the plan; this list says what is on the branch (2026-11-06).

1. **Landed.** GPU layer and its WebGL implementation; all draw code moved onto it; paint kinds and
   `DrawContext` made backend-neutral; viewport and id-attribute changes. No pixel changes.
2. **Landed.** WGSL reflection and uniform packing; WGSL for every kit program, the batch builds, glyph
   coverage from `@weasel-js/font`, gradients, patterns, mesh paint, composites and the effect builtins;
   the custom and effect preludes; WGSL for the custom-shader demo and `dither`.
3. **Landed.** `WebGPUDevice` (`gpu/webgpu/`): passes, pipelines, the uniform ring, buffers, textures and
   mipmaps, targets, MSAA resolve, ids and `renderIdsAsync`, the viewport fold (`weasel_clip`, bind group 2).
   Kit programs carry their WGSL; `WeaselRendererOptions.gpu` and `requestRendererDevice()` build a renderer
   on it. The parity suite (`gpu/webgpu/parity*.browser.test.ts`) draws one corpus through both backends in
   one page and diffs the pixels; two stroke cases are still a row of pixels apart (TODO entry).
4. **Landed.** Core's `backend` option and `CanvasBackendProvider`; async `pickAt` / `readIds`; the paint
   prelude for registered paint kinds. Every shader the repo registers with a `WeaselRenderer` has WGSL;
   kernel3d's line pass and labkit's 3D lab draw through WebGL contexts of their own and are not in scope.
5. **Plumbing landed, unrun.** The site reads `?backend=` into a `CanvasBackendProvider` at its root;
   `tests/visual/fixture.ts` appends it to every `page.goto` when `WEASEL_VISUAL_BACKEND` is set; the visual
   workflow's `visual-regression-webgpu` job runs the suite that way against the same baselines, without
   gating. Nothing has run it: it needs a push. Specs that read pixels through a WebGL context of their own
   (`batch-pixels.spec.ts`) cannot read a WebGPU canvas and are expected to fail there.

What the fleet's browsers impose on a WebGPU canvas, found building stage 3: headless Chromium's
SwiftShader adapter hands back invalid textures for a `bgra8unorm` canvas, so every canvas is configured
`rgba8unorm`; and an off-screen canvas's texture is invalid on every frame after its first until the
context is configured again, which the parity harness does before each frame. A WebGPU canvas in the
document loses the device for the whole page once it has been presented for a few frames
(`docs/traps/testing.md`), so the fleet's WebGPU tests draw only to canvases outside it, and the visual
suite's WebGPU run, whose canvases are on the page, may meet the same on CI's headless Chromium. Multisampled edge pixels part
even on one GPU, so multisampled parity is compared away from edges.
