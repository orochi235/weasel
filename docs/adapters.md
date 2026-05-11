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
} from '@orochi235/weasel';

// One value, satisfies them all.
const adapter: MoveAdapter<Rect, Pose>
  & ResizeAdapter<Rect, Pose>
  & RotateAdapter<Rect, Pose>
  & InsertAdapter<Rect>
  & AreaSelectAdapter = makeAdapter();
```

The narrow shapes live in `src/core/adapters/types.ts`. Action hooks
(`useDelete`, `useDuplicate`, `useNudge`, `useGroup`, `useReorder`,
`useUndoRedo`, `useClipboard`) each have their own narrow adapter type
co-located with the hook.

## `arrayAdapter` — the easy default

`arrayAdapter<TNode, TPose>(config)` synthesizes a multi-faceted adapter
from a `useState`-backed array. It satisfies `MoveAdapter`, `ResizeAdapter`,
`InsertAdapter`, and `AreaSelectAdapter` out of the box.

```ts
import { arrayAdapter, useSelection } from '@orochi235/weasel';

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

## Adapter responsibilities by hook

| Hook | Required adapter shape |
|---|---|
| `useMove` | `MoveAdapter<TNode, TPose>` |
| `useResize` | `ResizeAdapter<TNode, TPose>` |
| `useRotate` | `RotateAdapter<TNode, TPose>` |
| `useInsert` | `InsertAdapter<TNode>` |
| `useAreaSelect` | `AreaSelectAdapter` |
| `useClone` | `InsertAdapter<TNode>` |
| `useTextEdit` | none — direct callbacks (see hook signature) |
| `useDelete` | `DeleteAdapter` (`getSelection`, optional `getNode`, optional `setSelection`/`removeNode`/`applyBatch`) |
| `useDuplicate` | `DuplicateAdapter<TPose>` (adds `cloneNode(id, offset)`) |
| `useNudge` | `NudgeAdapter<TPose>` (`getSelection`, `getPose`) |
| `useReorder` | `ReorderAdapter` (with optional `getChildren`/`setChildOrder` — no-op when absent) |
| `useGroup` / `useUngroup` | `GroupActionAdapter` (extends `GroupAdapter`) |
| `useNestedGroup` / `useNestedUngroup` | `NestedGroupActionAdapter` |
| `useUndoRedo` | `UndoRedoAdapter` (`undo`, `redo`, optional `canUndo`/`canRedo`) |
| `useClipboard` | `ClipboardAdapter<TNode>` (extends `InsertAdapter`) |
| `useSelectAll` | `SelectAllAdapter` (`getSelection`, `listAll`) |
| `useEscape` | `EscapeAdapter` (`getSelection`) |

## Optional mixins

- **`OrderedAdapter`** — `getChildren?(parentId): string[]`,
  `setChildOrder?(parentId, ids)`. Convention: array order **is** z-order
  (index 0 = bottom). Hit-tests iterate in reverse; render layers iterate
  forward. Reorder ops and `useReorder` no-op if either method is missing.
- **`GroupAdapter`** — virtual groups with first-class ids and
  multi-membership. See `src/features/groups/types.ts`.

## Snap targets

`MoveAdapter.findSnapTarget?(draggedId, worldX, worldY): SnapTarget<TPose>
| null` — optional. Returns `{ parentId, slotPose, metadata? }` describing
where the dragged object would re-parent to if released. The kit treats
`metadata` as opaque; renderers consume it.
