# WebGPU backend for WeaselRenderer — design

**Status: unbuilt (2026-11-06).** Work in flight on branch `webgpu` (`/Users/mike/src/weasel-webgpu`); the
stage list at the end says which parts have landed. Delete this file when the last stage merges, moving
the WGSL contract into `packages/renderer/README.md` first.

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
| `beginPass({ target, color, stencil, viewport, scissor })` | bind framebuffer, viewport, scissor, `clear` | `beginRenderPass`, `loadOp: 'clear' \| 'load'` |
| `setViewport` / `setScissor` mid-pass | `viewport` / `scissor` | `setViewport` / `setScissorRect` |
| `draw({ program, blend, colorWrite, stencil, ids }, bindings, geometry, count)` | apply cached state, `uniform*`, `drawElements` | pipeline from a cache keyed on the state, uniforms packed into a ring buffer at a dynamic offset |
| `clearStencilBits(mask)` | `stencilMask(mask); clear(STENCIL)` | a full-target draw, write mask `mask`, op `zero` |
| `resolve(msaaTarget, into, rect)` | the two `blitFramebuffer`s of `surfaceGl.ts` | `resolveTarget`, then `copyTextureToTexture` |
| `readIds(rect)` → `Promise` | `readPixels` | `copyTextureToBuffer`, `mapAsync` |
| textures: `rgba8`, `r8`, mipmapped `rgba8` | `texImage2D`, `generateMipmap` | `writeTexture` / `copyExternalImageToTexture({ premultipliedAlpha: true })`, mips drawn level by level |

Stencil states are a closed set (clip test at a depth, parity write, parity paint, clip push simple and
even-odd, clip pop, aligned fill, aligned ribbon inner and outer): compare, masks and op go in the pipeline
key, the reference is dynamic. Blend modes are the premultiplied default and the 11 Porter-Duff operators of
`effects/compositeOp.ts`, plus off.

Two GL tricks go, on both backends: the negative-origin viewport (`groupEffects.ts`, `retained.ts`) moves
into the projection, since WebGPU validates viewport bounds; and the pick id moves from a disabled generic
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

WGSL is not rewritten the way GLSL is (`withIdOutput`). A custom program supplies plain functions, and the
kit supplies the entry points that call them, so ids, origins and premultiplication stay the kit's job:

```wgsl
// registerProgram(id, { wgsl: { frag } }): the kit's prelude declares Varyings and `kit`.
struct Params { u_time: f32, u_tint: vec4f }
@group(1) @binding(0) var<uniform> params: Params;
@group(1) @binding(1) var u_tex: texture_2d<f32>;
@group(1) @binding(2) var u_tex_sampler: sampler;

fn fragment(in: Varyings) -> vec4f {            // premultiplied
  return textureSample(u_tex, u_tex_sampler, in.uv) * params.u_tint;
}
```

- `Varyings`: `position` (`@builtin(position)`), `uv`, `screen`, `world`, `worldLocal`. The GLSL varyings
  `v_uv`, `v_screen`, `v_world` and `v_worldLocal`, under their WGSL names.
- `kit` (`@group(0) @binding(0)`): `proj`, `bounds`, `view`, `screenToLocal`, `worldOrigin`, `fragOrigin`.
- A custom `wgsl.vert` supplies `fn vertex(in: KitVertex) -> Varyings`. Unset, it is the kit's vertex stage
  for wherever the program is drawn: a shader quad, or an effect pass.
- Uniform values are the same object a GLSL program takes (`{ u_time: 0.5, u_tex: handle }`): a name is a
  member of the struct at `@group(1) @binding(0)`, or a texture variable in group 1.
- Effects supply `fn effect(in: EffectVaryings) -> vec4f`, with `source` / `source_sampler`, `resolution`,
  `texel` and `windowOrigin` in `kit`.
- **Origins are WGSL's, top-left, everywhere.** GLSL keeps its bottom-left `u_fragOrigin` and bottom-up
  effect `v_uv`; a WGSL author never sees a flipped coordinate. The one divergence between the languages,
  chosen so each reads natively (2026-11-06).

## Choosing a backend

- `new WeaselRenderer({ gpu: { device, context } })` builds a WebGPU renderer synchronously from a device
  the caller already holds. `requestRendererDevice()` returns the process's one shared `GPUDevice`, or
  `null` where WebGPU is unavailable.
- Core's canvas paint options take `backend: 'webgl2' | 'webgpu' | 'auto'`, default `'webgl2'` until the
  visual suite passes on WebGPU. A canvas can hold only one kind of context, so the choice is made when its
  first renderer is built: `'auto'` takes WebGPU when a device is ready and every program registered so far
  has WGSL. Until the device resolves, the lease returns `null` and repaints through its `restored` signal,
  the path context restore already uses.
- A program with no WGSL registered after a canvas went WebGPU draws nothing there and is reported once,
  the mirror of a WGSL-only program on WebGL (my call, 2026-11-06: a canvas cannot change context kind
  mid-life, and swapping the element would lose its listeners and layout).
- `renderIds` stays synchronous on WebGL. `renderIdsAsync` exists on both and is the only form on WebGPU;
  core's callers move to it.

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
  pixels. It is the evidence the fleet can produce, since the visual baselines are Linux captures.
- The visual suite takes `WEASEL_VISUAL_BACKEND=webgpu`, which the site reads as `?backend=webgpu`. The TODO
  entry closes when that run passes on CI.

## Stages

Each stage ends green on its own tests and merges through a batch.

1. GPU layer and its WebGL implementation; all draw code moved onto it; paint kinds and `DrawContext` made
   backend-neutral; viewport and id-attribute changes. No pixel changes.
2. WGSL reflection and uniform packing; the WebGPU implementation of passes, pipelines, buffers and
   textures; `pathFill` in WGSL; a first parity test.
3. WGSL for the rest of the kit's programs, including the batch builds, glyph coverage from
   `@weasel-js/font`, gradients, patterns, mesh paint and the effect builtins.
4. Effects, retained surfaces and MSAA resolve, ids and `renderIdsAsync` on WebGPU; mipmaps.
5. The custom WGSL contract (preludes, entry points), construction API, core's `backend` option, WGSL for
   every shader the repo registers (demos, `dither`, apps).
6. Parity suite over the visual demos; the visual suite's WebGPU run.
