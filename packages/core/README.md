# weasel

A 2D scene-graph engine for React, rendered on WebGL2. Bring your own node data and pose shape; weasel owns the scene tree, the viewport math, pointer and keyboard input, layered rendering, and op-based undo/redo — plus a standard set of editing actions (select, move, resize, rotate, delete, duplicate, nudge, group, align, clipboard, …) bound to the keys and gestures an editor user expects.

Built for diagram editors, sketch tools, schematic editors, scene composers — anything where "objects on a canvas the user can grab, move, and arrange" is the substrate.

## Features

- Pointer interactions: move, resize, rotate, insert, clone, area-select, lasso, path-anchor editing, text edit
- Op-based scene mutation with undo/redo and coalescing
- A registry of actions with default key and gesture bindings, each one overridable by id (`@experimental`)
- Layered canvas rendering with debug overlays
- Rect, rotated and path poses; first-class compound paths; nested containers
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

`useScene` holds the scene: a tree of leaf and container nodes, each carrying your data and a pose. Every change to it is an **op**, which is what makes it undoable. `<SceneCanvas>` renders a scene and routes input to it.

Interactions are **actions** — descriptors registered into an actions registry — reached by **gesture bindings**. A tool is a list of `{ spec, actionId }` pairs and nothing more; the kit's own select, shape and viewport tools are built that way.

```tsx
import { SceneCanvas, useScene, useSelection, gridSnapStrategy, type RectPose } from '@weasel-js/core';

const W = 800, H = 600;

export function Editor() {
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: [] });
  const selection = useSelection({ mode: 'multi' });

  // Click to select, drag to move with grid snapping, handles to resize and
  // rotate, the shape tools, and the standard keyboard actions (Cmd+A, Cmd+Z,
  // Delete, …):
  return (
    <SceneCanvas
      width={W}
      height={H}
      scene={scene}
      selection={selection}
      selectionMode="multi"
      toolBundle="exhaustive"
      selectTool={{ snap: gridSnapStrategy<RectPose>(20) }}
      layers={{
        grid: { spacing: 20, bounds: () => ({ x: 0, y: 0, width: W, height: H }) },
      }}
    />
  );
}
```

To change a behavior you override the descriptor by id, bind a different gesture to it, or register your own — you don't call a hook per interaction. [docs/hooks.md](https://github.com/orochi235/weasel/blob/main/docs/hooks.md) has the full action table.

Lower-level surfaces take a narrow **adapter** instead of a scene — a few methods that read your state and apply ops back — so they work over state weasel doesn't own. See [docs/adapters.md](https://github.com/orochi235/weasel/blob/main/docs/adapters.md).

## Demo

<https://orochi235.github.io/weasel/> — every kit feature as a small runnable demo, plus the release history for every published version.

## Actions registry

An `Action` is a named operation — `delete`, `duplicate`, `group`, `insert`, `viewport.dragPan` — paired with the input that triggers it. `<ActionsProvider>` holds the registered descriptors, and the gesture dispatcher matches live input against each one's `defaultBinding` and the active tool's bindings. Keystrokes and pointer gestures take the same path, so a keyboard shortcut and a drag are two bindings on one action rather than two mechanisms.

`<SceneCanvas>` mounts a provider when none is above it and registers the kit-standard actions: escape, select-all, delete, duplicate, group and ungroup, undo and redo, flip, nudge, reorder, align, distribute, the pathfinder booleans, path-anchor editing, fill and stroke, clipboard, and the pointer-driven move, resize, rotate, insert, clone, area-select and lasso.

```tsx
<SceneCanvas
  width={W}
  height={H}
  scene={scene}
  selection={selection}
  actions={{
    duplicate: null,                  // drop the default
    'app.publish': {                  // add your own
      id: 'app.publish',
      label: 'Publish',
      defaultBinding: { kind: 'key', key: 'p', mods: { mod: true } },
      requires: ['selection'],
      invoker: {
        timing: 'immediate',
        run: (deps) => publish((deps.selection as SelectionApi).get()),
      },
    },
  }}
/>
```

The `actions` prop takes `null` to unregister every default, or a record keyed by action id. Each value is `null` to drop that one id, a partial `Action` to merge onto the default of the same id, or a complete `Action` to register a new one.

An action does its work through `invoker`, not a bare callback. `{ timing: 'immediate' }` runs once; `{ timing: 'ongoing' }` returns a handle so a drag can preview while it moves and commit at the end. The deps an invoker reads (`selection`, `scene`, `applyOps`, …) are declared in `requires` and resolved at invocation time, which is what lets a consumer swap one — see `useDepSource`. To fire an action yourself, wrap the canvas in your own `<ActionsProvider>` and call `trigger(id, params)` on the registry `useActionsRegistry()` returns.

