# Extending weasel

Five common extension points: custom layers, custom affordances, custom
gesture behaviors, non-rect poses, and derived geometry — plus writing a whole
new action when none of those fit.

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
  getBounds(pose: TPose): { x: number; y: number; width: number; height: number };
  remapBounds(pose: TPose, src: ResizePose, dst: ResizePose): TPose;
  translate?(pose: TPose, dx: number, dy: number): TPose;
  intersectsRect?(pose: TPose, rect: ResizePose): boolean;
}
```

`remapBounds` is one operation that subsumes both single-leaf resize ("set
my AABB to dst") and group resize ("scale me as a leaf inside parent's
src→dst rect") — they're the same affine map.

Pass via `<SceneCanvas geometry={{ pickEvery, boundsOf }}>` for the hit-test
and bounds overrides, and via the pose-descriptor seam for the math. The
descriptor drives the default `pickEvery`, `boundsOf`, the selection-overlay
bounds source, and the `resize` action's remap.

The kit ships:

- `RECT_POSE_DESCRIPTOR` — identity for `{x,y,width,height}`. Default.
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

**Translation is a separate question.** `moveAction`'s `scene` dep is typed
`Scene<unknown, string, unknown>`, so poses are read and written as `unknown`
and `translatePoseGeneric` falls back to `RECT_POSE_DESCRIPTOR.translate`,
which treats any pose as `{ x, y, … }`. Two ways out for a non-rect pose:

- wire the **`geometryProjection`** dep, which `translatePoseGeneric` consults
  before the rect fallback; or
- register your own descriptor under the `move` id with a typed
  `translatePose`.

For an end-to-end working demo of all of the above, see
`apps/site/demos/CompoundPathsDemo.tsx`.

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

`derivePath` receives each dependency's **effective** pose in `dependsOn` order —
its ephemeral override when it has one, else the pose the scene stores — which
is exactly what the render walks paint. A dependency the scene cannot resolve
arrives as `undefined`; returning `null` means "nothing to draw right now".

`node` arrives typed `SceneNode<unknown, string, TPose>`, so a `derivePath` that
reads `node.data` casts. Naming `TData` and `TLayer` there would put them in a
contravariant position and make `Scene` invariant in both.

**Serialization carries a registry key, never the function.** `SceneRegistry`
does for `derivePath` what it already does for `clipFromPose`: `toJSON` looks the
function up in `registry.derivePath` and writes `derivePathKey`, throwing if it has no
key, and `sceneFromJSON` resolves the key back. A key missing from the registry
restores the node without its derived geometry and warns.

**Invalidation is pushed by the scene, not pulled by comparison.** A pose
override mutates its buffer in place rather than replacing the reference —
which is what a drag does — so no reference-keyed memo can observe an endpoint
moving. The scene keeps a reverse index and drops its dependents' pose-keyed
memo slots wherever a dependency's pose can change, transitively, including on
undo. Nothing in the paint path watches for it.

**Deleting a node deletes everything that derives from it**, transitively,
including those nodes' own subtrees, as one undo entry. A dependent is not a
descendant, so `scene.remove` can take nodes anywhere in the tree that the
caller never named — deleting a box takes its edges, and `removeLayer` reaches
nodes on other layers. `scene.removeMany(ids)` does the same for several roots
in one entry, absorbing ids that another root's cascade already covers, which
is what makes it safe to hand a whole selection.

`dependsOn` is fixed when the node is added; retargeting is remove plus add.
Reparenting a node out from under its dependents is legal and intended: the
geometry keeps recomputing across the new frame, because `derivePath` reads world
poses and `Scene` stores them absolutely.

**Two gaps to know about before building on this** — both in `docs/TODO.md`
under "Derived geometry follow-ups": a derived node has no silhouette, so a
zero-sized edge is effectively unpickable; and the built-in move, resize and
rotate actions publish previews on a channel the derived lookup does not read,
so an edge stays anchored during a drag and jumps on drop. Driving the pose
overrides directly is unaffected.

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

### When it isn't a tool

A tool is the entry that declares `eligibility.focus` — a mode the user
switches into, with scratch and previews. Plenty of things route input without
being one: chrome that owns its own presses, an always-on viewport behavior, a
feature that only ever reacts to its own affordances. Those are contributions
with the same `bindings` and `actions` fields and a different declaration:

```ts
const hud: Contribution = {
  id: 'my-app.hud',
  eligibility: { claimed: true },   // only input my own affordances produced
  actions: [pressAction, dragAction],
  bindings: [{ spec: { kind: 'drag', target: { kindOf: isMyHit } }, actionId: 'my-app.hud.drag' }],
};
```

The four conditions — `focus`, `offhand`, `always`, `claimed` — are a set, not
a choice: an entry can be palette-selectable *and* held-key engaged, as the hand
tool is. Ship several entries as one bundle with `mergeContributions(...)`.

A `claimed` entry must give its bindings a target that consults the affordance
(a `kindOf` predicate or `affordance:<kind>`), or its own exclusive claim
filters them out — a dev-only warning names it if that happens.

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
