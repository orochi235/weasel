# @weasel-js/renderer

A WebGL2 renderer that turns a list of draw commands into pixels.

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
with, and `registerTexture` a texture it can sample. `registerEffect` adds a
full-screen pass a group names in `effects`; `blur` and `vignette` are built in.

## Text and images

`textCommand`, `textCommandFromRuns`, and `textCommandFromPose` build a text
command from laid-out runs. Fonts are registered through `@weasel-js/font`,
which this package re-exports.

`getImageBitmap` decodes and caches an image by its `src`, and
`subscribeImageReady` reports when one a frame asked for has arrived.

## Testing

`@weasel-js/renderer/testing/glRecorder` is a WebGL2 stand-in that records
every call, for asserting what a frame drew without a GPU.
