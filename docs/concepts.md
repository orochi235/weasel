# Concepts

The mental model behind `@weasel-js/core`. Read this before writing code.

## `<Canvas>`

> `<Canvas>` is `@internal` and no longer exported from the public barrel.
> Consumers use `<SceneCanvas>`, which mounts it. It's described here because
> the two split responsibilities and the seam is worth understanding.

A single `<canvas>` element wired up: it owns DPR setup, layer composition,
and the pointer-event router. Drop in an adapter and a `layers` map and you
get scene rendering plus the chrome slots; selection, picking, the kind
registry and the scene-aware overlays live in `<SceneCanvas>`.

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

Behavior isn't configured through controller-override props — there are none.
Move, resize, rotate, insert and area-select are actions in the Actions
Registry; you change what they do by binding different gestures to them, by
passing behaviors through a binding's `opts`, or by registering your own
descriptor under the same id. See [hooks.md](./hooks.md),
[extending.md](./extending.md), and `packages/core/src/canvas/Canvas.tsx`.

### Paint and render are separate

The canvas paints from its own animation frame, not from a React render.
`requestRedraw()` marks it dirty and the next frame paints, so many redraws in
one tick cost one paint. A view written through `setView()` on the
`<SceneCanvas>` ref costs no React render at all — `getView()` reads it back
mid-frame, `subscribeView()` reports changes. A canvas holding a `view` prop is
controlled instead: `setView()` refuses the local write, warns once, and
forwards the value to `onViewChange`, so the owner's render is still paid.

Pixels and DOM can therefore be a frame apart. Which one leads depends on what
moved:

- **A view change leads with pixels.** `setView()` writes a ref and paints on
  the frame without rendering at all, so DOM built from the view stays stale
  until something else re-renders it. Position DOM pinned to world coordinates
  from `subscribeView`, and it moves on the frame the pixels move.
- **A scene change leads with DOM.** `<SceneCanvas>` subscribes to the scene, so
  a `scene.batch` commits immediately while the pixels land on the next frame.
  Chrome that must be in lockstep compares `getPaintedVersion()` — the content
  version the pixels were painted from — against the version it is about to
  render, and defers a frame when they differ. It reads `0` until the first
  paint lands, which is not a version any scene has; treat it as "nothing
  painted yet" rather than comparing it.

For readouts and panels either skew is invisible. Reading the drawing buffer
back outside a paint can likewise see the previous frame; `subscribeFrame()`
runs on the frame that painted. `syncPaint` restores painting at commit time.

Nothing paints while `document.hidden` is true, `syncPaint` included — a
background tab still commits React updates, and a sync paint is the one path
the browser's own frame throttling does not stop. A buffer read back from a
hidden tab therefore returns the frame from before the tab was hidden. The
dirty flag holds until `visibilitychange` brings the surface back.

