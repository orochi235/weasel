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

```tsx
import { useMove, useDelete, createHistory, snap, gridSnapStrategy } from '@weasel-js/core';

const history = createHistory(adapter);

// Drag-to-move with snapping, history, and parent reparenting:
const move = useMove(adapter, {
  behaviors: [snap(gridSnapStrategy(20))],
});

// Selection-aware delete with Backspace/Delete bound:
useDelete(adapter, { bindKeyboard: true });
```

Most apps don't call the gesture hooks directly — `<SceneCanvas>` owns useMove /
useResize / useInsert / useAreaSelect / useSelection internally. Drop in a
`useScene()` tree and a `layers` map and you get click-to-select, drag-to-move,
corner-handle-resize, and an `tool="insert"` mode for free.

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

An `Action` is a named operation — `delete`, `duplicate`, `group`, `insert`, `viewport.dragPan` — paired with the input that triggers it. `<ActionsProvider>` holds the registered descriptors, and the gesture dispatcher matches live input against each one's `defaultBinding`. Keystrokes and pointer gestures take the same path, so a keyboard shortcut and a drag are two bindings on one action rather than two mechanisms.

`<SceneCanvas>` auto-mounts a provider when none is above it and registers the kit-standard descriptors, derived from the scene, selection, view and history it already owns.

```tsx
import { SceneCanvas } from '@weasel-js/core';

<SceneCanvas
  scene={scene}
  selection={selection}
  actions={{
    duplicate: null,                                // drop the default
    'app.publish': {                                // add your own
      id: 'app.publish',
      label: 'Publish',
      defaultBinding: { kind: 'key', key: 'p', mods: { mod: true } },
      requires: ['selection'],
      invoker: { timing: 'immediate', run: ({ selection }) => publish(selection.get()) },
    },
  }}
/>
```

The `actions` prop takes `null` to unregister every default, or a record keyed by action id. Each value is `null` to drop that one id, a partial `Action` to merge onto the default of the same id, or a complete `Action` to register a new one.

An action does its work through `invoker`, not a bare callback. `{ timing: 'immediate' }` runs once; `{ timing: 'ongoing' }` returns a handle so a drag can preview while it moves and commit at the end. The deps an invoker reads (`selection`, `scene`, `applyOps`, …) are declared in `requires` and resolved at invocation time, which is what lets a consumer swap one — see `useDepSource`.

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
