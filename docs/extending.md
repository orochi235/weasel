# Extending weasel

Three common extension points: custom layers, custom gesture behaviors, and
non-rect poses.

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
  type Affordance,
} from '@weasel-js/core';

// 1. Build an affordance instance via a kit-shipped factory.
const corners = createCornerResizeAffordance({
  handleHitRadius: 8,    // world-px hit zone (divided by view.scale at runtime)
  handleSize: 8,         // screen-px visual size
});

// 2. Wrap if you need to substitute the affordance's stub drag channel
//    with one that drives your own gesture controllers:
const wrappedCorners: Affordance = {
  id: corners.id,
  render: corners.render,
  hitTest: (wx, wy, state, view) => {
    const inner = corners.hitTest?.(wx, wy, state, view);
    if (!inner) return null;
    const scratch = inner.initialScratch as { anchor: ResizeAnchor; targetId: string };
    return {
      drag: {
        onStart: (_e, ctx) => { /* call into your useResize controller */ return 'claim'; },
        onMove:  (_e, ctx) => { /* ... */ return 'claim'; },
        onEnd:   (_e, ctx) => { /* ... */ return 'claim'; },
        onCancel: () => { /* ... */ },
      },
      initialScratch: scratch,
    };
  },
};

// 3. Compose multiple affordances into a single overlay RenderLayer.
const overlay = composeAffordanceLayer(
  'my-tool-overlay',
  'My tool chrome',
  [wrappedCorners /*, ...other affordances */],
);

// 4. Plug it into your tool's overlay field:
const myTool = defineTool({
  id: 'my-tool',
  overlay,
  // ... drag, pointer, keyboard channels ...
});
```

Affordances read state from `ChromeState` — a kit-built read-only object that Canvas constructs each render. `ChromeState` exposes:

- `selection: readonly NodeId[]` — currently selected ids.
- `multiActive: boolean` — true when ≥2 ids are selected in multi-mode.
- `boundsOf(id): Bounds | null` — overlay-aware bounds (returns ghost bounds during a drag).
- `unionBounds: Bounds | null` — multi-union AABB when `multiActive`.
- `modifiers: ModifierState` — alt/shift/meta/ctrl at the time of the call.

The dispatcher consults each layer's `hitTest` on pointerdown before falling through to the active-tool slot walk — so an affordance hit fires the gesture even when a different tool is active. This is the principle: visible chrome is always hittable.

If your tool is in a modal state where chrome hits would interrupt the gesture (pen mid-path, text mid-edit), set `Tool.claimsAll(ctx) => true` for that state. The dispatcher will bypass the layer pipeline entirely.

## Custom gesture behaviors

A behavior plugs into a hook's `options.behaviors` array:

```ts
interface ActionBehavior<TPose, TProposed, TMoveResult> {
  defaultTransient?: boolean;
  onStart?(ctx: GestureContext<TPose>): void;
  onMove?(ctx: GestureContext<TPose>, proposed: TProposed): TMoveResult | void;
  onEnd?(ctx: GestureContext<TPose>): Op[] | null | void;
}
```

Each hook pins the proposed/result shape; pick the matching alias
(`MoveBehavior<TPose>`, `ResizeBehavior<TPose>`, `InsertBehavior<TPose>`,
`AreaSelectBehavior`, `CloneBehavior`).

**Rules of thumb:**

- `onMove` returns a partial result (`{ pose: refined }` for move) to
  refine the proposed pose; `void` leaves it alone. Behaviors run in
  array order — later behaviors see your refinement.
- `onEnd` decides commit ops. First non-`undefined` return wins: `Op[]`
  commits, `null` aborts, `undefined` falls through to the next behavior
  or the hook's default ops (move emits one `createTransformOp` per id).
- `ctx.scratch` is a per-gesture mutable map, wiped on every `start`.
  Namespace by behavior id to avoid collisions:
  `ctx.scratch['snapToContainer']`.
- `defaultTransient: true` flips the gesture to `applyOps` (no history
  entry) unless the consumer overrides `transient` explicitly.
  `selectFromMarquee` is the canonical example.

**Reference behaviors in the source:**

- `packages/core/src/interactions/actions/move/behaviors/snapToGrid.ts` — pure pose refinement.
- `packages/core/src/interactions/actions/move/behaviors/snapToContainer.ts` — scratch state, dwell timer, custom `onEnd`.
- `packages/core/src/interactions/actions/area-select/behaviors/selectFromMarquee.ts` — `defaultTransient`, `onEnd`-only.
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

Pass via `<Canvas geometry={pathPoseDescriptor}>`. The descriptor drives
the default `pickEvery`, `boundsOf`, the selection-overlay bounds source,
and `useResize`'s remap.

The kit ships:

- `RECT_POSE_DESCRIPTOR` — identity for `{x,y,width,height}`. Default.
- `pathPoseDescriptor` — implementation for `Path`.

For grid snapping on a non-rect pose, also pass an `OriginProjection`:

```ts
import { gridSnapStrategy, snap, pathOriginProjection } from '@weasel-js/core';

useMove(adapter, {
  translatePose: pathPoseDescriptor.translate,
  behaviors: [snap(gridSnapStrategy(20, { origin: pathOriginProjection }))],
});
```

`<Canvas>` derives `translatePose` from `geometry.translate` automatically
(see `derivedMoveOptions` in `Canvas.tsx`); for the lower-level case where
you call `useMove` yourself, set it explicitly.

For an end-to-end working demo of all of the above, see
`demo/demos/CompoundPathsDemo.tsx`.

## Custom hooks

If the gesture shape doesn't fit (different proposed-pose pipeline,
different overlay, different commit timing), write a new hook. The shared
structure across move/resize/insert/area-select:

1. State machine with `useRef` (`phase: 'idle' | 'pending' | 'active'`).
   Snapshot origin poses on `start`. Move flips to `active` past
   `dragThresholdPx` (or immediately, depending on the gesture).
2. Build `GestureContext` on `start`: `draggedIds`, `origin`, `current`,
   `modifiers`, `pointer`, `adapter`, empty `scratch`. Update modifiers
   and pointer on every `move`.
3. On each `move`, compute proposed pose from raw delta, then fold each
   `behavior.onMove?.(ctx, proposed)` into the running `proposed`.
4. `useState` an overlay; `setOverlay(...)` after each move.
5. Commit at `end`: walk behaviors looking for `onEnd` returns. `null` →
   cancel, `Op[]` → commit those, all `undefined` → hook's default ops.
6. Transient resolution: `transient = options.transient ??
   behaviors.some(b => b.defaultTransient)`. Transient → `applyOps`,
   otherwise → `dispatchApplyBatch`.

`useMove` is the fullest reference (pending/active threshold, multi-id,
behavior chain, default ops). `useAreaSelect` is the simplest transient
example. `useClone` shows a hook that opts out of the proposed-pose
pipeline entirely.
