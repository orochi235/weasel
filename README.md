# weasel

2D scene-graph hooks for React + canvas, with an experimental WebGL2 backend. Bring your own object type and pose shape; weasel handles the viewport math, pointer gestures (move / resize / insert / clone / area-select / text edit), layered canvas rendering, an op-based undo/redo model, and a stack of selection-driven action hooks (delete, duplicate, nudge, group, clipboard, undo/redo, …) wired to keyboard shortcuts when you ask.

Built for diagram editors, sketch tools, schematic editors, scene composers — anything where "objects on a canvas the user can grab, move, and arrange" is the substrate.

> Pre-1.0: the API surface (paths, nested groups, per-subobject units) is still settling. Expect breaking changes between minor versions until 1.0.

## Features

- Pointer gestures: move, resize, rotate, insert, clone, area-select, text edit
- Op-based scene mutation with undo/redo and coalescing
- Selection-driven action hooks (delete, duplicate, nudge, reorder, clipboard, …)
- Centralized actions registry with default keybindings (`@experimental`)
- Layered canvas rendering with debug overlays
- Path poses, rect poses, rotated poses; first-class compound paths
- Viewport with zoom/pan tools, momentum, and boundary clamping
- Two backends: Canvas 2D (default) and WebGL2 (`@experimental`)
- Custom fragment shaders via `registerProgram` (`@experimental`)

## Install

```sh
npm install @orochi235/weasel react
```

`react` is a peer dependency (>=18).

## How it fits together

Every interaction takes a small, narrow **adapter** — a few methods that read the current scene and apply ops back. The kit doesn't own your scene; it asks. That keeps it agnostic to whether your scene lives in React state, Zustand, Redux, or a CRDT.

```tsx
import { useMove, useDelete, createHistory, snap, gridSnapStrategy } from '@orochi235/weasel';

const history = createHistory(adapter);

// Drag-to-move with snapping, history, and parent reparenting:
const move = useMove(adapter, {
  behaviors: [snap(gridSnapStrategy(20))],
});

// Selection-aware delete with Backspace/Delete bound:
useDelete(adapter, { bindKeyboard: true });
```

Most apps don't call the gesture hooks directly — `<Canvas>` owns useMove /
useResize / useInsert / useAreaSelect / useSelection internally. Drop in an
adapter and a `layers` map and you get click-to-select, drag-to-move,
corner-handle-resize, and an `tool="insert"` mode for free.

See the live demo for a full working example: <https://orochi235.github.io/weasel/>

## Demo

Live demo: <https://orochi235.github.io/weasel/>

## Backends

`<Canvas>` and `<SceneCanvas>` accept a `backend?: '2d' | 'gl'` prop. The default is `'2d'` (Canvas 2D); `'gl'` opts into the WebGL2 backend implemented in `@orochi235/weasel-gl`.

```tsx
<SceneCanvas scene={scene} selection={selection} backend="gl" />
```

The GL backend is `@experimental` until the visual-regression soak completes (see the WebGL transition roadmap). When the soak lands, the default flips to `'gl'` and the 2D path is removed in a major version. Until then both backends are first-class:

- `RenderLayer` gained an additive `drawGL?` method. Layers without `drawGL` warn-once under `backend='gl'` and skip; the 2D `draw` path is unchanged.
- A `<canvas>` element holds one context type for life. Switching `backend` after mount warns once; remount the canvas to actually switch.
- Text under `backend='gl'` uses MSDF atlases. Register fonts before the first paint:

```tsx
import { registerFont } from '@orochi235/weasel-gl';

await registerFont('Inter', '/fonts/inter.json');
```

## Actions registry

`<ActionsProvider>` wires a single `keydown` listener and dispatches to a registry of `Action` descriptors. `<SceneCanvas>` auto-mounts a provider (if no parent provider exists) and registers default actions for select-all, escape, duplicate, nudge, and reorder, all derived from the scene/selection/adapter it already owns.

```tsx
import { ActionsProvider, SceneCanvas } from '@orochi235/weasel';

<ActionsProvider>
  <SceneCanvas
    scene={scene}
    selection={selection}
    actions={{
      selectAll: null,                              // disable the default Cmd+A
      copy: {                                       // add an app-specific action
        label: 'Copy',
        defaultBinding: { key: 'c', mod: true },
        run: () => clipboard.copy(selection.current),
      },
    }}
  />
</ActionsProvider>
```

The `actions` prop accepts `null` (disable all defaults), a partial override of any default by id, or a full `Action` descriptor for new ids. Bare `<Canvas>` consumers can use `useStandardActions(adapter, scene, selection)` to register the same default set, or call individual hooks (`useSelectAll`, `useEscape`, `useDuplicate`, `useNudge`, `useReorder`) which auto-register into a parent provider when present and fall back to direct keybindings when not.

## Custom shaders (`@experimental`)

The GL backend supports `kind: 'shader'` `DrawCommand`s for layers that want a custom fragment shader. Register the program once, then emit a draw command with uniforms and bounds:

```tsx
import { registerProgram, registerTexture } from '@orochi235/weasel-gl';

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

// Inside a RenderLayer.drawGL, return a tree of DrawCommands:
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
import { snapToGrid } from '@orochi235/weasel/move';
import { snapToGrid, clampMinSize } from '@orochi235/weasel/resize';
import { snapToGrid } from '@orochi235/weasel/insert';
```

## Documentation

- [Concepts](./docs/concepts.md)
- [Hooks](./docs/hooks.md)
- [Adapters](./docs/adapters.md)
- [Extending](./docs/extending.md)

## License

MIT.
