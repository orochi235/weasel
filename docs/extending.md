# Extending weasel

How to add a feature to a weasel canvas: first the units a feature is made of
and how one installs, then the common extension points one at a time — custom
layers, affordances, gesture behaviors, non-rect poses, derived geometry,
actions — and mounting tools in a host of your own.

## Extension units

| Unit | What it is | How it installs |
|---|---|---|
| **Action** | An operation: `start`/`onMove`/`onEnd` for a gesture, or one `run` | Named by a binding, or registered as a contribution's `actions` |
| **Binding** | A gesture spec bound to an action id, optionally scoped to views (`opts.views`) | A contribution's `bindings`, or an action's `defaultBinding` |
| **Layer** | A `RenderLayer`: draw commands for one frame, told which view it is drawing for (`data.viewId`) | A contribution's `overlay`, or the `layers` prop |
| **Registered layer** | A layer that also hit-tests, painted above every view | `api.registerLayer`, usually from `attach` |
| **Dep** | A named live source actions read (`view`, `scene`, `rootView`, `pointer`, …) | A contribution's `deps`, or `useDepSource` |
| **View** | A second camera over a rect of the surface, with input routed to it | A contribution's `views`, the `views` prop, or `<CanvasView>` |
| **Tool** | A contribution the user switches into (`eligibility.focus`), with scratch and previews | `useTools` / the `tools` prop |
| **Contribution** | A whole feature: any of the roles above, plus `attach` | `<SceneCanvas ambient>` |

`SurfaceContribution` is the unit a feature ships as. Every role is optional,
installing the entry installs every role it declares, and removing the entry
removes them:

```ts
interface SurfaceContribution {
  id: string;
  eligibility: Eligibility;           // when its bindings are live
  bindings?: GestureBinding[];
  actions?: Action[];
  deps?: { [name]: () => value };     // live while the entry is installed
  overlay?: RenderLayer | RenderLayer[];
  views?: CanvasViewProps[];
  attach?: (api, deps) => () => void; // anything the roles cannot say
}
```

`mergeContributions(...bundles)` concatenates several features' entries and
throws on a duplicate entry id, dep name or view id.

### Eligibility

A tool is the entry that declares `eligibility.focus`. Plenty of things route
input without being one: chrome that owns its own presses, an always-on
viewport behavior, a feature that only ever reacts to its own affordances.
Those declare a different condition:

- `focus` — selectable as the focused entry, one at a time.
- `offhand` — also live while a key is held.
- `always` — live whatever is focused.
- `claimed` — live only for input this entry's own affordances produced.

The conditions are a set, not a choice: the hand tool is palette-selectable
*and* held-key engaged. A `claimed` entry must give its bindings a target that
consults the affordance (a `kindOf` predicate or `affordance:<kind>`), or its
own exclusive claim filters them out — a dev-only warning names it if that
happens.

### Worked example: the minimap

`createMinimapContribution` (`packages/core/src/features/minimap/`) uses every
role:

| Role | What it holds |
|---|---|
| `views` | The minimap: a view at `rect`, its camera a fit over the scene |
| `actions` | `minimap.center` and `minimap.pan`, which move the main camera |
| `bindings` | `pointerDown` → center and `drag` → pan, with `views: ['minimap']` |
| `overlay` | The visible-rect indicator, and a crosshair where the pointer is in the other view |
| `attach` | Subscribes to the pointer store and repaints while the crosshair shows |

```tsx
const minimap = useMemo(() => createMinimapContribution({ rect: { x: 8, y: 8, w: 160, h: 110 } }), []);
<SceneCanvas ambient={[minimap]} … />
```

Three rules it depends on, each general:

- **A binding scoped to a view outranks the rest there.** Inside the minimap
  the select tool's drag is live at the active tier, which outranks the
  minimap's always-on entry. A binding whose `views` names the view the input
  landed in wins over every binding that does not, whatever their tiers.
- **Inside a view, `view` is that view's camera.** That is what makes every
  other action work in a view. An action there that must move the main camera
  reads `rootView`.
- **A layer paints in every view unless it declines.** One layer array paints
  the surface and every view; a layer that belongs in one view checks
  `data.viewId`. Registered layers are the exception: they paint above every
  view and inside none, so chrome that has to appear inside a view is an
  `overlay`, never `attach` → `registerLayer`.

The HUD is the other example: `useHudContribution(hud)` is one entry carrying
its input routing and an `attach` that binds its registered layer.

## Custom layers

