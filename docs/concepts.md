# Concepts

The mental model behind `@orochi235/weasel`. Read this before writing code.

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

## Adapter

Weasel never reads or writes your scene state directly. Every gesture takes
an **adapter** — a small object the consumer implements that exposes the
scene to the kit (`getObjects`, `getPose`, `setPose`, …) and accepts ops
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
interface GestureBehavior<TPose, TProposed, TMoveResult> {
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
useNestedGroup(adapter); useNestedUngroup(adapter);
useUndoRedo({ history });
useClipboard(adapter);
```

Each hook accepts a `bindKeyboard: false` opt to skip its default shortcut
so you can drive it from your own UI. Every action commits via the same
`dispatchApplyBatch(adapter, ops, label)` pipeline as gestures, so undo,
coalescing, and `applyBatch` overrides all work uniformly. See
[hooks.md](./hooks.md) for the full table and default keybindings.

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