**Do not render scene-derived DOM inside `startTransition`.** React defers a
transition deliberately and nothing forces it to catch up, so that DOM can
diverge from the canvas without bound, and nothing warns — React exposes no way
to ask whether the current render is a transition. Render that DOM outside the
transition, gated on `getPaintedVersion()` when it must be in lockstep, or set
`syncPaint` for the old whole-cloth guarantee.

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
  // Named apart from the ref's `setView()`: a `view` prop makes both canvases
  // controlled, so every camera move here is a React render.
  const [view, setMainView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <>
      <SceneCanvas
        width={600} height={400}
        scene={scene} selection={selection}
        view={view} onViewChange={setMainView}
        layers={{ scene: { drawOne: (n, p) => [/* … */] } }}
      />
      <MinimapCanvas
        scene={scene}
        mainView={view}
        mainViewDims={{ width: 600, height: 400 }}
        onMainViewChange={setMainView}
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

## Pose override

A node's **pose** is document state: undoable, serialized, the answer to "where
is this". A pose **override** is the same value for one frame — `scene.overrides`
holds a per-node `{ pose?, alpha? }` that the render and hit-test paths read
through, and that history and `toJSON()` never see. A 60 Hz camera, a drag
preview, a physics settle and an animation tween all want this: motion that is
not an edit.

```ts
const entry = { pose: { x: 0, y: 0, width: 16, height: 16 } };
scene.overrides.set(id, entry);   // once

// per frame
entry.pose.x = simulation.x;      // mutate in place — no allocation
scene.overrides.commit();         // publish
```

`commit()` is not bookkeeping. The painter memo keys on pose *reference*, so an
in-place mutation without a commit paints the previous frame and reports no
error. `commit()` drops the pose-keyed memo slots of every overridden node.

To promote a frame to document state — dropping a drag, baking a settle — write
it once through `setPose` and `clearAll()`. That is the one step that belongs in
the undo stack.

## Descriptor

`PoseDescriptor<TPose>` projects an arbitrary `TPose` onto the kit's
rect-driven machinery:

- `getBounds(pose) → { x, y, width, height }` — AABB.
- `remapBounds(pose, src, dst) → pose` — affine remap on resize.
- `translate(pose, dx, dy)` — optional, used by move and snap.
- `intersectsRect(pose, rect)` — optional, tight test for area-select.

`RECT_POSE_DESCRIPTOR` is the identity for rect poses; `pathPoseDescriptor`
is the implementation for `Path`. `<SceneCanvas geometry={{ pickEvery,
boundsOf }}>` overrides hit-testing and bounds; `UseResizeOptions.geometry`
carries the descriptor itself. See [extending.md](./extending.md).

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

Constructors live under `packages/core/src/core/ops/`: `createTransformOp`,
`createInsertOp`, `createDeleteOp`, `createSetSelectionOp`,
`createBringForwardOp`, etc. Every gesture and action hook produces ops on
commit; `dispatchApplyBatch(adapter, ops, label)` calls
`adapter.applyBatch?.(ops, label)` if available, otherwise applies each op
directly against the adapter.

**Transient** ops apply via `adapter.applyOps(ops)` — no history entry.
Selection-only changes (e.g. marquee result) are transient by default.

## Ongoing handle

An action with `invoker.timing: 'ongoing'` opens a gesture: `start(ctx)`
returns an **`OngoingHandle`** that the dispatcher pumps with `onMove` and
closes exactly once via `onEnd(ctx, 'commit' | 'cancel')`. The handle is
stateful but pure — it doesn't touch the DOM. It exposes its in-flight visuals
through optional methods the canvas reads each frame:

```ts
interface OngoingHandle {
  kind?: string;                      // 'move' | 'marquee' | 'lasso' | … for chrome rules
  onMove?(ctx): void;
  onEnd?(ctx, reason: 'commit' | 'cancel'): void;
  previewIds?(): Iterable<string> | null;   // displaced nodes → preview-ghost layer
  previewPose?(id): unknown | null;
  previewData?(id): unknown | null;         // for data-space edits (anchor drag)
  previewHidesSource?: boolean;             // false for clone: original stays put
  overlay?(): OngoingOverlay | null;        // non-ghost chrome (marquee rect, lasso polyline)
}
```

`previewIds` / `previewPose` / `previewData` feed `usePreviewGhostLayer`, which
assembles a synthetic node per id and draws it through the scene slot.
`overlay()` feeds `useDispatcherOverlayLayer` for gestures that displace
nothing but still need feedback. Sources compose first-non-null per axis.
`getActiveAction().kind` is how chrome-visibility rules ask what's in flight.

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

**Hit-test channel.** Layers may declare an optional `hitTest(worldX, worldY, data, view, dims): AffordanceBinding | null`, consulted on pointerdown. Registered layers are walked top-down (last-registered first) by `CanvasExtensionApi.hitTestExtras`; `<SceneCanvas>` folds that walk — plus its own selection chrome — into the `affordanceAt` thunk it hands the gesture dispatcher. A hit reaches actions as an `AffordanceHit` (kind `layer:<id>` for a registered layer, carrying whatever the layer resolved as its `payload`), and the layer's owner claims the gesture with a binding whose `target` predicate matches that kind. This is how chrome stays hittable regardless of which tool is active — see `@weasel-js/hud` for the worked example.

**Command caching.** A layer may declare `deps?: (data, view, dims) => readonly unknown[]`. When a `LayerCommandCache` is supplied to `drawLayers` (Canvas owns one), a layer whose deps come back `Object.is`-equal to the previous call reuses its previous `DrawCommand[]` instead of calling `draw` again. A layer without `deps` rebuilds every frame — the existing behavior. This skips rebuilding the command tree, not GPU dispatch — every layer is still submitted to the renderer each frame regardless of caching.

Returned command trees must be treated as immutable: a cached tree is handed to the renderer again on later frames, so mutating one you previously returned corrupts the cache silently rather than erroring. World-space layers are protected against a stale `view` — `drawLayers` computes the `viewToMat3(view)` group wrap fresh outside the cache — but screen-space (`space: 'screen'`) layers are not; if `draw` reads `view` or `dims`, include them in `deps`. And an `id` must name the same logical layer across frames, since the cache is keyed on it.

## Affordance

A reusable factory primitive that produces a `{ render, hitTest? }` triple. Tools that own chrome (selection handles, rotation handle, anchor dots) compose affordances rather than reimplementing the render + hit-test logic inline. The kit ships `createCornerResizeAffordance` and `createRotationAffordance`; both read state from a kit-built `ChromeState` object so the affordance code stays pure (no React, no scene access).

The point of the abstraction: **visible chrome is hittable independent of the active tool.** Without affordances, each tool's overlay rendered handles but each tool had to hit-test those handles itself. With affordances, the hit-test walk runs once per pointerdown and the result rides the gesture as `InvocationCtx.drag.affordance`; a corner-handle drag fires the resize action even when a non-select tool is active. A hit is a claim, and a claim of `strength: 'exclusive'` bars every binding whose target doesn't consult the affordance — so chrome is never mistaken for a body pick and the gesture reaches whatever owns it, without each tool having to decline chrome by hand.

## Interaction

Everything the user does to the scene is an **interaction**. The kit splits
interactions into two kinds:

- **Gestures** — pointer-driven, with a start/move/end lifecycle. They live
  under `packages/core/src/interactions/gestures/`. Each one returns a controller with a
  live `overlay` so the in-flight state can render between frames.
- **Actions** — discrete, one-shot mutations that don't have a drag phase.
  They live under `packages/core/src/interactions/actions/`. Most are keybinding-driven
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
`cloneByAltDrag()` for clone. Marquee area-select is unconditional — it is
`areaSelectAction`'s built-in behavior, not an opt-in one.

## Action

An **action** is a unit of user intent — delete, move, undo, align — declared
as a static descriptor and registered into the Actions Registry. Actions are
not hooks. A descriptor says what it does (`invoker.run`), what state it needs
(`requires`, resolved from the dep registry at dispatch time), when it's
allowed (`eligible` / `enabled`), and how it's reached by default
(`defaultBinding`):

```ts
export const deleteAction: Action & { requires: string[] } = {
  id: 'delete',
  label: 'Delete',
  defaultBinding: {
    kind: 'key',
    key: ['Delete', 'Backspace'],
    phase: [{ channel: '*', phase: 'initial' }],
  },
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps'],
  invoker: { timing: 'immediate', run: (deps) => { /* … */ } },
};
```

`useStandardActions` registers the kit-standard set into the surrounding
`<ActionsProvider>`; `<SceneCanvas>` calls it for you. Actions reached by a
pointer gesture (`move`, `resize`, `insert`, …) are the same kind of object —
an `invoker` with `start` / `move` / `end` rather than a one-shot `run`. A
tool is just an array of `{ spec, actionId }` bindings pointing at them.

Imperative callers — a toolbar button, a command palette — use
`registry.trigger(id, params)`, which resolves deps exactly as a gesture
would, so there is one commit path and undo/coalescing behave identically. See
[hooks.md](./hooks.md) for the full action table and default keybindings.

### Keyboard activations are actions

Tool-switch shortcuts (`V` → Select) and held-key activations (Space → Hand)
are registered as actions in the actions registry, not as fields on
`ToolDef`. The factories in `packages/core/src/interactions/actions/defaults/` produce
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
  `defaultBinding` is a `BoundGesture[]` of `key-held` specs, each carrying
  `opts.params.toolId`. On `start` the invoker pushes the tool id onto the
  active-tool context's hotkey stack; `onEnd` pops it. The dispatcher's
  existing `inFlightOwners` machinery advances the channel through the same
  `[initial]` → `[engaged]` → `[initial]` lifecycle that drag uses. Build
  entries with `buildToolOffhandBindings(specs)`.

Built-in activation keys come from `BUILTIN_SELECT_KEYS` in
`packages/core/src/tools/useKeybindings.ts`. Held-key engagement is not wired
there: a tool declares `hotkey` on its `ToolDef`, that becomes
`eligibility.offhand`, and assembly registers the consolidated `tool.offhand`
action from the declaration. The `ToolKeybinding` field on `ToolDef` is reserved
for tools whose activation key is set by the host caller (Lasso, Eyedropper);
the `useKeybindings` effect picks those up and appends entries to the
consolidated `tool.activate` action's bindings dynamically.

### Hover cursors predict the drag route

While no gesture is in flight, the dispatcher's hover-cursor pump (in
`useGestureDispatcher`) resolves what the pointer is over on every
pointermove and writes a cursor override to the canvas. Precedence:

