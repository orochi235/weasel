# Concepts

The mental model behind `@weasel-js/core`. Read this before writing code.

## `<Canvas>`

A single `<canvas>` element wired up: it owns DPR setup, layer composition,
the pointer-event router, and (by default) the `useMove` / `useResize` /
`useRotate` / `useInsert` / `useAreaSelect` / `useSelection` hooks. Drop in an
adapter and a `layers` map and you get click-to-select, drag-to-move,
corner-handle resize, and a marquee for free.

```tsx
<Canvas<Rect, Pose>
  width={W} height={H}
  adapter={adapter}
  layers={{
    scene: { drawOne: (ctx, obj, pose) => { /* draw obj at pose */ } },
    grid: { spacing: 20, bounds: () => ({ x: 0, y: 0, width: W, height: H }) },
    selectionOverlay: { handles: true },
  }}
/>
```

You can override any of the internal controllers by passing your own
(`move`, `resize`, `selection`, …); supply `*Options` to configure the
default ones. See [hooks.md](./hooks.md) and `src/canvas/Canvas.tsx`.

## `<SceneViewCanvas>` and `<MinimapCanvas>` (detached views)

Three primitives can render a second view of a scene. Pick by where the
inset lives and whether it's interactive:

- **`<SceneViewCanvas>`** — a pointer-inert, read-only `<canvas>` that
  renders a `Scene` at an arbitrary `view`. Has its own GL context and DOM
  node. Use for thumbnails, side-by-side previews, printable snapshots, or
  any second view that doesn't accept input.
- **`<MinimapCanvas>`** — `<SceneViewCanvas>` plus a viewport-rectangle
  indicator and click/drag-to-recenter against a `mainView` callback. Use as
  a navigation widget in a sidebar/panel — a distinct DOM location from the
  main `<SceneCanvas>`.
- **`createViewportLayer`** — renders an inset *inside* the main
  `<SceneCanvas>`'s drawing buffer (superimposed PiP). Use when the inset
  must live as pixels in the main canvas, e.g. for a screenshot-stable
  minimap or a print-included overview.

Detached variants are the right default when the minimap belongs in a
panel; `createViewportLayer` stays as the canonical superimposed primitive.

```tsx
import { MinimapCanvas, SceneCanvas, useScene, useSelection } from '@weasel-js/core';
import { useState } from 'react';
import type { View } from '@weasel-js/core';

function App() {
  const scene = useScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <>
      <SceneCanvas
        width={600} height={400}
        scene={scene} selection={selection}
        view={view} onViewChange={setView}
        layers={{ scene: { drawOne: (n, p) => [/* … */] } }}
      />
      <MinimapCanvas
        scene={scene}
        mainView={view}
        mainViewDims={{ width: 600, height: 400 }}
        onMainViewChange={setView}
        width={200} height={140}
        drawOne={(n, p) => [/* stripped-down minimap variant */]}
        fit="scene"
      />
    </>
  );
}
```

Design rationale: see
[`docs/superpowers/specs/2026-05-31-detached-minimap-design.md`](./superpowers/specs/2026-05-31-detached-minimap-design.md).

## Adapter

Weasel never reads or writes your scene state directly. Every gesture takes
an **adapter** — a small object the consumer implements that exposes the
scene to the kit (`getNodes`, `getPose`, `setPose`, …) and accepts ops
back. Hook-specific adapters (`MoveAdapter`, `ResizeAdapter`,
`InsertAdapter`, `AreaSelectAdapter`, `RotateAdapter`) are narrow subsets of
a hypothetical full `SceneAdapter`. TypeScript's structural typing means
**one struct satisfies all of them at once** — most apps write a single
adapter and pass it to every hook.

`arrayAdapter` produces a multi-faceted adapter from a `useState` array
scene; it's the default for new apps. See [adapters.md](./adapters.md).

## Pose

A **pose** is the snapshot of an object the kit reads and writes. Its shape
is up to you — generic over `TPose`. The common case is a rect:

```ts
interface Pose { x: number; y: number; width: number; height: number }
```

Other shapes ship: `RotatedPose` (rect + `rotation`), `Path` (the kit's
polygon/cubic-bezier representation), `TextPose`. For non-rect poses, supply
a `PoseDescriptor<TPose>` (see [extending.md](./extending.md)) so the
rect-flavored math (resize, area-select, snap origin) still works.

`getPose` / `setPose` are **local-coordinate** — relative to the object's
parent. Rendering and hit-testing use world coords; the kit composes via
`composeWorldPose`.