## Text rendering

Text is rendered via MSDF atlases. Register fonts before the first paint:

```tsx
import { registerFont } from '@weasel-js/core';

await registerFont('Inter', { weight: 400 }, '/fonts/Inter-400.json', '/fonts/Inter-400.png');
```

Core doesn't ship a prebuilt atlas — bake one from a weasel checkout with `npm run gen:font -- <font.ttf> --name Inter-400 --out public/fonts` (see [`packages/font/scripts/gen-font.ts`](https://github.com/orochi235/weasel/blob/main/packages/font/scripts/gen-font.ts)) and serve the resulting `.json`/`.png` pair. `@weasel-js/hud` bundles its own Inter atlas for its widgets.

The glyph tier lives in `@weasel-js/font`; `registerFont` is re-exported from core, so the import above keeps working. An unregistered family renders in the default family with a one-time warning — see that package's README for `setFontFallbackPolicy`.

## Custom shaders (`@experimental`)

A render layer can draw with its own fragment shader. Register the program once, then return a `kind: 'shader'` draw command with its uniforms and bounds:

```tsx
import { registerProgram } from '@weasel-js/core/renderer';

const stripes = registerProgram('stripes', '', `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
out vec4 outColor;
void main() {
  float v = 0.5 + 0.5 * sin(v_uv.x * 40.0 + u_time);
  outColor = vec4(vec3(v), 1.0);
}`);

// Inside a RenderLayer's draw:
return [{
  kind: 'shader',
  program: stripes,
  uniforms: { u_time: performance.now() / 1000 },
  bounds: { x: 0, y: 0, w: 256, h: 256 },
}];
```

An empty vertex source selects the kit's vertex shader, which provides the `v_uv`, `v_screen` and `v_world` varyings and sets `u_bounds`, `u_view` and `u_proj` itself. Uniforms take a number, a 2–4 element tuple, a `Float32Array`, or a `TextureHandle` from `registerTexture`. Output **premultiplied** alpha — `vec4(rgb * a, a)` — or translucent pixels come out too bright. `bounds` is in CSS pixels.

## Subpath imports

Core's main entry carries the everyday surface. A few narrower ones have their own:

| Import | Holds |
|---|---|
| `@weasel-js/core/renderer` | the renderer, `registerProgram`, `registerTexture`, draw commands |
| `@weasel-js/core/move`, `/resize`, `/insert`, `/clone`, `/clipboard` | helpers for building on those actions, e.g. `snapToGrid`, `clampMinSize` |
| `@weasel-js/core/patterns-builtin` | the built-in fill patterns |
| `@weasel-js/core/routing` | route grammar and introspection: parsing, the route registry, conflict checks |

## Packages

Every package is published under `@weasel-js` and released together at one version.

| Package | What it is |
|---|---|
| `core` | the scene graph, `<SceneCanvas>`, actions, tools, and the WebGL2 renderer |
| `geom` | pure 2D geometry — affine, box, curve, polyline; polygon booleans under `./booleans` |
| `gestures` | the gesture taxonomy, route grammars and matchers; no React, no DOM |
| `history` | undo/redo with scoped sub-histories; no React, no DOM |
| `paint` | fills, strokes, gradients and dashes as plain data |
| `text` | styled runs, kerned layout, wrapping and measurement |
| `bidi` | the Unicode Bidirectional Algorithm (UAX #9) |
| `font` | MSDF atlases, glyph metrics and runtime glyph rasterization |
| `svg` | SVG import and export |
| `modes` | app-level modality: capability tags, mode definitions, a mode registry |
| `diagram` | node-link diagrams: ports on any node's perimeter, flowchart-style bodies |
| `hud` | WebGL-rendered widgets composited into a canvas |
| `cursor` | tool cursors as authored glyphs, baked to CSS or painted when too large |
| `loupe` | a magnifier model: where it's aimed, how far it magnifies, what's under it |
| `audio` | a Web Audio engine: voices, buses, lookahead scheduling, spatialization; no weasel dependencies |
| `d3` | d3 data-join and transitions over `useScene` |
| `theme` | design tokens as CSS variables and a parallel TypeScript export |
| `ui` | React chrome components for weasel apps |
| `labkit` | React widgets for self-contained interactive lab pages |

## Documentation

- [Concepts](https://github.com/orochi235/weasel/blob/main/docs/concepts.md)
- [Hooks](https://github.com/orochi235/weasel/blob/main/docs/hooks.md)
- [Adapters](https://github.com/orochi235/weasel/blob/main/docs/adapters.md)
- [Extending](https://github.com/orochi235/weasel/blob/main/docs/extending.md)
- [Scene serialization](https://github.com/orochi235/weasel/blob/main/docs/scene-serialization.md)

## License

MIT.