1. **Affordance hits** — `buildAffordanceAt` stamps `AffordanceHit.cursor`
   on its hits (resize corners → `nwse/nesw-resize`, rotate ring → `grab`);
   a declared cursor wins outright.
2. **Predicted action** — otherwise the pump asks
   `Dispatcher.resolveOnly(...)` which action a drag starting here would
   route to (the same specificity-sorted, `enabled()`-gated walk a real
   pointerdown takes) and applies that action's optional `Action.cursor`.
   E.g. `viewport.dragPan` declares `cursor: 'grab'`, so empty canvas shows
   the open hand whenever pan would actually win the drag — including when
   a higher-specificity marquee binding falls through because its deps
   aren't wired.
3. **Tool base** — no override; the active tool's `Tool.cursor` (React-
   managed on the canvas host) shows through.

Give a consumer action a hover hint by declaring `cursor` on its
descriptor — no pump wiring needed. Because prediction runs `enabled()`
but cannot run the invoker, keep `enabled` truthful for actions that
declare a cursor: an action that matches but bails inside `start()` (the
empty-handle pattern) will still show its cursor.

Modifier and hotkey changes (e.g. holding Space to engage the hand tool)
re-run the prediction at the last hover position, so the cursor re-routes
without pointer movement.

Inspector surfaces (the ToolPalette's shortcut chips, the HotkeyTrigger
detail view) read from the action registry — there is no per-tool
keybinding field driving them. The `keyHeld` gesture has a first-class
descriptor in the route grammar (alongside `keyDown` / `keyUp`), so route
strings like `[*:initial] keyHeld(Space)` parse, format, and render in
the inspector exactly like other gestures.