The `layers` prop on `<Canvas>` is a tagged-discriminated map. Standard
slot keys (`grid`, `scene`, `selectionOverlay`, …) take slot config;
**any other key** is treated as a custom layer if its value carries a
`.layer` field:

```ts
import type { CustomLayerEntry, RenderLayer } from '@weasel-js/core';

const hud: RenderLayer<unknown> = {
  id: 'hud',
  draw: (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, 8, 120, 24);
    ctx.fillStyle = 'white';
    ctx.fillText('HUD', 16, 24);
  },
};

<Canvas
  layers={{
    scene: { drawOne },
    selectionOverlay: { handles: true },
    hud: { layer: hud, after: 'selectionOverlay' } satisfies CustomLayerEntry,
  }}
/>
```

`after` and `before` reference a `StandardSlotName`. Omit both and the
layer goes after every standard slot (the top of the stack). Multiple
custom entries can share an anchor; insertion order within an anchor is
the iteration order of the `layers` map.

A `RenderLayer<TData>` is just `{ id, draw(ctx, data?, vis?), label?,
defaultVisible?, alwaysOn?, deps? }`. Build them with the helpers the kit
exports: `createGridLayer`, `createCellHighlightLayer`, `createTextLayer`,
`createPathLayer`, `createChildrenLayer`, `createSelectionOverlayLayer`,
`createTilePattern`. Or write your own — it's a function.

