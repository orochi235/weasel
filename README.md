# weasel

Domain-agnostic 2D scene-graph hooks for React, rendered on WebGL2. Bring your own object type and pose shape; weasel handles the viewport math, pointer gestures (move / resize / insert / clone / area-select / text edit), layered scene rendering, an op-based undo/redo model, and a stack of selection-driven action hooks (delete, duplicate, nudge, group, clipboard, undo/redo, …) wired to keyboard shortcuts when you ask.

Built for diagram editors, sketch tools, schematic editors, scene composers — anything where "objects on a canvas the user can grab, move, and arrange" is the substrate.

> Pre-1.0: the API surface (paths, nesting, per-subobject units) is still settling. Expect breaking changes between minor versions until 1.0.

## Features

- Pointer gestures: move, resize, rotate, insert, clone, area-select, text edit
- Op-based scene mutation with undo/redo and coalescing
- Selection-driven action hooks (delete, duplicate, nudge, reorder, clipboard, …)
- Centralized actions registry with default keybindings (`@experimental`)
- Layered canvas rendering with debug overlays
- Path poses, rect poses, rotated poses; first-class compound paths
- Viewport with zoom/pan tools, momentum, and boundary clamping
- Detached read-only scene views and navigation minimap (`<SceneViewCanvas>`, `<MinimapCanvas>`)
- WebGL2 renderer with MSDF text, gradients, patterns, and per-vertex colors
- Custom fragment shaders via `registerProgram` (`@experimental`)

## Install

```sh
npm install @weasel-js/core react
```

`react` is a peer dependency (>=18).

## How it fits together

Every interaction takes a small, narrow **adapter** — a few methods that read the current scene and apply ops back. The kit doesn't own your scene; it asks. That keeps it agnostic to whether your scene lives in React state, Zustand, Redux, or a CRDT.

Interactions are **actions** — static descriptors registered into an actions
registry — reached by **gesture bindings**. A tool is an array of
`{ spec, actionId }` pairs; nothing more.

```tsx
import { SceneCanvas, useScene, useSelection, gridSnapStrategy } from '@weasel-js/core';

const scene = useScene();
const selection = useSelection({ mode: 'multi' });

// Click-to-select, drag-to-move with grid snapping, corner-handle resize,
// marquee, and the standard keyboard actions (Cmd+A, Cmd+Z, Delete, …):
<SceneCanvas
  scene={scene}
  selection={selection}
  layers={{ grid: { spacing: 20 }, selectionOverlay: { handles: true } }}
  selectTool={{ snap: gridSnapStrategy(20) }}
/>;
```

`<SceneCanvas>` mounts the actions registry, the dep registry, and the gesture
dispatcher, and registers the kit-standard action set. To change a behavior you
override the descriptor by id, bind a different gesture to it, or register your
own — you don't call a hook per interaction. See
[docs/hooks.md](./docs/hooks.md) for the full action table.

See the live demo for a full working example: <https://orochi235.github.io/weasel/>

## Demo

Live demo: <https://orochi235.github.io/weasel/>

## Text rendering

Text is rendered via MSDF atlases. Register fonts before the first paint:

```tsx
import { registerFont } from '@weasel-js/core';

await registerFont('Inter', { weight: 400 }, '/fonts/Inter-400.json', '/fonts/Inter-400.png');
```

Core doesn't ship a prebuilt atlas — bake one with `npm run gen:font -- <font.ttf> --name Inter-400 --out public/fonts` (see `scripts/gen-font.ts`) and serve the resulting `.json`/`.png` pair. The `hud` package ships its own bundled Inter atlas for consumers who don't need custom fonts.

## Actions registry

`<ActionsProvider>` owns a registry of `Action` descriptors; the gesture dispatcher matches input against each descriptor's `defaultBinding` (and against the active tool's `bindings`) and invokes it with deps resolved from the dep registry. `<SceneCanvas>` auto-mounts a provider (if no parent provider exists) and registers the ~50 kit-standard actions — select-all, escape, delete, duplicate, undo/redo, nudge, reorder, group, align, distribute, pathfinder, plus the pointer-driven move/resize/rotate/insert/marquee set — all derived from the scene/selection/adapter it already owns.

```tsx
import { ActionsProvider, SceneCanvas } from '@weasel-js/core';

<ActionsProvider>
  <SceneCanvas
    scene={scene}
    selection={selection}
    actions={{
      selectAll: null,                              // disable the default Cmd+A
      copy: {                                       // add an app-specific action
        label: 'Copy',
        defaultBinding: { kind: 'key', key: 'c', mods: { mod: true } },
        invoker: {
          timing: 'immediate',
          run: () => clipboard.copy(selection.current),
        },
      },
    }}
  />
</ActionsProvider>
```

The `actions` prop accepts `null` (disable all defaults), a partial override of any default by id, or a full `Action` descriptor for new ids. There is no per-action hook to reach for — finer control means overriding the descriptor, changing what gesture binds to it, or triggering it imperatively via `registry.trigger(id, params)`.

## Custom shaders (`@experimental`)

The renderer supports `kind: 'shader'` `DrawCommand`s for layers that want a custom fragment shader. Register the program once, then emit a draw command with uniforms and bounds:

```tsx
import { registerProgram, registerTexture } from '@weasel-js/core';

const voronoi = registerProgram(
  'voronoi',
  /* vert */ null,                            // null → use the default quad prelude
  /* frag */ `
    precision highp float;
    varying vec2 v_uv;
    uniform float u_time;
    void main() { /* … */ }
  `,
);

// Inside a RenderLayer.draw, return a tree of DrawCommands:
return {
  kind: 'shader',
  program: voronoi,
  uniforms: { u_time: performance.now() / 1000 },
  bounds: { x: 0, y: 0, w: 256, h: 256 },
};
```

Uniforms support `number`, `vec2..4`, `mat3`, `mat4`, and `TextureHandle` (from `registerTexture`). The vertex prelude exposes `v_uv`, `v_screen`, and `v_world` varyings. API may change before v2.

## Subpath imports

For tree-shaking and clarity, hook-specific helpers are scoped:

```ts
import { snapToGrid } from '@weasel-js/core/move';
import { snapToGrid, clampMinSize } from '@weasel-js/core/resize';
import { snapToGrid } from '@weasel-js/core/insert';
```

## Documentation

- [Concepts](./docs/concepts.md)
- [Hooks](./docs/hooks.md)
- [Adapters](./docs/adapters.md)
- [Extending](./docs/extending.md)

## License

MIT.
