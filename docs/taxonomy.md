# Weasel Taxonomy

A single source of truth for the kit's terminology, organized by concept-family.
Covers consumer-side abstractions, dev-side abstractions, domain types, the gesture
model, and concepts deferred or not yet in the kit.

This doc is **meta-structure**: what the abstractions *are* and how they relate.
Per-symbol details (function signatures, options, examples) live in JSDoc and the
API reference.

## Conceptual map

Each box is a *domain* — a subsystem with its own vocabulary. Each entry is a
concept in that domain. Arrows show cross-domain relationships.

```mermaid
flowchart TB
  subgraph IN["Input"]
    direction TB
    G["Gesture<br/><i>form of user input</i>"]
    IX["Interaction<br/><i>gesture composed with action</i>"]
  end

  subgraph SC["State change"]
    direction TB
    A["Action<br/><i>user-intent operation</i>"]
    O["Op<br/><i>invertible mutation</i>"]
    B["Behavior<br/><i>per-frame plug-in</i>"]
  end

  subgraph SN["Scene"]
    direction TB
    Scn["Scene"]
    Nd["Node"]
    Ad["Adapter"]
    Po["Pose"]
    PD["PoseDescriptor"]
    Pa["Path"]
    Bd["Bounds"]
  end

  subgraph RD["Rendering"]
    direction TB
    L["Layer"]
    Sl["Slot"]
    CS["Chrome state"]
    V["View / ViewTransform"]
  end

  subgraph SL["Selection"]
    direction TB
    Se["Selection"]
    Sx["SelectionContext"]
  end

  subgraph TL["Tools"]
    direction TB
    To["Tool"]
    Tr["Tool registry"]
    Af["Affordance"]
  end

  subgraph ST["Strategies"]
    direction TB
    Sn["Snap strategy"]
    La["Layout strategy"]
  end

  subgraph DV["Dev organization"]
    direction TB
    Ft["Feature"]
    Pr["Primitive"]
    Hk["Hook"]
    Rt["Role taxonomy"]
  end

  G -. composes .-> IX
  A -. composes .-> IX
  A -. produces .-> O
  B -. plugs into .-> A
  O -. writes through .-> Ad
  To -. invokes .-> A
  To -. defines .-> Af
  L -. fills .-> Sl
  A -. consults .-> Se
  Sn -. refines pose via .-> B
  La -. arranges children in .-> Ad
  V -. projects coords for .-> L
  CS -. derived from .-> Se
  Pa -. lives on .-> Po
  Po -. attached to .-> Nd
  Nd -. lives in .-> Scn
  Ad -. abstracts .-> Scn
```

The diagram is the at-a-glance answer to "where does X live?" Detailed prose
follows below in the per-concept sections.

---

## 1. Consumer-side abstractions

The vocabulary an app developer uses to wire up the kit.

### Contribution

A registry entry: what it contributes, and when it is eligible. Every role is
optional and independent — `bindings` (its entire input surface), `actions`,
an `overlay` layer, `presentation` for a palette. An entry that only routes
input declares only the first two. See
`packages/core/src/contributions/types.ts`.

**Eligibility** is a *set* of conditions, not one value, because one entry holds
several at once — the hand tool is palette-selectable and space-held:

- `focus` — selectable as the focused entry; exclusive, one at a time.
- `offhand: HotkeyTrigger` — also live while that key is held.
- `always` — live regardless of what is focused.
- `claimed` — live only for input this entry's own affordances produced.
- `capabilities` — modality filter, applied wherever it would otherwise be live.

The scope tier a binding matches at is *derived* from whichever condition is
live (`liveScope`), ordered to match the dispatcher's own hotkey > active >
ambient walk. So an entry lands in a tier because of what it declares about
itself, not because of which argument a consumer passed it in.

### Tool