## Descriptor

`PoseDescriptor<TPose>` projects an arbitrary `TPose` onto the kit's
rect-driven machinery:

- `getBounds(pose) → { x, y, width, height }` — AABB.
- `remapBounds(pose, src, dst) → pose` — affine remap on resize.
- `translate(pose, dx, dy)` — optional, used by move and snap.
- `intersectsRect(pose, rect)` — optional, tight test for area-select.

`RECT_POSE_DESCRIPTOR` is the identity for rect poses; `pathPoseDescriptor`
is the implementation for `Path`. Pass via `<Canvas geometry={...}>` (or
`useResize`'s `geometry` option for the lower-level path).

## Op

An **op** is an invertible mutation:

```ts
interface Op {
  apply(adapter: unknown): void;
  invert(): Op;
  label?: string;
  coalesceKey?: string;
}
```

Constructors live under `src/core/ops/`: `createTransformOp`,
`createInsertOp`, `createDeleteOp`, `createSetSelectionOp`,
`createBringForwardOp`, etc. Every gesture and action hook produces ops on
commit; `dispatchApplyBatch(adapter, ops, label)` calls
`adapter.applyBatch?.(ops, label)` if available, otherwise applies each op
directly against the adapter.

**Transient** ops apply via `adapter.applyOps(ops)` — no history entry.
Selection-only changes (e.g. marquee result) are transient by default.

## Controller

Each gesture hook returns a **controller**: lifecycle methods (`start`,
`move`, `end`, `cancel`) plus a live `overlay` field describing the
in-flight gesture. Controllers are stateful but pure — they don't touch the
DOM. `<Canvas>` reads the overlay each render and feeds the layer stack.

```ts
const move: MoveController<Rect, Pose> = useMove(adapter, { ... });
move.overlay; // { draggedIds, poses, snapped, hideIds } | null
```

## Layer

A `RenderLayer<TData>` is a named draw function. The `layers` prop on
`<Canvas>` is a map of slot name → config:

- **Standard slots** (canonical order): `grid`, `cellHighlight`, `scene`,
  `moveOverlay`, `resizeOverlay`, `selectionOverlay`, `insertOverlay`,
  `areaSelectOverlay`. Pass slot config (`{ drawOne, ... }` for `scene`,
  `{ spacing, bounds }` for `grid`, etc.) or `null` to suppress.
- **Custom layers**: any other key. Value is `{ layer, after?, before? }`
  with a `RenderLayer` and an optional anchor slot for ordering.

```ts
layers={{
  scene: { drawOne: (cx, obj, pose) => { /* ... */ } },
  hud: { layer: hudLayer, after: 'selectionOverlay' },
}}
```

See [extending.md](./extending.md) for custom-layer details.

**Hit-test channel.** Layers may declare an optional `hitTest(worldX, worldY, data, view, dims): HitResult | null` that the dispatcher consults on pointerdown. The dispatcher walks layers top-down (highest z-index first); the first layer whose `hitTest` returns a non-null `HitResult` owns the gesture — the supplied `drag` channel runs as if it were the active tool. This is how affordances stay hittable regardless of which tool is active.

## Affordance

A reusable factory primitive that produces a `{ render, hitTest? }` triple. Tools that own chrome (selection handles, rotation handle, anchor dots) compose affordances rather than reimplementing the render + hit-test logic inline. The kit ships `createCornerResizeAffordance` and `createRotationAffordance`; both read state from a kit-built `ChromeState` object so the affordance code stays pure (no React, no scene access).

The point of the abstraction: **visible chrome is hittable independent of the active tool.** Without affordances, each tool's overlay rendered handles but each tool's `pointer.onDown` had to hit-test those handles separately. With affordances, the dispatcher walks all visible layers' hit-tests top-down on pointerdown; a corner-handle click fires the resize gesture even when a non-select tool is active.

## Interaction

Everything the user does to the scene is an **interaction**. The kit splits
interactions into two kinds:

- **Gestures** — pointer-driven, with a start/move/end lifecycle. They live
  under `src/interactions/gestures/`. Each one returns a controller with a
  live `overlay` so the in-flight state can render between frames.
- **Actions** — discrete, one-shot mutations that don't have a drag phase.
  They live under `src/interactions/actions/`. Most are keybinding-driven
  (Esc, Cmd+A, Cmd+D, arrows, Cmd+Z), but they're really just functions
  that produce ops; the keybinding wiring is optional.

Same adapter, same op pipeline, same undo history. The split is about
*how the input arrives*, not about what the code can do.

## Gesture

A **gesture** is a pointer-driven interaction with a start/move/end
lifecycle. Move, resize, rotate, insert, area-select, clone, and
edit-anchors are all gestures. Each takes an adapter and an options object
that includes a `behaviors` array.

A **behavior** is a small composable extension that refines the in-flight
pose and/or supplies commit ops:

```ts
interface ActionBehavior<TPose, TProposed, TMoveResult> {
  defaultTransient?: boolean;
  onStart?(ctx): void;
  onMove?(ctx, proposed): TMoveResult | void;
  onEnd?(ctx): Op[] | null | void;
}
```

Behaviors run in array order; later ones see refinements from earlier ones.
`onEnd` returns: `Op[]` to commit, `null` to abort, `undefined` to fall
through. `ctx.scratch` is per-gesture mutable state. `defaultTransient`
flips the gesture to `applyOps` (no history) unless `transient` is set
explicitly. See [extending.md](./extending.md) for writing one.

Built-in behaviors: `snap(gridSnapStrategy(...))`, `snapToContainer(...)`,
`snapBackOrDelete(...)` for move; `snapToGrid`, `clampMinSize` for resize;
`selectFromMarquee()` for area-select; `cloneByAltDrag()` for clone.

## Action

An **action** is a non-pointer interaction — typically a keyboard shortcut
or a programmatic call — that produces ops in one shot. No `start`/`move`/
`end` phases, no overlay. The hooks are bare functions you wire and forget:

```ts
useEscape(adapter);                    // Esc clears selection
useSelectAll(adapter);                 // Cmd+A
useDuplicate<Pose>(adapter);           // Cmd+D
useNudge(adapter);                     // arrow keys
useReorder(adapter);                   // Cmd+[ / Cmd+]
useDelete(adapter, { bindKeyboard: true });
useGroup(adapter); useUngroup(adapter);
useNest(adapter); useUnnest(adapter);
useUndoRedo({ history });
useClipboard(adapter);
```

Each hook accepts a `bindKeyboard: false` opt to skip its default shortcut
so you can drive it from your own UI. Every action commits via the same
`dispatchApplyBatch(adapter, ops, label)` pipeline as gestures, so undo,
coalescing, and `applyBatch` overrides all work uniformly. See
[hooks.md](./hooks.md) for the full table and default keybindings.

### Keyboard activations are actions

Tool-switch shortcuts (`V` → Select) and held-key activations (Space → Hand)
are registered as actions in the actions registry, not as fields on
`ToolDef`. The factories in `src/interactions/actions/defaults/` produce
them:

- `makeToolActivateAction(bindings)` — single parametric action registered
  under id `tool.activate`. Its `defaultBinding` is a `BoundGesture[]` with
  one entry per tool; each entry carries `opts.params.toolId`. The invoker
  reads `params.toolId` and calls `activeTool.setActive(toolId)`. Imperative
  callers (palette, toolbar) reach the same effect via
  `registry.trigger('tool.activate', { toolId })`. Build entries with
  `buildToolActivateBindings(specs)`.
- `makeToolOffhandAction(bindings)` — single parametric action registered
  under id `tool.offhand` for hold-to-engage hotkeys (e.g. Space-for-hand).
  `defaultBinding` is a `BoundGesture[]` of `keyHeld` specs, each carrying
  `opts.params.toolId`. On `start` the invoker pushes the tool id onto the
  active-tool context's hotkey stack; `onEnd` pops it. The dispatcher's
  existing `inFlightOwners` machinery advances the channel through the same
  `[initial]` → `[engaged]` → `[initial]` lifecycle that drag uses. Build
  entries with `buildToolOffhandBindings(specs)`.

Built-in tools wire these via `BUILTIN_SELECT_KEYS` and
`BUILTIN_OFFHAND_ACTIONS` maps in `src/tools/useKeybindings.ts`. The
`ToolKeybinding` field on `ToolDef` is reserved for tools whose activation
key is set by the host caller (Lasso, Eyedropper); the same `useKeybindings`
effect picks up those configurable keybindings and appends entries to the
consolidated `tool.activate` action's bindings dynamically.

Inspector surfaces (the ToolPalette's shortcut chips, the HotkeyTrigger
detail view) read from the action registry — there is no per-tool
keybinding field driving them. The `keyHeld` gesture has a first-class
descriptor in the route grammar (alongside `keyDown` / `keyUp`), so route
strings like `[*:initial] keyHeld(Space)` parse, format, and render in
the inspector exactly like other gestures.

A known carryover: the document-level `keydown` listener in
`src/tools/useKeybindings.ts` still serves as the authoritative tap-switch
path for the bundled `SceneCanvas` mount topology, while the action
registry path is exercised by tests and other consumers. Unifying these
paths is a follow-up; the action registry path is now the canonical
source of truth for what shortcuts exist (the inspector reads from it).

## Selection mode

`<Canvas selectionMode="single" | "multi" | "none">` is a single switch for
click/drag/resize semantics:

- `single` (default): click replaces the selection with one id. Drag moves
  the clicked object. Corner handles resize it.
- `multi`: shift/meta/ctrl-click toggles. With multiple ids selected the
  overlay draws one union AABB, clicks inside drag the whole set, and
  corner handles resize the union (each member scaled via
  `geometry.remapBounds`).
- `none`: canvas interactions never mutate selection. `onBodyHit` /
  `onTapEmpty` still fire so consumers can do their own picking.

Override per-prop (`selection`, `pickEvery`, `boundsOf`, `resizeTarget`,
`onBodyHit`, `onTapEmpty`, `selectionOptions.mode`) when the mode-derived
default isn't enough.

## Tool

`<Canvas tool="select" | "insert">` flips what an empty-space drag does:

- `select` (default) routes to area-select (marquee).
- `insert` routes to the insert gesture (drag a rectangle, adapter mints a
  new object via `commitInsert(bounds)`).

Both are no-ops when the relevant controller isn't wired.

## Putting it together

```tsx
const selection = useSelection({ mode: 'multi' });
const adapter = {
  ...arrayAdapter<Rect, Pose>({ ref: rectsRef, setItems: setRects, toPose }),
  ...selection.adapterMethods,
};

useDuplicate<Pose>(adapter);              // Cmd+D
useDelete(adapter, { bindKeyboard: true }); // Backspace/Delete

return (
  <Canvas<Rect, Pose>
    width={W} height={H}
    adapter={adapter}
    selection={selection}
    selectionMode="multi"
    layers={{
      scene: { drawOne: (cx, r, p) => { cx.fillStyle = r.color; cx.fillRect(p.x, p.y, p.width, p.height); } },
      grid: { spacing: 20, bounds: () => ({ x: 0, y: 0, width: W, height: H }) },
      selectionOverlay: { handles: true },
    }}
  />
);
```

## System registries

The kit maintains several **registry** data structures — keyed lookups that map string identifiers to kit-managed objects like fonts, tools, ops, and shader programs. Each registry has a distinct scope, lifecycle, and mutability story; they are catalogued here so the pattern is visible to contributors extending the kit.

| Registry | Keyed by | Scope | Mutability | Where it lives | Reflection? | Used by |
|---|---|---|---|---|---|---|
| **Fonts** | `family` → `weight\|style` | App (module) lifetime | Runtime-mutable; entries are idempotent | Module-global `Map` in `registerFont.ts` | No | `WeaselRenderer`, text layout |
| **Tools** | Tool id string | Component lifetime, pinned at `useTools` call | Constructor-fixed (registry reference is live, but entries are set at hook call) | Hook return (`ToolsApi.registry`) | Yes — `registry` field is enumerable | `<Canvas>` dispatcher, tool palette UI |
| **Ops** | Op kind string (`kit:*` reserved) | Scene lifetime | Constructor-fixed via `ops` option; runtime additions via `scene.registerOp()` | Internal `Map` inside `createScene` closure | No | `Scene.undo()`, `Scene.redo()`, `scene.recordOp()` |
| **Scene function fields** | Registry key string | Scene lifetime | Constructor-fixed | `SceneRegistry` option on `createScene` / `sceneFromJSON` | No | `scene.toJSON()`, `sceneFromJSON()` serialization round-trip |
| **Actions** | Action id string | Provider lifetime | Runtime-mutable; entries register/unregister per component | React context (`ActionsContext`) inside `ActionsProvider` | Yes — `registry.list()` | Command palette, keybinding dispatch |
| **Easings** | Easing name string | Module lifetime | Frozen (compile-time constant) | Named export `EASINGS` in `easings.ts` | Yes — plain object, enumerable by key | `useAnimator`, animation hooks |
| **Shader programs (source)** | Program id string | Module lifetime | Runtime-mutable; dev-mode allows replacement, prod throws on duplicate | Module-global `Map` in `registerProgram.ts` | No (no public list API) | `WeaselRenderer.registerProgram()` |
| **Shader programs (compiled)** | Program id string | Renderer lifetime | Runtime-mutable; rebuilt on GL context restore | `Map` on each `WeaselRenderer` instance | No | `draw.ts` dispatch, `kind: 'shader'` draw commands |
| **Textures** | Auto-assigned `tex_N` id | App (module) lifetime | Runtime-mutable; append-only, no unregister in v1 | Module-global `Map` in `registerTexture.ts` | No | `GLTextureCache`, `kind: 'shader'` uniform binding |
| **Canvas layers** | Slot name string | Component lifetime, fixed at render | Constructor-fixed (prop value at render time) | `LayersMap` prop on `<Canvas>` / `<SceneCanvas>` | Implicitly — `Object.entries` over the prop | `<Canvas>` layer compositor |
| **Object-kind classifier** | Target kind string | — | — | — | — | Status: **in design** — see `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`; ships an adapter `kindOf?` hook as a temporary contract |

**Fonts** (`src/features/text/atlas/registerFont.ts`) use a two-level Map — outer key is the font family, inner key is `weight|style` — so `resolveFontVariant` can walk the fallback chain within a family without scanning everything. Idempotent: re-registering an existing variant is a no-op.

**Tools** (`src/tools/useTools.ts`) — the `registry` prop passed to `useTools` is held in a ref so new object references re-read cleanly each render without rebuilding the dispatcher. Tools not in `registry` can still appear in the `ambient` array (always-on tools); `ToolsApi.has(id)` checks both.

**Ops** (`src/core/scene/scene.ts`) — the internal `registered` Map is seeded with the kit's own `kit:*` ops at construction time, then consumer ops from `UseSceneOptions.ops`, then any later `scene.registerOp()` calls. `kit:*` kind strings are reserved; consumer ops that try to use the prefix throw at registration time.

**Scene function fields** (`SceneRegistry` in `src/core/scene/types.ts`) — a separate registry from ops. Its sole purpose is serialization: `clipFromPose` is a function and can't travel through JSON, so `scene.toJSON()` replaces it with a string key and `sceneFromJSON()` restores the function from the registry. Reserved for future non-serializable node fields.

**Actions** (`src/interactions/actions/registry.tsx`) — the only registry backed by React context. Entries are owned by components (registered in `useEffect`, cleaned up on unmount). `register()` returns its own cleanup function and implements last-writer-wins semantics so hot-module replacement doesn't orphan stale entries.

**Easings** (`src/animation/easings.ts`) — not a registry in the dynamic sense; `EASINGS` is a frozen `as const` object. It appears here because it fits the "keyed lookup" pattern and is consumed the same way by animation pickers and demos. `SPRING_PRESETS` follows the same shape for the four named spring curves.

**Shader programs** split across two levels. The module-level source registry (`registerProgram.ts`) is GL-context-agnostic and shared across all renderers. Each `WeaselRenderer` instance maintains its own compiled-program registry (`programRegistry`), rebuilt from source on GL context restore. This mirrors the font registry pattern: fonts store `ImageBitmap` at module scope; each renderer's `GLTextureCache` handles the per-context upload.

**Textures** (`src/renderer/textures/registerTexture.ts`) — entries are keyed by auto-assigned opaque ids (`tex_N`), not caller-chosen names, so collision is impossible. The `TextureHandle` returned by `registerTexture()` is what callers pass as a `ShaderUniform` value. No unregister in v1; texture lifetime is the app lifetime.

**Canvas layers** — the `LayersMap` prop is not a traditional registry but fits the pattern: it maps string slot names to layer configs, the compositor enumerates them at render time, and custom entries declare ordering via `before?` / `after?` anchors. Scope is per-`<Canvas>` instance; the map is treated as immutable for a given render pass.

The kit deliberately does not try to unify these into one shape. The lifecycles differ enough — module-global vs. scene-scoped vs. React-context vs. component-prop — that a single registry abstraction would either over-constrain the complex cases (fonts' two-level variant fallback, ops' `kit:*` reservation) or bloat the simple ones (easings, spring presets). The Tier 3 TODO (`docs/TODO.md`, "Document & lightly unify the system-registries pattern") documents this stance and identifies the lower-risk next step: a small `createReflectable<T>()` primitive that registries opt into for debug-overlay enumeration, rather than a structural unification.
