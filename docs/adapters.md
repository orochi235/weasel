# Adapters

An **adapter** is the object the interaction layer reads a scene through and
writes it back through: poses, hit-tests, selection, and the mutators ops
apply. This page is for someone wiring a canvas, or handing a scene to
something outside one. It says where the adapter comes from, what it answers,
and when you would write one by hand.

## One wiring: the scene's adapter

`<SceneCanvas scene={scene}>` builds its adapter from the scene, so most apps
never hold one. To hand the same scene to something outside the canvas — a
pose animation, a clipboard, a tool hook — build it yourself:

```tsx
import { useScene, useSceneAdapter, useSelection, tweenPose } from '@weasel-js/core';

const scene = useScene({ items: RECTS });
const selection = useSelection();
const adapter = useSceneAdapter(scene, { selection: selection.adapterMethods });

tweenPose(animator, adapter, { id: 'a', to: { x: 100, y: 0, width: 10, height: 10 }, ms: 250 });
```

`useSceneAdapter(scene, options)` is the hook; `sceneToAdapter(scene, options)`
is the same thing outside React. Both return a `SceneCanvasAdapter`, which is
the whole contract in one type.

**A flat list is a scene.** `useScene({ items })` puts each item under the
scene's root, in list order, on one layer named `default`, with the item as
both its pose and its data. The adapter treats it as the tree it is:
`getChildren(null)` is the list in z-order, and `setChildOrder(null, ids)`
reorders it. There is no separate adapter for arrays.

| Option | What it wires |
|---|---|
| `selection` | `useSelection()` or its `adapterMethods`. Left out, `getSelection` answers `[]` and `setSelection` does nothing. |
| `commitInsert` | The factory an insert drag calls with its bounds. Return `{ pose, data, id? }`, or `null` to abort. |
| `insertLayer` | The layer inserted nodes land on. Default `'default'`. |
| `poseDescriptor` | How to read and rewrite this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. |

What the adapter answers:

- **Reads are what is shown.** `getNodes()` is render order with hidden layers
  left out. `getPose(id)` is the effective pose, in the node's own frame;
  `getWorldPose(id)` folds in every ancestor's.
- **Writes are undoable.** `applyOps(ops, label)` is one history entry. Without
  a label the ops are applied with no checkpoint, which is what a live marquee
  wants.
- **Marquee and lasso take a node by the outline it draws**, rotation included,
  and return containers as well as leaves.
- **`poseTarget(id)`** is the node's animation target, so moves on one node add.

## The contract, in slices

Each reader names only what it asks of an adapter, as a narrow interface in
`packages/core/src/core/adapters/types.ts`. `SceneCanvasAdapter` satisfies all
of them.

| Reader | Slice |
|---|---|
| `move` | `MoveAdapter<TNode, TPose>` |
| `resize` | `ResizeAdapter<TNode, TPose>` |
| `rotate` | `RotateAdapter<TNode, TPose>` |
| `insert`, `clone`, `useClipboardOps` | `InsertAdapter<TNode>` |
| `areaSelect` | `AreaSelectAdapter` |
| `lassoSelect` | `LassoSelectAdapter` |
| `useSelectTool` | `SelectAdapter<TNode, TPose>` |
| `tweenPose`, `springPose` | `PoseAnimationAdapter<TPose>` |
| reorder ops | `OrderedAdapter` |

`OrderedAdapter` is `getChildren(parentId)` and `setChildOrder(parentId, ids)`,
with `null` naming the root. Array order **is** z-order: index 0 is the bottom.
Hit-tests walk it in reverse and render layers walk it forward.

`MoveAdapter.findSnapTarget?(draggedId, worldX, worldY)` returns
`{ parentId, slotPose, metadata? }`, where the dragged node would re-parent to
if released. The kit treats `metadata` as opaque; renderers consume it.

## Writing one by hand

Write an adapter when the kit does not own the store — a Redux or CRDT
document, say. There is no base class. Implement the slice the reader takes and pass the
object in.

Every adapter carries the tree: `getNode`, `getParent`, and `getChildren`. A
store with no nesting answers as a tree whose nodes are all roots, and a node
with no children answers `[]`:

```ts
const adapter: SelectAdapter<Rect, Pose> = {
  getNode: (id) => rects.find((r) => r.id === id),
  getNodes: () => rects,              // bottom first
  getParent: () => null,
  getChildren: (parentId) => (parentId === null ? rects.map((r) => r.id) : []),
  getPose: (id) => poseOf(id),
  setPose: (id, pose) => store.setPose(id, pose),
  ...selection.adapterMethods,        // getSelection / setSelection
};
const select = useSelectTool(adapter, {});
```

What a reader does without an optional member:

- No `applyOps`: ops are applied against the adapter one at a time, with no
  history entry.
- No `poseTarget`: a pose animation writes `setPose` every frame, and a second
  move on a node cancels the first. `createWrittenPoseTarget({ read, write })`
  builds a target over a store with one pose per node.

A hand-written adapter cannot be passed to `<SceneCanvas>`, which takes a
scene.

## Deps, not adapters

Selection-driven operations — delete, duplicate, nudge, group, reorder,
undo/redo — take no adapter. They are **actions**, and they read what they
need from the **dep registry**: a name → live-thunk map published by
`useStandardActions` (and by `<SceneCanvas>`'s own registrars) and resolved
fresh at each invocation. A descriptor declares what it reads in `requires`,
and dev builds warn when an invoker touches a dep it didn't declare.

The schema is `DepSchema` in
`packages/core/src/interactions/actions/depSchema.ts`. Core keys:

| Dep | What it carries |
|---|---|
| `selection` | `SelectionApi` — the same object `<SceneCanvas>` reads |
| `scene` | the scene tree: structural reads + undoable mutations |
| `history` | undo/redo bound to the current scene |
| `view` | camera position + scale |
| `activeTool` | active tool id + the hotkey-hold stack |
| `applyOps` | optional consumer commit hook — when present, ops route through consumer history as one entry instead of `scene.applyBatch` |

Plus the per-feature deps: `insert`, `areaSelect`, `lassoSelect`,
`editAnchors`, `textEdit`, `snap`, `layout`, `slice`, `ingestion`,
`resizePolicy`, `geometryProjection`, `booleansAdapter`,
`nodeAtPoint`, `dispatcher`.

And `poseDescriptor` — how to read and rewrite this scene's poses. Every
built-in action that touches a pose consults it. `<SceneCanvas poseDescriptor>`
publishes it; absent, it is `AUTO_POSE_DESCRIPTOR`, which reads rect poses and
`Path` poses.

So there is no `DeleteAdapter` / `NudgeAdapter` / `UndoRedoAdapter` to
implement: `delete` declares `requires: ['scene', 'selection', 'applyOps']` and
gets them.