A known carryover: the document-level `keydown` listener in
`packages/core/src/tools/useKeybindings.ts` still serves as the authoritative tap-switch
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

## Picking

A click resolves against a node's **inked region**, not its pose box —
`<SceneCanvas geometry={{ picking: 'shape' }}>` is the default, and `'pose'`
is the opt-out. `shapeCoversPoint` (`canvas/NodeShape.ts`) takes a pose-rect
hit and refines it with the painter's `findShapeSilhouette` +
`pathContainsPoint`, so the counter of a donut, the gap between the arms of a
compound path, and the empty middle of a U all fall through to whatever is
behind them. A painter with no silhouette keeps the AABB answer, so the
refinement can only ever tighten a pick.

Whether the fill counts at all comes from `NodeShapeEntry.ink(node, pose)`,
which returns `{ filled, outset, inset }` off cheap node fields — deliberately
*not* read back off `paint`, which may lay out glyphs on every pointer move.
`outset` and `inset` are how far the ink reaches either side of the outline,
which is per-side because a stroke's `align` decides which side it lands on.
The fill test only runs when the painter fills; either way `shapeCoversPoint`
ORs in `strokeHitTest` at that side's reach plus `tolerance`, so an outlined
rect is grabbable by its outline and a bare line — zero area, unpickable by
any fill test — is grabbable along its length. `tolerance` is
`geometry.pickTolerancePx` (screen px, default 4, converted against the live
view), because a hairline is a sub-world-unit target no pointing device can
hit; the pose-rect pre-filter grows by the same amount or it would reject
outline hits before the refinement ran.

Off the `SceneCanvas` path, `useSelectTool({ leafPicking, pickTolerance })`
is the same behavior with a world-unit tolerance. Both scene pick paths agree.

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

// No per-action wiring: `duplicate` (Cmd+D) and `delete` (Backspace/Delete)
// are kit-standard descriptors, registered by the canvas.