`deps` opts a layer into command caching — see [concepts.md](./concepts.md#layer).

## Custom affordances

Affordances are reusable chrome primitives. Each affordance is a small object: `{ id, render, hitTest? }`. Tools that want chrome (selection handles, anchor dots, snap-target highlights, etc.) compose affordances into their overlay rather than reimplementing the hit-test logic inline.

```ts
import {
  createCornerResizeAffordance,
  composeAffordanceLayer,
  defineTool,
} from '@weasel-js/core';

// 1. Build an affordance instance via a kit-shipped factory.
const corners = createCornerResizeAffordance({
  handleHitRadius: 8,    // world-px hit zone (divided by view.scale at runtime)
  handleSize: 8,         // screen-px visual size
});

// 2. Compose multiple affordances into a single overlay RenderLayer.
const overlay = composeAffordanceLayer(
  'my-tool-overlay',
  'My tool chrome',
  [corners /*, ...other affordances */],
);

// 3. Plug it into your tool's overlay field, and bind the gestures that
//    should reach your actions when a press lands on that chrome.
const myTool = defineTool({
  id: 'my-tool',
  overlay,
  actions: [myResizeAction],
  bindings: [
    { spec: { kind: 'drag', target: { kindOf: isMyHandle } }, actionId: 'my-tool.resize' },
  ],
});
```

Affordances read state from `ChromeState` — a kit-built read-only object that Canvas constructs each render. `ChromeState` exposes:

- `selection: readonly NodeId[]` — currently selected ids.
- `multiActive: boolean` — true when ≥2 ids are selected in multi-mode.
- `boundsOf(id): Bounds | null` — overlay-aware bounds (returns ghost bounds during a drag).
- `unionBounds: Bounds | null` — multi-union AABB when `multiActive`.
- `modifiers: ModifierState` — alt/shift/meta/ctrl at the time of the call.

Every layer's `hitTest` is consulted on pointerdown, and the result rides the gesture as `InvocationCtx.drag.affordance` — so an affordance hit fires the action bound to it even when a different tool is active. This is the principle: visible chrome is always hittable.

A layer that owns its chrome outright returns `strength: 'exclusive'` from its `hitTest`. That bars every binding whose `target` doesn't consult the affordance — a `kindOf` predicate or the `affordance:<kind>` form — so a tool needs no predicate of its own to keep its hands off; a bare `{ kind: 'drag' }` simply doesn't compete for a claimed press. The default, `'shared'`, competes on scope and specificity as bindings always have.

**A claim bars a whole gesture protocol, so bind every gesture in it.** `claimedKinds: ['pointer']` is one token covering `pointerDown`, `click` and `drag` — at the event level the first two are the same press told apart by stage. Claim it and bind only `drag`, and the pointerdown matches nothing that consults the affordance: the dispatcher drops the press, and the drag it would have grown into never happens. The kit says so — `exclusive claim by "<layer>" matched no binding` — and the chrome looks simply dead. Bind all three, even when two of them do nothing but absorb the press.

A tool can still decline hits explicitly (`target: { kindOf: (hit) => hit == null }` matches only presses that landed on the scene), but that is now for cases the claim doesn't cover, not the general defense against chrome.

### Naming a target

`spec.target` takes one of five forms. Reach for a predicate when you need
one; the string forms are shorter and rank higher in specificity, so a binding
that can say what it wants in a string should.

| Form | Matches | Rank |
| --- | --- | --- |
| `'empty'` | a press on open canvas | 1 |
| `'selected-body'` / `'unselected-body'` | a press on a node body, by selection state | 1 |
| `kind:<k>` | a press on a body whose **routing-trait kind** is `<k>` | 2 |
| `kind:<k>:selected` | the same, and that body is in the selection | 3 |
| `affordance:<k>` | a press on chrome whose hit `kind` is exactly `<k>` | 2 |
| `{ kindOf: (hit, bodyTarget) => boolean }` | anything you can decide in code | 1 |

`<k>` in the `kind:` forms is a name from the `routing` prop — the same
vocabulary that names `Hit.kind`, not a second one. Without `routing` the kit
infers `'text'` / `'path'` / `'image'` from the data shape; `routing={[]}`
opts out and makes every `kind:` target unmatchable.

Rank is the first element of the CSS-style specificity tuple: within one
scope, a higher-ranked target wins the gesture. Predicates rank 1 no matter
how narrow they are, because nothing can tell statically whether a `kindOf`
means "the rotate ring" or "anything at all".

`affordance:<k>` is an **exact** match including any parameter, so
`affordance:anchor:3` names one anchor and there is no `affordance:anchor`
that names them all — that one wants the `isAnchor` predicate.

## Custom gesture behaviors

A behavior plugs into an action's behavior chain — via `BindingOpts.behaviors`
on the binding that reaches it, or via the options `<SceneCanvas>` forwards
(`selectTool.move.behaviors`, `selectTool.snap`, …):

```ts
interface ActionBehavior<TPose, TProposed, TMoveResult> {
  defaultTransient?: boolean;
  onStart?(ctx: GestureContext<TPose>): void;
  onMove?(ctx: GestureContext<TPose>, proposed: TProposed): TMoveResult | void;
  onEnd?(ctx: GestureContext<TPose>): Op[] | null | void;
}
```

Each action pins the proposed/result shape; pick the matching alias
(`MoveBehavior<TPose>`, `ResizeBehavior<TPose>`, `InsertBehavior<TPose>`,
`AreaSelectBehavior`, `CloneBehavior`).

**Rules of thumb:**

- `onMove` returns a partial result (`{ pose: refined }` for move) to
  refine the proposed pose; `void` leaves it alone. Behaviors run in
  array order — later behaviors see your refinement.
- `onEnd` decides commit ops. First non-`undefined` return wins: `Op[]`
  commits, `null` aborts, `undefined` falls through to the next behavior
  or the action's default ops (move emits one `createTransformOp` per id).
- `ctx.scratch` is a per-gesture mutable map, wiped on every `start`.
  Namespace by behavior id to avoid collisions:
  `ctx.scratch['snapToContainer']`.
- `defaultTransient: true` flips the gesture to `applyOps` (no history
  entry) unless the consumer overrides `transient` explicitly.

**Reference behaviors in the source:**

- `packages/core/src/interactions/actions/move/behaviors/snapToGrid.ts` — pure pose refinement.
- `packages/core/src/interactions/actions/move/behaviors/snapToContainer.ts` — scratch state, dwell timer, custom `onEnd`.
- `packages/core/src/interactions/actions/resize/behaviors/clampMinSize.ts` — width/height clamp.
- `packages/core/src/interactions/actions/clone/behaviors/cloneByAltDrag.ts` — modifier activation + paste flow.

## Non-rect poses

Resize, area-select, snap-origin, and the selection overlay are all
rect-driven internally. To make them work for arbitrary `TPose` (path,
polygon, custom blob), supply a `PoseDescriptor<TPose>`:

```ts
export interface PoseDescriptor<TPose> {
  getBounds(pose: TPose): Bounds;
  remapBounds(pose: TPose, src: Bounds, dst: Bounds): TPose;
  fromBounds(bounds: Bounds, template: TPose): TPose;
  translate?(pose: TPose, dx: number, dy: number): TPose;
  intersectsRect?(pose: TPose, rect: Bounds): boolean;
  getRotation?(pose: TPose): number;
  withRotation?(pose: TPose, rotation: number): TPose;
}
```

`remapBounds` is one operation that subsumes both single-leaf resize ("set
my AABB to dst") and group resize ("scale me as a leaf inside parent's
src→dst rect") — they're the same affine map.

`fromBounds` builds a pose from a bare box, using `template` for whatever the
box does not carry. Group resize and the container union need it.

Pass the descriptor once, as `<SceneCanvas poseDescriptor={…}>`. It reaches
every built-in action, the selection chrome, picking and area select as the
`poseDescriptor` dep, and supplies the default `pickEvery`, `boundsOf`, the
selection-overlay bounds and the `resize` action's remap. The separate
`geometry={{ pickEvery, boundsOf }}` prop overrides those two directly.

The kit ships:

- `AUTO_POSE_DESCRIPTOR` — the default: rect poses and `Path` poses, chosen per
  call from the pose's shape.
- `RECT_POSE_DESCRIPTOR` — identity for `{x,y,width,height}`.
- `ROTATED_POSE_DESCRIPTOR` — rect poses carrying a `rotation`.
- `pathPoseDescriptor` — implementation for `Path`.

For grid snapping on a non-rect pose, also pass an `OriginProjection`:

```tsx
import { gridSnapStrategy, pathOriginProjection } from '@weasel-js/core';

<SceneCanvas
  selectTool={{ snap: gridSnapStrategy(20, { origin: pathOriginProjection }) }}
  …
/>;
```

`<SceneCanvas>` folds `selectTool.snap` into the `move` action's behavior
chain.

Move translates through the same descriptor. It reads the `poseDescriptor` dep
and applies `translate` when the descriptor defines one, otherwise an origin
shift derived from `remapBounds`.

For an end-to-end working demo, see `apps/site/demos/CompoundPathsDemo.tsx`.

## Derived geometry

A node's path can be computed from other nodes' poses instead of authored. An
edge drawn between two boxes is the motivating case: the edge is an ordinary
scene node — it selects, styles, clips, exports and undoes like any other — but
its path is never written, so dragging a box records a move of the box and
nothing else.

Declare the dependencies and the function that reads them:

```ts
import {
  createScene, linePath, strokeOf,
  type SceneNode, type Path, type RectPose,
} from '@weasel-js/core';

const connectCenters = (
  _node: SceneNode<unknown, string, RectPose>,
  [from, to]: readonly (RectPose | undefined)[],
): Path | null =>
  from && to
    ? linePath(
        { x: from.x + from.width / 2, y: from.y + from.height / 2 },
        { x: to.x + to.width / 2, y: to.y + to.height / 2 },
      )
    : null;

const scene = createScene<object, 'main', RectPose>({
  systemLayers: [{ id: 'main' }],
  registry: { derivePath: { 'app:connect': connectCenters } },
});

const box = (x: number, y: number) =>
  scene.add({ kind: 'leaf', layer: 'main', pose: { x, y, width: 40, height: 40 }, data: {} });
const a = box(0, 0);
const b = box(200, 90);

scene.add({
  kind: 'leaf',
  layer: 'main',
  pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { stroke: strokeOf('#1c1c1c', 2) },
  dependsOn: [a, b],
  derivePath: connectCenters,
});
```

The built-in `kit:derived` painter draws whatever `derivePath` returns, reading
`data.fill` and `data.stroke` the way `kit:path` does. The returned path is in
**world** coordinates, not the pose frame: the pose above is a zero-sized
placeholder, and all it still contributes is rotation. A bounds-relative fill
resolves against the derived path's own box.

`derivePath` receives each dependency in `dependsOn` order as
`{ node, pose }` — the node itself, and its **effective** pose: its ephemeral
override when it has one, else its own derived pose, else the pose the scene
stores, which is exactly what the render walks paint. The node comes along
because a connector legitimately reads more than a box: one that thickens with
its endpoint's weight, or routes only to nodes on a given layer, is answering
off `data` and `layer`, and the scene already invalidates on both. A dependency
the scene cannot resolve arrives as `undefined`; returning `null` means
"nothing to draw right now".

`node` arrives typed `SceneNode<unknown, string, TPose>`, so a `derivePath` that
reads `node.data` casts. Naming `TData` and `TLayer` there would put them in a
contravariant position and make `Scene` invariant in both.

**Serialization carries a registry key, never the function.** `SceneRegistry`
does for `derivePath` what it already does for `clipFromPose`: `toJSON` looks
the function up in `registry.derivePath` and writes `derivePathKey`, throwing if
it has no key, and `sceneFromJSON` resolves the key back — **throwing** on a key
the registry does not hold, so a document never loads half-derived. Replaying a
persisted *history* is the lenient path: `kit:add` warns and restores the node
without its `derivePath`, keeping `dependsOn`, so it paints its authored
appearance rather than vanishing.

**Invalidation is pushed by the scene and pulled by the path resolver.** A
pose override mutates its buffer in place rather than replacing the reference —
which is what a drag does — so no reference-keyed memo can observe an endpoint
moving. The scene keeps a reverse index and drops its dependents' pose-keyed
memo slots wherever a dependency's pose can change, transitively, including on
undo. On top of that, `resolveDerivedPath` re-resolves its dependencies on a
memo hit and compares their poses *by value* against the ones the cached path
was drawn from, so a dependency that moved with nothing pushed behind it — a
paint-time `toPose` of your own, say — still re-routes. That pull covers poses
only: a derivation reading a dependency's `data` or `layer` rides on the push.

`derivePose` has no such pull, so a pose derived from a pose is pushed
invalidation alone.

**Deleting a node deletes everything that derives from it**, transitively,
including those nodes' own subtrees, as one undo entry. A dependent is not a
descendant, so `scene.remove` can take nodes anywhere in the tree that the
caller never named — deleting a box takes its edges, and `removeLayer` reaches
nodes on other layers. `scene.removeMany(ids)` does the same for several roots
in one entry, absorbing ids that another root's cascade already covers, which
is what makes it safe to hand a whole selection.

`scene.removalClosure(ids)` answers what that would take, without taking it.
Ask it rather than rebuilding the walk from `dependsOn` and `children`: the
cascade relations live in the scene, and a caller with its own copy is a copy
that goes stale. The built-in Delete uses it twice — to drop selected ids an
earlier op already covers, and to snapshot the whole set so undo brings all of
it back.

`scene.setDependsOn(id, dependsOn)` retargets a node's dependencies as one
undoable step — dragging an existing edge's end onto a different node, or
switching a container between an id list and `'children'`. Order is significant
and declaring what a node already declares records nothing.

Reparenting a node out from under its dependents is legal and intended: the
geometry keeps recomputing across the new frame, because `derivePath` reads world
poses and `Scene` stores them absolutely.

### Deriving a pose

`derivePose` is the same machinery driving a node's **pose** rather than its
path — same `dependsOn`, same registry-keyed serialization, pushed
invalidation only. The difference is reach: a derived path is resolved at paint time
and reaches only the painter, while a derived pose is what the node *is* at, so
it feeds bounds, hit-testing, selection chrome, snapping and layout.

`dependsOn: 'children'` is the second form of the dependency list: "my own
children, in child order", which a fixed id list cannot express because
reparenting would have to maintain it. It is what a container hugging its
contents wants, and `groupAction` uses it — a group's bounds track its members
instead of freezing at the moment it was made. The kit registers the union
function it needs under `kit:unionOfChildren`, so a grouped document round-trips
through `toJSON` in any scene.

The two forms differ in lifetime as well as in membership. Deleting a node
deletes everything that names it in `dependsOn`; a container outlives the
children it derives from, because an emptied group is still a group. A container
with nothing left falls back to its authored pose rather than collapsing to a
zero box.

Everything reads a pose through `effectivePose(scene, node)` — override, else
derived, else authored — which is why one change reached all three render walks,
the pick walk and the adapters at once. `documentPose` is the same answer minus
the override step, for a reader that must not see an in-flight gesture: an
action capturing the `from` of a transform op. Writing a derived node's pose
still succeeds; it is simply not what anything reads.

`derivePose` may return `null`, meaning "nothing to derive from right now", and
the node falls back to its authored pose. A dependency cycle terminates at
whichever node closes it, answering from its authored pose, and the result is
not cached.

## Custom actions

When no behavior can express what you want — a different commit shape, a
different overlay, a gesture the kit doesn't ship — write an **action**, not a
hook. An action is a static descriptor; you register it and bind a gesture to
it.

```ts
import type { Action, InvocationCtx, OngoingHandle } from '@weasel-js/core';

export const smearAction: Action = {
  id: 'my-app.smear',
  label: 'Smear',
  requires: ['scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'ongoing',
    start: (ctx: InvocationCtx): OngoingHandle => {
      const origin = snapshotPoses(ctx.deps);
      return {
        kind: 'smear',                       // what getActiveAction() reports
        onMove: (m) => { /* update preview state */ },
        previewIds: () => origin.keys(),     // → preview-ghost layer
        previewPose: (id) => computed.get(id),
        onEnd: (e, reason) => {
          if (reason === 'cancel') return;
          (e.deps.applyOps as ApplyOps)(buildOps(), 'Smear');
        },
      };
    },
  },
};
```

Then reach it — ambiently via `defaultBinding`, or from a tool:

```ts
const smearTool = defineTool({
  id: 'smear',
  actions: [smearAction],
  bindings: [{ spec: { kind: 'drag', target: 'selected-body' }, actionId: 'my-app.smear' }],
});
```

What you get for free by doing it this way: the dispatcher owns the
threshold, the gesture id, cancel-on-blur/Escape, and the
`commit`-vs-`cancel` distinction; `previewIds` / `previewPose` /
`previewData` render through the same preview-ghost layer everything else
uses; `overlay()` covers non-ghost chrome; and the action is triggerable from
a palette or toolbar via `registry.trigger('my-app.smear')` without a second
code path.

**Reference implementations** — all under
`packages/core/src/interactions/actions/defaults/`:

- `move.ts` — the fullest: threshold, multi-id, behavior chain, layout
  reflow, reparent-on-commit.
- `areaSelect.ts` — the simplest ongoing action, with `overlay()` rather than
  ghosts (marquee displaces nothing).
- `clone.ts` — opts out of the shared pose pipeline and sets
  `previewHidesSource: false` so the original stays put.
- `editAnchors.ts` — emits `previewData` rather than `previewPose`, for edits
  that live in `node.data` instead of the pose.
- `delete.ts` — a minimal `timing: 'immediate'` one-shot.
- `@weasel-js/hud`'s `src/tool.ts` — a package outside core owning its own
  input, gating three bindings on a `layer:<id>` affordance kind.

## Mounting tools outside `<SceneCanvas>`

For a host that runs weasel's tools in its own React tree — a lab, an embedded
viewport, anything that owns its canvas. `<SceneCanvas>` does two things for a
tool that have nothing to do with painting, and mounting tools yourself means
doing both.

**Register the tool's actions.** `ToolDef.actions` declares them; it does not
register them. `<SceneCanvas>` walks its tools and registers each one as it
mounts. Write that walk yourself:

```tsx
import { useActionsRegistry } from '@weasel-js/core';

const registry = useActionsRegistry();
useEffect(() => {
  if (!registry) return;
  const undo = [...toolsById.values()].flatMap((tool) =>
    (tool.actions ?? []).map((action) => registry.register(action)),
  );
  return () => { for (const u of undo) u(); };
}, [registry, toolsById]);
```

Skip it and the gesture still matches. The dispatcher finds nothing registered
under the id the binding names, prints `weasel dispatcher: binding resolved
actionId "select.pick" which has no registered action`, and falls through to
the next candidate — so the press does nothing, or does whatever was behind it.
That one warning is the whole signal; nothing throws.

Registering from inside the tool hook instead does not work in general:
`useAction` needs an `<ActionsProvider>` above the component that calls it and
returns silently when there is none — with a console warning in a development
build, with nothing at all in a production one. Actions ride on the definition
so that a tool hook stays callable from anywhere.

**Capability eligibility is off until you ask for it.** `select.pick` declares
`eligible: { capability: 'creates-selection' }`. The dispatcher evaluates that
rule only when it has a rule context to evaluate against — `getRuleCtx` on
`useGestureDispatcher`, which answers with the capabilities the current mode
allows. Leave it unset and every `eligible` rule is skipped and the action
runs; `<SceneCanvas>` leaves it unset too unless it was given `getActiveMode`.
Supply one and an action whose capability is missing from that set is dropped
before its `enabled` gate, silently — a rule context that omits
`creates-selection` is a click that selects nothing. The rule reads that set
and nothing else: not the active tool, not the tool's own `capabilities` list.

A rule context asks for a `zoom` — one number, `1` at native scale, from
`viewZoom(view)` on a 2D surface — rather than for a view, so a host whose
viewport is a camera can supply one. Omit it and `zoomAtLeast` declines.

**Mount the providers around all of it.** `<WeaselProvider>` puts the five the
kit expects — deps, actions, active tool, selection, pointer — in scope in one
wrap; call the tool hooks and `useGestureDispatcher` inside it. That hook
throws without the active-tool and dep registries, so this half of the wiring
announces itself.