A `Tool<TScratch>` is the **focus-declaring case** of a Contribution: it adds
the fields that only mean something for a mode the user switches into —
`initScratch`, `onActivate`/`onDeactivate`, the preview hooks, a `cursor`
closing over its own scratch. Distinct from [Gesture hooks](#gesture) in that a
Tool is a stateful mode while a gesture hook is a direct binding to a pointer
interaction. See `packages/core/src/tools/types.ts`.

Not every entry is a Tool. `@weasel-js/hud` contributes bindings and actions and
declares `claimed`; it has no scratch, no palette icon, and nothing to preview.

### Affordance

A reusable factory primitive that produces a `{ id, render, hitTest? }` triple consumed by tools. Lives in `packages/core/src/affordances/`. Tools compose multiple affordances into a single overlay layer via `composeAffordanceLayer`. The dispatcher consults each composite layer's `hitTest` on pointerdown (top-down z-order) before falling through to the active-tool slot walk — so visible chrome is hittable regardless of which tool is currently active.

Examples: `createCornerResizeAffordance`, `createRotationAffordance`. See `packages/core/src/affordances/types.ts`.

The factory pattern: each affordance instance is bound to one tool/context at runtime (it closes over that tool's controllers via the wrapper drag channel), but the factory function is reusable across tools.

An affordance **hit** is a claim: `{ kind, owner, strength, cursor?, payload? }`.
`owner` names what produced it — a kit affordance's `id`, or a registered
layer's id. `strength: 'exclusive'` bars every binding whose `target` doesn't
consult the affordance (a `kindOf` predicate, or the `affordance:<kind>` string
form), which is how chrome floating over the scene stays reachable no matter
which tool is active; `'shared'` is the default and competes on scope and
specificity as bindings always have. A registered layer declares both by
returning a `LayerHit` from its `hitTest`.

Exclusivity is a hard filter, not a preference: if nothing eligible remains, the
press does nothing. A dev-only warning names the owner when that happens.

### Contribution registry

`useContributions({ entries, focused })` — the assembly point. It holds the
entries and the focused id, and returns `scopedBindings()` (every live binding
paired with the tier its declaration resolves to) plus `overlays()`. The
dispatcher matches against that, so one place decides eligibility. It is also
where route-conflict reporting sees both entry bindings and action
`defaultBinding`s, which is what lets a collision between them be reported at
all. See `packages/core/src/contributions/useContributions.ts`.

`useTools({ active, registry, ambient })` remains as a shim over it, unchanged
in shape: `registry` entries get `focus`, `ambient` entries get `always`, a
`hotkey` declaration becomes `offhand`. Note it returns shallow copies for those
last two categories, since it adds the declaration. See
`packages/core/src/tools/useTools.ts`.

### Layer

A `RenderLayer<TData>` is a named draw function: `{ id, label, draw(data, view, dims) }`.
Layers are the kit's composable rendering primitive. Each frame the canvas reduces
the active layer stack into a flat `DrawCommand[]` tree and hands it to the
WebGL renderer. Layers declare whether they operate in world space (default) or
screen space. Layers may declare an optional `hitTest(worldX, worldY, data, view, dims)` that the dispatcher consults on pointerdown before the slot walk; first non-null result wins. See `packages/core/src/core/layers/render.ts`.

### Slot

A named position in the `LayersMap` passed to `<Canvas>`. Standard slots render in
canonical z-order: `grid`, `cellHighlight`, `scene`, `selectionOverlay`. Custom
slots declare an `after` or `before` anchor relative to a standard slot; unanchored
custom slots land at the top of the stack. Slot configs are distinct from raw
`RenderLayer` values — the canvas constructs a `RenderLayer` from each slot config
internally. See `packages/core/src/canvas/Canvas.tsx:70`.

### Adapter

A consumer-implemented object that bridges the kit to the app's scene state. The
kit never reads or writes scene state directly; it asks the adapter for poses, hit
results, and writes mutations back through `Op` application. Adapter interfaces are
narrow and structural: `MoveAdapter`, `ResizeAdapter`, `RotateAdapter`,
`AreaSelectAdapter`, `InsertAdapter`, `OrderedAdapter`. A single struct satisfying
all of them at once is the common pattern. The opaque `adapter: unknown` on
[`ToolCtx`](#toolctx-gesturecontext) is the same concept but intentionally
untyped at the tool layer; tools cast it when they need a specific facet. See
`packages/core/src/core/adapters/types.ts` and `docs/adapters.md`.

### Op

An invertible, adapter-agnostic mutation: `{ apply(adapter), invert(): Op, label?, coalesceKey? }`.
Op constructors live in `packages/core/src/core/ops/`: `createTransformOp`, `createInsertOp`,
`createDeleteOp`, `createSetSelectionOp`, `createSetTextOp`, `createReorderOp`,
`createSetPathOp`, etc. `dispatchApplyBatch(adapter, ops, label)` applies them in
order (or hands them to `adapter.applyBatch` for history integration).

Ops are the *infrastructure layer* of state mutation — atoms of history-bearing
change. [Actions](#action) at the application layer produce op batches to express
user-intent operations; the action↔op mapping is many-to-many:

- **1 action → 1 op**: `delete` → `createDeleteOp`.
- **1 action → N ops**: `align left` → N `createTransformOp`s (one per selected item).
- **0 ops for an action**: `zoom in`, `escape`, `toggle grid` — non-undoable state
  changes bypass the op pipeline.
- **Ops without an action**: a gesture commit can emit ops directly (e.g. a drag
  resize) without dispatching through the action registry. (The longer-term shape
  routes all drag-based mutation through actions; this is acknowledged drift.)

The `coalesceKey` field lets `createHistory({ coalesceWindowMs })` merge consecutive
entries within a window when their op multiset (keyed by `coalesceKey`) matches —
so scrubs of a property slider land as one undo step. See `packages/core/src/core/ops/types.ts`.

### Gesture

The *form* of user input. A primitive that consumes pointer / keyboard events and
emits world-space data. Examples: `dragRect` (rectangular drag → bounds),
`dragRadial` (radial drag → center + radius), `lasso` (free-form polygon).
Normalization of raw DOM events into the kit's `InputEvent` union is
`useGestureDispatcher`'s job. Plain clicks and keystrokes are gestures too, just
trivial ones.

OS file drop and clipboard paste are gestures as well (`DropSpec` / `PasteSpec`,
filtered by a MIME-glob `types` field) — external content *arriving* is a form of
input like any other. Their default routing targets the ambient `ingest` action,
which fans out to the content-handler registry. See
`docs/superpowers/specs/2026-07-03-content-ingestion-design.md`.

Gestures are orthogonal to [Actions](#action) in this taxonomy. A gesture is *how*
input arrives; an action is *what to do* with it. The same gesture (a rectangular
drag) can power different actions (insert a rect, marquee-select, area-erase); the
same action (`delete`) can be invoked by different gestures (a keystroke, a button
click, a swipe). See [Interaction](#interaction) for the composition.

Source layout: `packages/core/src/interactions/gestures/` holds the input primitives — per-primitive
subdirectories `dragGesture/`, `dragRect/`, `dragRadial/`, plus the shared `shared/`
snap helpers and `types.ts` carrying the cross-system base types (`ModifierState`,
`GestureContext`, `ActionBehavior`, etc.). Drag-based actions (`move/`, `resize/`,
`rotate/`, `clone/`, `lasso-select/`, `insert/`) live alongside the one-shot actions
under `packages/core/src/interactions/actions/`.

### Action

A user-intent operation that modifies app state. Identified by `{ id, label,
defaultBinding?, requires?, invoker?, enabled?() }`. Discoverable via the Actions Registry +
command palette; bindable to a key, mouse gesture, button click, or any other
[Gesture](#gesture). Actions with a `defaultBinding` are routed through the gesture
dispatcher; one without a binding still registers, and is reached by
`ActionsRegistry.trigger` — from the command palette, a toolbar button, or app code.

Actions are the *application layer* of state change — the verbs the user can
invoke. Each one either produces an [Op](#op) batch (for undoable mutations like
`delete`, `align`, `move`) or emits no ops (for transient/UI state like
`zoom in`, `escape`, `toggle grid`).

Source layout reflects this: both one-shot actions (`delete`, `align`, `escape`, …)
and drag-based actions (`move`, `resize`, `rotate`, `insert`, `area-select`, …) live
under `packages/core/src/interactions/actions/`. All default actions are registered as descriptors
with `defaultBinding` and dispatched through the action registry, and the drag-based
descriptors (`resize`, `rotate`, `areaSelect`, `insert`, `clone`, `editAnchors`) now
carry real invokers — the `useResize` / `useRotate` / `useMove` / `useAreaSelect` /
`useInsert` / `useClone` / `useEditAnchors` gesture hooks they used to delegate to
have been deleted. The split is closed: the phase-table route grammar and the
second dispatcher that read it are gone, so a tool's entire input surface is
`Tool.bindings` and every gesture resolves through one engine.

Examples: `selectAll`, `escape`, `duplicate`, `nudge`, `reorder`, `delete`,
`align.{left,...}`, `distribute.{horizontal,vertical}`, `flip.{x,y}`. Kit defaults
register automatically via `<SceneCanvas>`; consumer-level actions register
explicitly. See `packages/core/src/interactions/actions/registry.tsx`.

An action may declare an optional `cursor` — the hover hint shown while the
pointer rests where a drag would route to that action. The hover-cursor pump
predicts the route via `Dispatcher.resolveOnly` (the same match walk a real
pointerdown takes), so hint and behavior can't drift. See "Hover cursors
predict the drag route" in `docs/concepts.md`.

### Interaction

A [Gesture](#gesture) composed with an [Action](#action). The composition is the
unit at the seam between input and effect: "drag-rect gesture + insert action"
makes a rectangle; "click gesture + delete action" deletes an object; "keystroke
gesture + toggle-grid action" hides the grid.

Interactions don't have their own type or runtime today — they emerge from the
gesture system invoking actions. The term is most useful for *describing* what a
feature does (e.g. "alt-click invokes the eyedropper action") and for keeping the
gesture and action sides of a feature factored separately when designing.

### Behavior

A pluggable extension to a drag-based [Action](#action)'s per-frame proposed-pose
shaping and commit logic. Implements `ActionBehavior<TPose, TProposed, TMoveResult>`
with optional `onStart`, `onMove`, and `onEnd` hooks. Behaviors run in array order;
each `onMove` may refine the proposed pose; the first `onEnd` returning a
non-`undefined` value wins (ops to commit, or `null` to abort). Type aliases pin
the shapes per action: `MoveBehavior`, `ResizeBehavior`, `RotateBehavior`,
`InsertBehavior`, `AreaSelectBehavior`, `CloneBehavior`.

Distinct from [component-level behaviors](#mixin--lifecycle-behavior-deferred)
which do not exist yet. See `packages/core/src/interactions/gestures/types.ts` for the
`ActionBehavior` interface (renamed from `GestureBehavior` in 2026-05).

### Snap strategy

`SnapStrategy<TPose>` — a pluggable point-snap policy with one method:
`snap(pose, ctx): TPose | null`. Returns the snapped pose or `null` to skip.
Passed through the action layer (e.g. the `resizePolicy` dep's `pointSnap`) or
via the `ToolCtx` snap field to tools. World-space point snapping for insertion
is the `snap` dep — see `SnapDep` in `interactions/actions/depSchema.ts`. Built-in: `gridSnapStrategy(spacing)`
snaps the pose origin to the nearest grid multiple; `OriginProjection` adapts
non-rect poses (e.g. `Path`) so `gridSnapStrategy` can read and write the
correct origin. See `packages/core/src/interactions/gestures/shared/strategies/grid.ts`.

### Layout strategy

`LayoutStrategy<TPose>` — a pluggable container-layout policy. Implements
`getChildPositions`, `getDropTargets`, `reflowFor`, `commitDrop`, `snap`, and
an optional `contains` predicate. When a container in the scene exposes a layout
strategy via the `layout` dep, `moveAction` runs a layout pass on
drag: reflows siblings live and calls `commitDrop` on release. Built-in strategies:
`freeform` (absolute positioning), `tileGrid` (row/column grid), `snapPoint`
(named anchor positions). See `packages/core/src/layout/types.ts` and `packages/core/src/layout/strategies/`.

### Selection

`SelectionApi` — the kit's owned selection state, produced by `useSelection`.
Exposes `current: string[]`, `get()`, `set()`, `add()`, `remove()`, `toggle()`,
`clear()`, `contains()`, and `applyClick()`. `applyClick` applies the configured
click policy (`'single'` replaces; `'multi'` toggles with extend key). The
`adapterMethods` sub-object (`{ getSelection, setSelection }`) is designed to be
spread directly into adapters.

Where the ids live is a separate question from this API. `useSelection({ scene })`
keeps them on the scene (`scene.getSelection()` / `setSelection()`), which is what
`<SceneCanvas>` does: one selection shared by every view over that scene, recorded
on each history entry so undo and redo restore it. Without a `scene` the hook owns
the ids itself and nothing else sees them — what a `<CanvasView>` opts into via its
`selection` / `selectionOptions` props. Either way the selection is not document
content: it is not a node, and `scene.toJSON()` does not carry it.

Selection participates in the `@experimental`
[`SelectionContext`](#selectioncontext) for non-canvas UI. See
`packages/core/src/core/selection/useSelection.ts`. The kit-level `ChromeState` (the
affordance-facing read-only view) is built from the `SelectionApi` via
`buildChromeState`; lives in `packages/core/src/core/selection/chromeState.ts`.

### SelectionContext

`@experimental`. An ambient React context populated by `<SceneCanvas>` (via
`usePublishSelection`) that non-canvas UI (palette, status bar) can read without
prop-drilling. Provides the current selection ids and optional per-id `kinds`
labels. The `kinds` parallel array is a temporary half-step toward typed scene
references (see `docs/TODO.md` Tier 1.5). See
`packages/core/src/features/selection/SelectionContext.tsx`.

---

## 2. Dev-side abstractions

The vocabulary kit authors use when extending or organizing the kit.

### Feature

A directory under `packages/core/src/features/<name>/` that bundles related primitives sharing a
domain. Examples: `focus`, `selection`, `grid`, `groups`, `text`, `paths`,
`viewport`, `drag`, `patterns`. Not a runtime concept — an organizing principle
for the repo. The mental model (from `docs/TODO.md`): the fix for "the kit is
turning into a katamari." Distinct from a [Plugin](#plugin-deferred) (which bundles
parts with consumer-facing composition rules) in that features are internal to the
kit.

**Bundle-shaped vs protocol-shaped features.** Features fall on a spectrum:

- **Bundle-shaped** features are self-contained. Their primitives compose locally;
  the rest of the kit doesn't need to know they exist. Focus, grid, patterns, text
  are mostly bundle-shaped — if you don't import them, nothing breaks; if you do,
  you wire them at one or two call sites.

- **Protocol-shaped** features introduce a *concept* that other code must honor.
  Selection is the canonical case: "current selection" is read by overlay layers,
  written by gestures, threaded through [Adapter](#adapter) contracts (e.g.
  `AreaSelectAdapter.setSelection`, `getSelection` on Move/Resize/Rotate adapters),
  and conditioned on by [Actions](#action). The selection feature doesn't just
  contribute (api/attrs/layers); it *imposes* — anything that interacts with the
  scene has to understand what selection is and behave accordingly.

The [Role taxonomy](#role-taxonomy) captures contributions *out* of a feature; it
doesn't (yet) capture the protocol surface a protocol-shaped feature *requires* of
other code. In practice the protocol surface is expressed as TypeScript
interfaces (`SelectionApi`, `AreaSelectAdapter`, etc.) — the type system is the
protocol contract, validated at compile time. See
[Feature dependency layers](#feature-dependency-layers) for how this affects the
kit's internal partial order.

**Feature-authoring guide.** When adding or restructuring a feature:

1. **Each feature is a directory under `packages/core/src/features/<name>/`.** The directory bundles related primitives that share a domain.

2. **Each feature has an `index.ts` barrel.** The barrel re-exports the feature's public primitives — every hook, layer factory, exported type, or helper a consumer or another feature might import. Internal helpers stay un-exported (or are exported only through deeper paths if needed for internal cross-feature wiring).

3. **The kit's main barrel (`packages/core/src/index.ts`) imports from feature barrels, not from feature-internal paths.** This is the load-bearing discipline — once enforced, internal restructures (renaming a file, splitting a primitive into two) don't ripple through the main barrel.

4. **The [Role taxonomy](#role-taxonomy) is a thinking tool, not a code shape.** When authoring a feature's primitives, sort them mentally: which are state surfaces (api), which contribute DOM attrs (attrs), which contribute render layers (layers). The categorization helps decide what belongs in the barrel and what stays internal. It does NOT manifest as TypeScript types or runtime structures — there's no `Api<S>` alias, no `<SceneCanvas features={[…]}>` prop, no `useFooFeature()` convenience hook by convention.

5. **Protocol-shaped features document their protocol surface explicitly.** Selection's `SelectionApi`, `AreaSelectAdapter`, and the `getSelection`/`setSelection` methods threaded into Move/Resize/Rotate adapters are the model. When a feature introduces a cross-cutting concept other code must honor, name the contracts in TypeScript interfaces and reference them in the feature's docs.

### Primitive

An exported building block from a feature — a hook, layer factory, type, helper,
or utility function. The unit of public consumption. Per-feature primitives compose
into the consumer-side abstractions. Examples: `useCanvasFocus`, `gateLayer`,
`createGridLayer`, `useGridCellHover`, `gridSnapStrategy`. Primitives are exported
directly; features are directories.

### Role taxonomy

A thinking tool for shaping a feature's primitives into a consistent bundle shape.
Three roles a feature's parts fall into (from `docs/TODO.md` "Feature-roles taxonomy"
and `docs/superpowers/specs/2026-05-09-feature-roles-focus-grid-design.md` §A):

- **`api`** — typed surface for cross-feature consumption: live state, refs,
  getters/setters. Cross-feature deps are typed function arguments
  (`useBlurOnEscape(focus.api)`), not a runtime registry.
- **`attrs`** — native DOM attributes and handlers to spread onto the canvas
  host element: `tabIndex`, `onFocus`, `onPointerMove`, `aria-*`. Distinct from
  React props the `<SceneCanvas>` component itself defines.
- **`layers`** — slot-keyed render-layer contributions. Each entry is a
  `<T>(current: RenderLayer<T>) => RenderLayer<T>` function. Provider and wrapper
  roles are deliberately collapsed: a "provider" returns a fresh layer ignoring
  `current`; a "wrapper" composes on top of it. `<SceneCanvas>` seeds each slot
  with `EMPTY_LAYER` and reduces contributions in registration order.

A `useFooFeature()` hook returns any subset of `{ api?, attrs?, layers? }`. The
taxonomy is `@experimental` — promoted to stable once ≥3 features have shipped in
this shape.

### Chrome state

The `ChromeState` object built once per Canvas render and passed to every affordance's `render` and `hitTest` call. Source of truth for selection ids, derived bounds (overlay-aware), multi-union AABB (lazy), and modifier flags. Read-only; affordances dispatch gestures via their drag channel's `ToolCtx`, not through `ChromeState`. See `packages/core/src/core/selection/chromeState.ts`.

### Hook

A React hook (`use*`) is the kit's primary primitive shape. Hooks encapsulate
stateful logic (gesture phase machines, selection state, history, animation) in a
React-idiomatic way. The kit's architecture choice: no classes, no event emitters,
no singleton stores — hooks compose. Nearly every consumer-side abstraction is
accessed through a hook.

### Feature dependency layers

The kit's features form an implicit partial order based on what they import and
what protocols they consume. Documented here so authors of new features know where
they fit.

- **Foundation** (nothing kit-internal depends on these): `viewport`, `scene`,
  `selection`. Of these, `viewport` is core infrastructure (lives under `packages/core/src/core/`
  — every canvas needs a `View`, so it's not optional in any meaningful sense);
  `scene` is also core; `selection` is a protocol-shaped feature (lives under
  `packages/core/src/features/`) that most editor-style apps will pull in.
- **Mid-layer** (depend on foundation): `groups` (scene + selection), `grid`
  (viewport), `focus` (nothing internal), `paths`, `patterns`, `text`.
- **Gestures** (depend on foundation + adapter contracts): `useDragRect`,
  `useDragRadial`, `useDragGesture` — the spatial input primitives. The
  per-action gesture hooks (`useMove`, `useResize`, `useRotate`, `useAreaSelect`,
  `useInsert`, `useClone`, `useEditAnchors`) are gone; their behavior lives in
  the action descriptors under `interactions/actions/`.
- **Actions** (depend on selection + scene): the
  [Actions Registry](#action) and its descriptors — `duplicate`, `delete`,
  `nudge.*`, `reorder.*`, `selectAll`, `escape`, and the rest. The per-action
  hooks that used to wrap these (`useDuplicate`, `useDelete`, …) are gone;
  `useStandardActions` registers the descriptors instead.
- **Tools** (depend on gestures + actions): `useSelectTool`, `useRectTool` and
  the other shape tools, `useHandTool`, `usePenTool`, the viewport tools.
- **Top-level** (depends on most things): `<Canvas>`, `<SceneCanvas>`.

This order is not enforced at runtime; TypeScript module imports are the actual
dependency graph. The layering above is descriptive of what existing imports
already look like — useful for placement when adding a new feature, not a thing
the build validates.

**Cycle-breaking conventions.** Some features have bidirectional needs. Selection
↔ scene is the canonical case:

- Selection needs to react to scene mutations (e.g., remove a deleted node's id
  from the selection set).
- Scene's overlay layers need to react to selection changes (e.g., redraw outlines
  when the selection changes).

The kit avoids module-level cycles by making one side **subscribe** instead of
**import**. Selection subscribes to scene's `onChange` callbacks; scene exposes
events but does not import selection. The runtime relationship is bidirectional,
but compile-time imports stay acyclic.

**Convention:** when two features have bidirectional needs, one side owns state
and exposes a `subscribe` (or callback) API; the other side subscribes. The
"subscribed to" side stays oblivious of the subscriber. The static import graph
remains a DAG.

---

## 3. Domain types

Vocabulary for the geometry and scene model.

### Pose

The snapshot of a scene object's geometry that the kit reads and writes.
Shape is generic (`TPose`). Common shapes: rect (`{x, y, width, height}`),
`RotatedPose` (rect + `rotation: number` in radians, pivot at AABB center),
`Path` (polygon/bezier command stream), `TextPose`. Poses are **local-coordinate**
— relative to the object's direct parent (world-frame for root objects). The
kit composes world poses via `composeWorldPose` for rendering and hit-testing.
See `packages/core/src/interactions/gestures/types.ts:108` (`ResizePose`, `RotatedPose`) and
`packages/core/src/features/paths/types.ts` (`Path`).

### PoseDescriptor

`PoseDescriptor<TPose>` — a small projection that bridges an arbitrary `TPose` into
the kit's rect-driven machinery. Required methods: `getBounds(pose) → ResizePose`
(AABB), `remapBounds(pose, src, dst) → TPose` (affine remap on resize or group
scale). Optional: `translate`, `intersectsRect`, `lerp`, `getRotation`. Used by
`resizeAction`, area-select, snap, and animation helpers. Built-ins:
`RECT_POSE_DESCRIPTOR` (identity for `ResizePose`), `ROTATED_POSE_DESCRIPTOR`,
`pathPoseDescriptor`. Distinct from [OriginProjection](#snap-strategy) which handles
snap-point extraction for non-rect poses. See `packages/core/src/interactions/actions/resize/geometry.ts:15`.

### Scene

`Scene<TData, TLayer, TPose>` — the kit-owned tree of scene nodes with built-in
undo/redo. Created by `useScene`; passed to `<SceneCanvas>`. Exposes `add`,
`remove`, `update`, `setPose`, `move`, `reorder`, `batch`, `undo`, `redo`, and a
`subscribe` seam for React integration. Mutations are auto-undoable; the
`recordOp` seam extends the history with consumer-defined ops. Distinct from a
flat-array adapter wired through `useArrayAdapter` — the Scene is the higher-level
path with first-class containers and layers built in. See `packages/core/src/core/scene/types.ts:83`.

### Node

`Node<TData, TLayer, TPose>` — a single entry in the scene tree. Either a `LeafNode`
(`kind: 'leaf'`) or a `ContainerNode` (`kind: 'container'`, with `children: NodeId[]`).
Every node carries `id`, `layer`, `pose`, `data`, and `parent`. The opaque `data`
field holds the consumer's domain payload; the kit never inspects it. See
`packages/core/src/core/scene/types.ts:17`.

### Group vs Selection — not the same axis

These are distinct concepts that the word "group" historically conflated; keep
them separate.

- **Group** = a structural `ContainerNode` (`kind: 'container'`, `children`). The
  real "group" (Cmd+G): the `group`/`ungroup` actions create/dissolve a container
  and reparent the selection under it. Persistent, id-bearing, selectable as a
  unit, and the native round-trip for SVG `<g>`. Dragging a container moves its
  descendants (the move action cascades `childrenOf`).
- **Selection** = the transient, immutable set of currently-active ids (the
  [`SelectionApi`](#selection): `get()` / `set()`). "Operate on these N as a unit"
  with no persistence and no id — it is *not* a scene entity. The scene holds the
  current one so undo can restore it, but it is never part of the document.

There is no persistent membership-list concept. A consumer that wants named,
saved selections holds its own `Record<string, string[]>` and calls
`selection.set(ids)`. (The former `Group`/`GroupAdapter`/`expandToLeaves`
membership apparatus was removed in 2026-06 — it was a saved-selection wearing
the name "group.")

### View / ViewTransform

`View` — the viewport's camera state: `{ x, y, scale }` where `x/y` is the world
point rendered at the canvas top-left and `scale` is pixels per world unit. The
canonical pan+zoom representation used throughout the kit. `ViewTransform` is a
legacy shape (`{ panX, panY, zoom }`) with the opposite sign convention for
translation; `viewToTransform(view)` bridges between them. See
`packages/core/src/core/viewport/view.ts`.

### Bounds / ResizeAnchor

`ResizePose` (also called "bounds" in hit-test and overlay contexts) is
`{ x, y, width, height }` — the minimum rect shape the resize machinery requires.
`ResizeAnchor` describes which corner/edge stays fixed during a resize:
`{ x: 'min' | 'max' | 'free', y: 'min' | 'max' | 'free' }`. The pair is the
spatial vocabulary of resize math. See `packages/core/src/interactions/gestures/types.ts:102`.

### Path

`Path = PolygonPath | RectPath` — the kit's vector-graphics pose type. `PolygonPath`
is an SVG-style command stream (`commands: Uint8Array`, `coords: Float32Array`);
`RectPath` is an axis-aligned-rectangle fast path. Multi-contour shapes use
multiple `M`/`Z` pairs. The `kind` discriminant lets the polygon kernels
short-circuit on `'rect'` without the full path kernel. See
`packages/core/src/features/paths/types.ts`.

---

## 4. Gesture model

Vocabulary for pointer-driven interactions.

### Gesture (spatial input primitives)

A pointer-driven interaction with a `start` / `move` / `end` / `cancel` lifecycle.
The surviving primitives are `useDragRect` (drag → bounds), `useDragRadial`
(drag → center + radius), and `useDragGesture`. They are *input* primitives: a
tool decides what to do with the geometry they emit.

The per-action gesture hooks that used to live here (`useMove`, `useResize`,
`useRotate`, `useInsert`, `useAreaSelect`, `useClone`, `useEditAnchors`) and
their controller objects are **deleted**. Ongoing behavior is now an
[Action](#action) descriptor with an `ongoing` invoker returning an
`OngoingHandle`.

### Gesture overlay

The live state an in-flight ongoing action exposes. Consumed by overlay layers
to render in-flight chrome. Two distinct surfaces, deliberately separate:

- `OngoingHandle.overlay()` → dispatcher-authored chrome (marquee, lasso
  polyline, insert preview), painted by `useDispatcherOverlayLayer`.
- `OngoingHandle.previewIds` / `previewPose` / `previewData` → displaced
  scene-node silhouettes, painted by `usePreviewGhostLayer` through the scene
  slot's own `drawOne`.

### ToolCtx / GestureContext

Two distinct context shapes that appear at different layers:

- **`ToolCtx<TScratch>`** — the per-event context injected into every tool channel
  handler by `<Canvas>`. Carries `worldX/Y`, `modifiers`, `selection`, an opaque
  `adapter`, `applyBatch`, `view`, `setView`, `canvasRect`, and `scratch` (the
  tool's per-gesture mutable store). See `packages/core/src/tools/types.ts:28`.

- **`GestureContext<TPose>`** — the per-frame context passed to
  [Behavior](#behavior) methods. Carries `draggedIds`, `origin`, `current` (live
  pose map), `snap`, `modifiers`, `pointer`, `adapter` (typed as `MoveAdapter`),
  and `scratch` (per-gesture key/value store). More gesture-specific than
  `ToolCtx`. See `packages/core/src/interactions/gestures/types.ts:26`.

- **`InvocationCtx`** — the per-invocation context the dispatcher hands to an
  Action invoker: `world`, `screen`, `modifiers`, `deps`, and gesture-kind
  fields (`drag`, `wheel`, `multiTouch`, `key`). This is the one new code sees.
  See `packages/core/src/interactions/actions/invoker.ts`.

---

## 5. Other recurring concepts

### Backend

The kit renders exclusively via **WebGL2** through `WeaselRenderer`
(`@weasel-js/gl` was a separate package until Step 10; its sources are now
folded into `packages/core/src/renderer/`). The 2D canvas codepath was deleted in Step 10
(2026-05-09). The `backend` prop existed temporarily during the soak period and is
gone. WebGPU is a future option tracked in `docs/TODO.md`.


### Op coalescing

`Op.coalesceKey` is declared on `transform` and `setText` ops (and `reparent`)
as a string key that could identify ops safe to merge with their predecessor in
the undo history. The field is **written** but `History.append` does not yet
coalesce — every drag step pushes a discrete entry. Implementation (time window?
consecutive same-key only?) is deferred as Tier 1.5 in `docs/TODO.md:199`.

### Selection overlay

The `selectionOverlay` slot renders the per-object selection chrome: outline rect,
corner resize handles, and (when `rotationHandle` is enabled) a rotation handle.
Built from `createSelectionOutlineLayer`, `createSelectionHandlesLayer`, or the
combined `createSelectionOverlayLayer`. The overlay reads overlay-aware pose
lookups (live gesture pose wins over committed adapter pose) so handles track
objects during a drag. The selection overlay is screen-space-constant for handle
sizes but world-space for object positions. See
`packages/core/src/features/selection/overlay.ts`. Phases of the chrome-affordances refactor
(spec: `docs/superpowers/specs/2026-05-10-chrome-affordances-design.md`) introduced
kit-level affordance factories (`createCornerResizeAffordance`,
`createRotationAffordance`) that render the same chrome via reusable primitives;
`createSelectionOverlayLayer` still exists as the legacy presentational helper.
The two coexist until the cleanup completes.

---

## 6. Concepts not in the kit (yet)

These have been discussed but are not shipped. Mentioned here so design
conversations don't re-litigate whether they exist.

### Plugin (deferred)

A convention for bundling a feature's parts (`tool`, `layers`, `behaviors`, …) so
a single `useFooPlugin()` call returns an object the consumer spreads into
`<Canvas>` / `useTools`, instead of wiring three or four separate exports per
feature. Deferred until ≥2 plugin-shaped features have shipped and the pattern is
clear. A lightweight `WeaselPlugin = { tool?, layers?, behaviors?, ... }` shape
plus `mergePluginConfig(...plugins)` is the v1 target. Tracked in
`docs/TODO.md:138`.

### Mixin / lifecycle behavior (deferred)

Component-level chain-of-responsibility hooks (`onPointerDown`, `pre-render`,
`post-render`) that would let features attach to the canvas lifecycle without
modifying `<SceneCanvas>` directly. Discussed but explicitly not in scope per the
feature-roles spec (`docs/superpowers/specs/2026-05-09-feature-roles-focus-grid-design.md` §Non-goals).
Distinct from gesture-level [Behaviors](#behavior) which already ship.

### Capability registry (deferred)

A runtime DAG for cross-feature dependency resolution — typed indirect references
between features (a "provides/requires" contract) rather than direct TypeScript
import arguments. Explicitly deferred: the in-tree dependency graph is TypeScript
imports; typed function arguments (`useBlurOnEscape(focus.api)`) carry cross-feature
deps for now. Tracked in the feature-roles spec.

### Behaviors at the component level (deferred)

The term "behavior" is used in two senses in the kit:
1. **Gesture-level** ([`ActionBehavior`](#behavior)) — ships and is stable.
2. **Component-level** — a hypothetical chain-of-responsibility mechanism that
   would let features intercept pointer events or render passes at the `<SceneCanvas>`
   boundary. This second sense does not exist yet and is explicitly out of scope
   of the current feature-roles work.