return (
  <SceneCanvas<Rect, Pose>
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
| **Fonts** | `family` → `weight\|style` | App (module) lifetime | Runtime-mutable; entries are idempotent | Module-global `Map` in `registerFont.ts` | Yes — `listFonts()` | `WeaselRenderer`, text layout |
| **Font outlines** | `family\|weight\|style` | App (module) lifetime | Runtime-mutable; register / unregister | Module-global `Map` in `outline/outlineRegistry.ts` | Yes — `listFontOutlines()` | `layoutRuns` (above the size threshold) |
| **Tools** | Tool id string | Component lifetime, pinned at `useTools` call | Constructor-fixed (registry reference is live, but entries are set at hook call) | Hook return (`ToolsApi.registry`) | Yes — `registry` field is enumerable | Gesture dispatcher, tool palette UI |
| **Ops** | Op kind string (`kit:*` reserved) | Scene lifetime | Constructor-fixed via `ops` option; runtime additions via `scene.registerOp()` | Internal `Map` inside `createScene` closure | No | `Scene.undo()`, `Scene.redo()`, `scene.recordOp()` |
| **Scene function fields** | Registry key string | Scene lifetime | Constructor-fixed | `SceneRegistry` option on `createScene` / `sceneFromJSON` | No | `scene.toJSON()`, `sceneFromJSON()` serialization round-trip |
| **Actions** | Action id string | Provider lifetime | Runtime-mutable; entries register/unregister per component | React context (`ActionsContext`) inside `ActionsProvider` | Yes — `registry.list()` | Command palette, keybinding dispatch |
| **Easings** | Easing name string | Module lifetime | Frozen (compile-time constant) | Named export `EASINGS` in `easings.ts` | Yes — plain object, enumerable by key | `useAnimator`, animation hooks |
| **Shader programs (source)** | Program id string | Module lifetime | Runtime-mutable; dev-mode allows replacement, prod throws on duplicate | Module-global `Map` in `registerProgram.ts` | No (no public list API) | `WeaselRenderer.registerProgram()` |
| **Shader programs (compiled)** | Program id string | Renderer lifetime | Runtime-mutable; rebuilt on GL context restore | `Map` on each `WeaselRenderer` instance | No | `draw.ts` dispatch, `kind: 'shader'` draw commands |
| **Paint kinds** | `FillStyle` discriminant | App (module) lifetime | Runtime-mutable; `registerPaintKind` returns a disposer | Module-global `Map` in `core/paintKinds.ts` | Yes — `listPaintKinds()` | `draw.ts` fill dispatch, `fillInPoseFrame`, `<defs>` emit, the paint editor's kind bar |
| **Textures** | Auto-assigned `tex_N` id | App (module) lifetime | Runtime-mutable; append-only, no unregister in v1 | Module-global `Map` in `registerTexture.ts` | No | `GLTextureCache`, `kind: 'shader'` uniform binding |
| **Canvas layers** | Slot name string | Component lifetime, fixed at render | Constructor-fixed (prop value at render time) | `LayersMap` prop on `<Canvas>` / `<SceneCanvas>` | Implicitly — `Object.entries` over the prop | `<Canvas>` layer compositor |
| **Object-kind classifier** | Target kind string | — | — | — | — | Status: **in design** — see `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`; ships an adapter `kindOf?` hook as a temporary contract |

**Fonts** (`packages/font/src/registerFont.ts`) use a two-level Map — outer key is the font family, inner key is `weight|style` — so `resolveFontVariant` can walk the fallback chain within a family without scanning everything. Idempotent: re-registering an existing variant is a no-op.

**Font outlines** (`packages/font/src/outline/outlineRegistry.ts`) are a *third glyph tier*, not a fourth font registry: they never resolve a family on their own, they only replace how an already-resolved glyph is painted. Above `OUTLINE_MIN_SCREEN_PX` on-screen pixels, a face with registered outlines renders as tessellated geometry — exact at any zoom, and an ordinary path, so it takes gradient and pattern fills. Deliberately a flat `family|weight|style` map with **no** fallback chain: substituting a nearby variant would paint the wrong weight at the right advances, which looks worse than the distance field it replaced, so a miss declines and falls back down the tier ladder (outlines → canvas SDF → baked atlas) instead.

The ladder's ordering rule is worth stating once: **each tier answers only "can I paint this glyph, right now?"** Loading is asynchronous everywhere (`fetch` for a URL, `queryLocalFonts` behind a permission for machine faces), so a tier that cannot answer yet answers `null` and the next one draws. `subscribeGlyphReady` (`packages/font/src/glyphReady.ts`) is the shared signal that a later frame can do better — both the deferred SDF bakes and the outline loads fire it, and `<SceneCanvas>` subscribes once.

**Tools** (`packages/core/src/tools/useTools.ts`) — the `registry` prop passed to `useTools` is held in a ref so new object references re-read cleanly each render. Tools not in `registry` can still appear in the `ambient` array (always-on tools); `ToolsApi.has(id)` checks both.

**Ops** (`packages/core/src/core/scene/scene.ts`) — the internal `registered` Map is seeded with the kit's own `kit:*` ops at construction time, then consumer ops from `UseSceneOptions.ops`, then any later `scene.registerOp()` calls. `kit:*` kind strings are reserved; consumer ops that try to use the prefix throw at registration time.

**Scene function fields** (`SceneRegistry` in `packages/core/src/core/scene/types.ts`) — a separate registry from ops. Its sole purpose is serialization: `clipFromPose` is a function and can't travel through JSON, so `scene.toJSON()` replaces it with a string key and `sceneFromJSON()` restores the function from the registry. Reserved for future non-serializable node fields.

**Actions** (`packages/core/src/interactions/actions/registry.tsx`) — the only registry backed by React context. Entries are owned by components (registered in `useEffect`, cleaned up on unmount). `register()` returns its own cleanup function and implements last-writer-wins semantics so hot-module replacement doesn't orphan stale entries.

**Easings** (`packages/core/src/animation/easings.ts`) — not a registry in the dynamic sense; `EASINGS` is a frozen `as const` object. It appears here because it fits the "keyed lookup" pattern and is consumed the same way by animation pickers and demos. `SPRING_PRESETS` follows the same shape for the four named spring curves.

**Shader programs** split across two levels. The module-level source registry (`registerProgram.ts`) is GL-context-agnostic and shared across all renderers. Each `WeaselRenderer` instance maintains its own compiled-program registry (`programRegistry`), rebuilt from source on GL context restore. This mirrors the font registry pattern: fonts store `ImageBitmap` at module scope; each renderer's `GLTextureCache` handles the per-context upload.

**Paint kinds** (`packages/core/src/core/paintKinds.ts`) are what make `FillStyle` open: a registered kind draws, converts between the bounds and pose frames, and serializes with no kit edits. The entry is one object, but its slots are consumed in three packages, so each layer consults the registry for a kind it does not recognize and otherwise runs its own branch — a built-in kind's render slot lives in the GL renderer and its serialize slot in `@weasel-js/svg`, neither importable from core without inverting a package dependency.

`FillStyle` itself stays a closed union — opening its discriminant would widen every built-in member and break the narrowing the kit's own branches depend on — so a registered kind declares its own interface and passes it through `asPaint`. The render slot is `bind` rather than `draw` because a caller owning its own stencil state (an inner/outer-aligned stroke, an even-odd fill) has to issue its own draw call. A kind's shader goes through the ordinary `registerProgram` source registry and compiles into each renderer on first use, so a kind registered after a renderer exists still paints.

**Textures** (`packages/core/src/renderer/textures/registerTexture.ts`) — entries are keyed by auto-assigned opaque ids (`tex_N`), not caller-chosen names, so collision is impossible. The `TextureHandle` returned by `registerTexture()` is what callers pass as a `ShaderUniform` value. No unregister in v1; texture lifetime is the app lifetime.

**Canvas layers** — the `LayersMap` prop is not a traditional registry but fits the pattern: it maps string slot names to layer configs, the compositor enumerates them at render time, and custom entries declare ordering via `before?` / `after?` anchors. Scope is per-`<Canvas>` instance; the map is treated as immutable for a given render pass.

The kit deliberately does not try to unify these into one shape. The lifecycles differ enough — module-global vs. scene-scoped vs. React-context vs. component-prop — that a single registry abstraction would either over-constrain the complex cases (fonts' two-level variant fallback, ops' `kit:*` reservation) or bloat the simple ones (easings, spring presets). The Tier 3 TODO (`docs/TODO.md`, "Document & lightly unify the system-registries pattern") documents this stance and identifies the lower-risk next step: a small `createReflectable<T>()` primitive that registries opt into for debug-overlay enumeration, rather than a structural unification.
