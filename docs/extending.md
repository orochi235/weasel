# Extending weasel

Four common extension points: custom layers, custom affordances, custom
gesture behaviors, and non-rect poses — plus writing a whole new action when
none of those fit.

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
defaultVisible?, alwaysOn? }`. Build them with the helpers the kit
exports: `createGridLayer`, `createCellHighlightLayer`, `createTextLayer`,
`createPathLayer`, `createChildrenLayer`, `createSelectionOverlayLayer`,
`createTilePattern`. Or write your own — it's a function.

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
