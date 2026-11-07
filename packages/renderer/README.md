# @weasel-js/renderer

A WebGL 2 or WebGPU renderer that turns a list of draw commands into pixels.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/renderer).

```sh
npm install @weasel-js/renderer
```

It knows nothing about a scene graph and has no React in it. `@weasel-js/core`
builds draw commands from scene nodes and hands them here; anything else that
can build a `DrawCommand[]` can do the same.

## Drawing

```ts
import { WeaselRenderer, type DrawCommand } from '@weasel-js/renderer';

const renderer = new WeaselRenderer({ canvas, width: 800, height: 600, dpr: devicePixelRatio });
renderer.render(commands);
```

A `DrawCommand` is a path, a group, text, an image, a run of sprites, or a
shader quad. Paths carry a fill and a stroke from `@weasel-js/paint`; a group
carries a transform, a clip, a color matrix, and effects. Neighboring commands
that can share a draw call are merged into one.

`cullDrawCommands` drops the commands that cannot reach a screen rectangle.

To draw with WebGPU, pass a device and the canvas instead.
`requestRendererDevice()` gives the page's one shared `GPUDevice`, or `null`
where WebGPU is unavailable:

```ts
const device = await requestRendererDevice();
const renderer = device
  ? new WeaselRenderer({ gpu: { device, canvas }, width: 800, height: 600, dpr: devicePixelRatio })
  : new WeaselRenderer({ canvas, width: 800, height: 600, dpr: devicePixelRatio });
```

`renderer.backend` says which it drew with. `renderIdsAsync` reads back which
`pickId` each pixel carries on both; `renderIds`, the synchronous form, works
on WebGL only. `@weasel-js/core`'s canvases choose with their `backend` prop.

## Paint

- `commandPaint` and `commandStroke` resolve a `Paint` or `Stroke` against a
  pose box into what a command carries.
- `createTilePattern` builds a repeating tile; `resolvePatternSpec` builds one
  from a serializable `TilePatternSpec`. The named tiles (`hatch`, `crosshatch`,
  `dots`, `chunks`) are under `@weasel-js/renderer/patterns-builtin`.
- `registerPaintDrawKind` adds a fill kind the renderer can bind: its shader
  programs and how its geometry moves between a pose frame and a bounds frame.
  The mesh gradient is one, under `@weasel-js/renderer/mesh`.

## Shaders and effects

`registerProgram` registers a fragment shader a `kind: 'shader'` command draws
with, in GLSL, WGSL or both, and `registerTexture` a texture it can sample.
`registerEffect` adds a full-screen pass a group names in `effects`; `blur` and
`vignette` are built in. Each backend draws from its own language, and draws
nothing for a program without it, saying so once in the console.

### Writing WGSL

A WGSL program supplies plain functions; the kit supplies the entry points
that call them, so ids, origins and premultiplied output stay the kit's job.

```ts
registerProgram('tinted', { glsl: { frag: TINTED_GLSL }, wgsl: { frag: `
struct Params { u_tint: vec4f }
@group(1) @binding(0) var<uniform> params: Params;
@group(1) @binding(1) var u_tex: texture_2d<f32>;
@group(1) @binding(2) var u_tex_sampler: sampler;

fn fragment(in: Varyings) -> vec4f {
  return textureSample(u_tex, u_tex_sampler, in.uv) * params.u_tint;
}` } });
```

| Program | Supplies | Reads |
|---|---|---|
| shader (`registerProgram`) | `fn fragment(in: Varyings) -> vec4f`; optional `vert`: `fn vertex(v: KitVertex) -> Varyings` | `in.position`, `uv`, `screen`, `world`, `worldLocal`; `kit.proj`, `bounds`, `view`, `screenToLocal`, `worldOrigin`, `fragOrigin` |
| effect (`registerEffect`) | `fn effect(in: EffectVaryings) -> vec4f` | `in.position`, `uv`; `source` / `source_sampler`; `kit.resolution`, `texel`, `windowOrigin` |
| paint kind (`registerPaintDrawKind`) | `fn fragment(in: PaintVaryings) -> vec4f`; optional `vert`: `fn vertex(v: PaintVertex) -> PaintVaryings` | `in.position`, `screen`, `world` (the screen point through `u_worldInv`); `kit.proj`, `model`, `worldInv`, `origin` |

- The program's own uniforms are one struct at `@group(1) @binding(0)`, and
  its textures group-1 variables, each `texture_2d<f32>` named `x` beside a
  `sampler` named `x_sampler`. Uniform values are the same object a GLSL
  program takes (`{ u_tint: [1, 0, 0, 1], u_tex: handle }`), by member name.
- Output is premultiplied, as in GLSL.
- Every coordinate is top-left origin in WGSL, `fragOrigin` and an effect's
  `uv` included; GLSL keeps its bottom-left ones.
- A module that declares its own `@vertex` entry point is compiled as it is.

## Text and images

`textCommand`, `textCommandFromRuns`, and `textCommandFromPose` build a text
command from laid-out runs. Fonts are registered through `@weasel-js/font`,
which this package re-exports.

`getImageBitmap` decodes and caches an image by its `src`, and
`subscribeImageReady` reports when one a frame asked for has arrived.

## Testing

`@weasel-js/renderer/testing/glRecorder` is a WebGL2 stand-in that records
every call, for asserting what a frame drew without a GPU.
