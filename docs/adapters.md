# Adapters

An **adapter** is the bridge between weasel and your scene. The kit reads
poses, hit-tests, and commits ops through this interface; the adapter
translates those calls into your domain mutations.

The kit ships several **narrow** adapter interfaces (one per gesture or
action). TypeScript's structural typing means a single struct that has all
the methods satisfies all of them at once. Most apps build one adapter per
scene and pass it to every hook.

```ts
import type {
  MoveAdapter, ResizeAdapter, RotateAdapter,
  InsertAdapter, AreaSelectAdapter,
} from '@weasel-js/core';

// One value, satisfies them all.
const adapter: MoveAdapter<Rect, Pose>
  & ResizeAdapter<Rect, Pose>
  & RotateAdapter<Rect, Pose>
  & InsertAdapter<Rect>
  & AreaSelectAdapter = makeAdapter();
```

The narrow shapes live in `packages/core/src/core/adapters/types.ts`.

Selection-driven operations — delete, duplicate, nudge, group, reorder,
undo/redo — no longer take adapters at all. They're **actions**, and they read
what they need from the **dep registry** by name (`scene`, `selection`,
`history`, `applyOps`, …). See [Deps, not adapters](#deps-not-adapters).

## `arrayAdapter` — the easy default

`arrayAdapter<TNode, TPose>(config)` synthesizes a multi-faceted adapter
from a `useState`-backed array. It satisfies `MoveAdapter`, `ResizeAdapter`,
`InsertAdapter`, and `AreaSelectAdapter` out of the box.

```ts
import { arrayAdapter, useSelection } from '@weasel-js/core';

const [rects, setRects] = useState<Rect[]>(INITIAL);
const rectsRef = useRef(rects);
rectsRef.current = rects;
const selection = useSelection();

const adapter = {
  ...arrayAdapter<Rect, Pose>({
    ref: rectsRef,
    setItems: setRects,
    toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    // Optional. Defaults to shallow spread merge.
    fromPose: (r, pose) => ({ ...r, ...pose }),
    // Optional — needed for `commitInsert` to mint new objects.
    createDefault: (b) => ({ id: nextId(), ...b, color: pickColor() }),
    // Optional — needed for non-rect poses (path, polygon, …).
    intersectsRect: (pose, rect) => pathPoseDescriptor.intersectsRect!(pose, rect),
  }),
  ...selection.adapterMethods,
};
```

Spreading `selection.adapterMethods` wires `getSelection` / `setSelection`
through the same `useSelection` instance the canvas uses, so action hooks
and gestures stay in sync.

`arrayAdapter` does **not** supply `applyBatch`. Hooks fall back to a
built-in dispatcher (`dispatchApplyBatch`) that applies each op against the
adapter directly. Apps with custom history wire their own `applyBatch` by
spreading on top.

### `applyOps` and the `this`-binding pattern

`arrayAdapter` defines `applyOps` as a method shorthand:

```ts
applyOps(ops: Op[]) {
  applyOpsTo(this, ops);
}
```

That `this` is the **call-site receiver**, not the original `arrayAdapter`
object. So when you spread additional methods on top:

```ts
const adapter = {
  ...arrayAdapter<Rect, Pose>({ ... }),
  ...selection.adapterMethods,
  insertNode: (obj) => setRects((rs) => [...rs, obj]),
};
```

…and a hook calls `adapter.applyOps(ops)`, ops dispatch against the merged
object — including your override of `insertNode` and the
selection-backed `setSelection`. If you copy the method off
(`const fn = adapter.applyOps`) you'll lose `this` and ops will dispatch
against `undefined`. Don't do that.

This shipped recently; older code may have worked around it with
hand-rolled `applyOps` wrappers — those are no longer needed.

## When to write a custom adapter

Reach for a custom adapter when:

- Your scene isn't a flat array (tree of children, indexed by parent).
- Your store is Redux/Zustand/MobX/CRDT — `arrayAdapter`'s `useState`
  setter doesn't fit.
- You want op-batched undo via `createHistory(adapter)` and need
  `applyBatch` to push entries.
- Pose extraction is expensive and you want memoization beyond the per-id
  array scan `arrayAdapter` does.

There's no base class; just implement the methods the gestures and actions
you use require. Compose narrow types via intersection.

## Adapter responsibilities by gesture

Pointer-driven actions still do their math through an adapter. The shapes are
in `packages/core/src/core/adapters/types.ts`.

| Action | Required adapter shape |
|---|---|
| `move` | `MoveAdapter<TNode, TPose>` |
| `resize` | `ResizeAdapter<TNode, TPose>` |
| `rotate` | `RotateAdapter<TNode, TPose>` |
| `insert`, `clone` | `InsertAdapter<TNode>` |
| `areaSelect` | `AreaSelectAdapter` |
| `lassoSelect` | `LassoSelectAdapter` |
| `useTextEdit` | none — direct callbacks (see hook signature) |

`<SceneCanvas>` synthesizes all of these from your `Scene` via
`sceneToAdapter`; you supply one explicitly only on the bare-adapter tier.

## Deps, not adapters

Everything else an action needs arrives through the **dep registry**: a
name → live-thunk map published by `useStandardActions` (and by
`<SceneCanvas>`'s own registrars) and resolved fresh at each invocation. A
descriptor declares what it reads in `requires`, and dev builds warn when an
invoker touches a dep it didn't declare.

The schema is `DepSchema` in
`packages/core/src/interactions/actions/depSchema.ts`. Core keys:

| Dep | What it carries |
|---|---|
| `selection` | `SelectionApi` — the same object `<SceneCanvas>` reads |
| `scene` | the scene tree: structural reads + undoable mutations |
| `history` | undo/redo bound to the current scene |
| `view` | camera position + scale |
| `pointer` | canvas pointer position in world space |
| `activeTool` | active tool id + the hotkey-hold stack |
| `applyOps` | optional consumer commit hook — when present, ops route through consumer history as one entry instead of `scene.applyBatch` |

Plus the per-feature deps: `insert`, `areaSelect`, `lassoSelect`,
`editAnchors`, `textEdit`, `snap`, `layout`, `slice`, `ingestion`,
`resizePolicy`, `geometryProjection`, `poseComposition`, `booleansAdapter`,
`nodeAtPoint`, `dispatcher`.

This is why there is no `DeleteAdapter` / `NudgeAdapter` / `UndoRedoAdapter` to
implement: `delete` declares `requires: ['scene', 'selection', 'applyOps']` and
gets them.

## Optional mixins

- **`OrderedAdapter`** — `getChildren?(parentId): string[]`,
  `setChildOrder?(parentId, ids)`. Convention: array order **is** z-order
  (index 0 = bottom). Hit-tests iterate in reverse; render layers iterate
  forward. Reorder ops and the `reorder.*` actions no-op if either method is
  missing.

## Snap targets

`MoveAdapter.findSnapTarget?(draggedId, worldX, worldY): SnapTarget<TPose>
| null` — optional. Returns `{ parentId, slotPose, metadata? }` describing
where the dragged object would re-parent to if released. The kit treats
`metadata` as opaque; renderers consume it.
