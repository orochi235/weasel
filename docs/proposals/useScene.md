# `useScene()` — kit-owned scene primitive (reference)

## Status

Shipped. This document was originally a forward-looking proposal drafted
2026-05-03; it now describes the actual surface that landed across commits
`391ba2e` (Phase 1 — `createScene` + `useScene`), `da9675a` (trivial-form
shorthand + `SceneCanvas` insert/cascade defaults + demo ports), and
`24c72eb` (gesture-controller hardening). Open follow-ups are listed at the
bottom.

Source-of-truth files:

- `src/core/scene/types.ts` — types
- `src/core/scene/scene.ts` — `createScene` (Scene class)
- `src/core/scene/useScene.ts` — `useScene` hook
- `src/canvas/SceneCanvas.tsx` — Canvas wrapper
- `src/canvas/sceneAdapter.ts` — `sceneToAdapter` synthesis
- `demo/demos/SceneDemo.tsx` — worked example demo

---

## Motivation

The kit offers two ways to wire a scene into `<Canvas>`:

1. **Explicit adapter.** The consumer implements a `MoveAdapter` /
   `ResizeAdapter` / etc., owns the underlying state shape, and passes
   `<Canvas adapter={...} />`. Maximum flexibility, maximum boilerplate.

2. **Inline-props shorthand.** `<Canvas items setItems toPose fromPose
   createDefault ... />` synthesizes an `arrayAdapter` against a `TNode[]`
   the consumer holds in `useState`. Drastically reduces ceremony for the
   common case, but assumes the scene is a flat array.

Two failure modes followed:

- **Consumer knows too much.** Even for the flat case, the consumer reasons
  about pose projection, default construction, setter contracts, and op
  ordering — concerns the kit could shoulder if it owned the state.
- **Array shape is a wall.** Any consumer that wants a container/leaf tree
  (the eric-style "structures hold plantings" topology, or any nesting
  scenario) has to abandon the shorthand and reimplement the adapter
  protocol. There is no middle tier.

`useScene()` fills that gap: a kit-owned scene primitive that handles flat
lists and container trees uniformly, declares layers as first-class
orthogonal tags, and bundles undo/redo so consumers don't reinvent it.

---

## The three tiers

| Tier | API | When to use |
|------|-----|-------------|
| 1. Inline-props shorthand | `<Canvas items setItems toPose fromPose createDefault ... />` | Flat list, consumer already has `useState<TNode[]>`, no nesting needed. |
| 2. `useScene()` + `<SceneCanvas>` | `const scene = useScene<TData, TLayer, TPose>(opts); <SceneCanvas scene={scene} />` | Anything from a flat list to a container tree with named layers. Default choice for new apps. |
| 3. Explicit adapter | `<Canvas adapter={myAdapter} />` | BYO state container — the consumer has an external store (Zustand, Redux, CRDT, Yjs document, etc.) and needs the kit to read through to it without duplicating storage. |

Tier (1) and tier (3) are unchanged. Tier (2) is the kit-owned scene path —
delivered as a **separate component (`<SceneCanvas>`)** rather than a `scene`
prop on `<Canvas>`. The wrapper synthesizes an adapter via `sceneToAdapter`
and forwards every other prop to `<Canvas>`. This keeps `<Canvas>` agnostic
about scene state and lets `<SceneCanvas>` own scene-specific defaults
(undo/redo wiring, container cascade-on-drag).

---

## Surface

> Excerpts; full types in `src/core/scene/types.ts`.

### Identifiers and nodes

```ts
export type NodeId = string & { readonly __brand: 'NodeId' };
export const asNodeId: (s: string) => NodeId;

export interface LeafNode<TData, TLayer extends string, TPose = RectPose> {
  kind: 'leaf';
  id: NodeId;
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent: NodeId | null;
}

export interface ContainerNode<TData, TLayer extends string, TPose = RectPose> {
  kind: 'container';
  id: NodeId;
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent: NodeId | null;
  children: NodeId[];
}

export type Node<TData, TLayer extends string, TPose = RectPose> =
  | LeafNode<TData, TLayer, TPose>
  | ContainerNode<TData, TLayer, TPose>;
```

Notes:

- `TPose` defaults to `RectPose` but is generic, matching the kit's path/pose
  generalization (`PoseDescriptor<TPose>` + `pathPoseDescriptor`).
- Cross-layer parenting is allowed: a container on `'structures'` may hold a
  child on `'plantings'`. Each node's layer is its own.
- A container's pose is independent of its children's poses. v1 stores
  **absolute** poses on every node (`SceneCanvas` cascades container drags
  to descendants — see `SceneCanvas.tsx`). Layout strategies are deferred.
- `data` is opaque to the kit. The kit stores it, returns it via getters,
  and snapshots it for undo. It never inspects fields inside `data`.

### Layer records

```ts
export interface SystemLayerRecord<TLayer extends string> {
  kind: 'system';
  id: TLayer;
  visible: boolean;
  locked: boolean;
}

export interface UserLayerRecord<TLayer extends string> {
  kind: 'user';
  id: TLayer;
  visible: boolean;
  locked: boolean;
  name: string;
}

export type LayerRecord<TLayer extends string> =
  | SystemLayerRecord<TLayer>
  | UserLayerRecord<TLayer>;
```

System layers are declared at Scene construction and cannot be deleted,
renamed, or reordered. User-layer mutation methods (`addLayer`,
`removeLayer`, `renameLayer`, `moveLayer`) are deferred — but the data
structure already supports them (`kind` discriminator, ordered list).
Runtime visibility/lock toggles ship today via `setLayerVisible` /
`setLayerLocked`.

### Scene interface

```ts
export interface Scene<TData, TLayer extends string, TPose = RectPose> {
  // Reads
  readonly nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>;
  readonly roots: readonly NodeId[];
  readonly layers: readonly LayerRecord<TLayer>[];
  get(id: NodeId): Node<TData, TLayer, TPose> | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  ancestorsOf(id: NodeId): readonly NodeId[];
  renderOrder(): Iterable<NodeId>;

  // Mutations (all auto-undoable)
  add(spec: AddNodeSpec<TData, TLayer, TPose>): NodeId;
  remove(id: NodeId): void;
  update(id: NodeId, patch: { data: TData }): void;
  setPose(id: NodeId, pose: TPose): void;
  setLayer(id: NodeId, layer: TLayer): void;
  move(id: NodeId, parent: NodeId | null, index?: number): void;
  reorder(id: NodeId, index: number): void;
  setLayerVisible(layer: TLayer, visible: boolean): void;
  setLayerLocked(layer: TLayer, locked: boolean): void;

  // Custom op seam
  registerOp<P>(kind: string, handler: RegisteredOp<P>): void;
  recordOp<P>(op: { kind: string; payload: P }): void;

  // History
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  batch<T>(label: string, fn: () => T): T;

  // Subscription (used by useScene; also for non-React observers)
  subscribe(listener: () => void): () => void;
  /** Monotonically increasing version. Snapshot for `useSyncExternalStore`. */
  getVersion(): number;
}

export interface AddNodeSpec<TData, TLayer extends string, TPose = RectPose> {
  kind: 'leaf' | 'container';
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent?: NodeId | null;
  index?: number;
  /** Explicit id wins over `generateId` and the kit default. Collisions throw. */
  id?: NodeId;
}

export interface RegisteredOp<P> {
  apply: (payload: P) => void;
  revert: (payload: P) => void;
}
```

### Hook surface

`useScene` has two call shapes:

```ts
// Trivial form: a flat list of items, one auto-registered system layer
// named 'default'. Each item is added as a leaf with pose === data === item.
export function useScene<TItem extends { id: string }>(
  options: { items: readonly TItem[]; historyLimit?: number; generateId?: () => NodeId },
): Scene<TItem, 'default', TItem>;

// Full form: explicit layers, parenting, custom ops.
export function useScene<TData, TLayer extends string, TPose = RectPose>(
  options: UseSceneOptions<TData, TLayer, TPose>,
): Scene<TData, TLayer, TPose>;
```

The hook returns a stable `Scene` reference for the lifetime of the host
component. Internally the Scene is an external store
(`subscribe(listener) => unsubscribe`, `getVersion(): number`); `useScene` is
glue over `useSyncExternalStore`. Out-of-React observability (devtools,
persistence sync, non-React hosts) comes for free.

### Node id generation

Three precedence tiers:

1. Explicit `id` on the `add` call.
2. The Scene's `generateId` from `UseSceneOptions`.
3. The kit's default generator (nanoid-style; treat `NodeId` as opaque).

Collisions throw immediately. Silent overwrites would be a debugging
nightmare; failing fast also makes the hybrid model safe for consumers who
mix explicit and generated ids in the same Scene.

This matters in two situations: persistence/sync (consumers reopening a saved
scene need the same ids back so undo logs, selection state, and external
references stay valid) and domains with natural ids (file paths, database
rows, CRDT handles) where the consumer wants the external identifier to be
the `NodeId`.

---

## Worked example

`demo/demos/SceneDemo.tsx` (excerpt — see file for full source):

```tsx
type LayerId = 'garden' | 'blueprint' | 'structures' | 'zones' | 'plantings';

const scene = useScene<NodeData, LayerId, Pose>({
  systemLayers: [
    { id: 'garden' }, { id: 'blueprint' },
    { id: 'zones' }, { id: 'structures' }, { id: 'plantings' },
  ],
  initial: [
    { id: 'planter-1', kind: 'container', layer: 'structures', pose, data },
    // Cross-layer parenting: leaf on 'plantings', parent on 'structures'.
    { id: 'plant-a',  kind: 'leaf', layer: 'plantings', pose, data, parent: 'planter-1' },
  ],
});

// Consumer op participates in the same undo stack as scene.add / scene.setPose.
scene.registerOp<SetColorPayload>('setColor', { apply, revert });

return (
  <SceneCanvas
    width={W} height={H} scene={scene}
    layers={{ scene: { drawOne: (cx, node, pose) => { /* ... */ } } }}
  />
);
```

`<SceneCanvas>` wires `sceneToAdapter`, the `useUndoRedo` gesture (with
`scene` as its history adapter), and container cascade-on-drag (live overlay
+ commit-time descendant translate) by default.

Two things to notice:

- The planter sits on `'structures'` and the plant sits on `'plantings'`,
  but the plant's parent is the planter. Render order interleaves them: the
  planter paints during the structures pass, the plant paints during the
  plantings pass.
- The custom `setColor` op is on the same undo stack as `scene.add`,
  `scene.setPose`, and `scene.setLayerVisible`. One Cmd-Z, no consumer-side
  history bookkeeping.

---

## Design decisions (as shipped)

- **Node id generation — hybrid, three-tier precedence.** Explicit `id` on
  the `add` spec wins; otherwise the Scene's `generateId` from
  `UseSceneOptions`; otherwise the kit's default nanoid-style generator.
  Collisions throw.

- **Subscription model — `useSyncExternalStore` under the hood.** The Scene
  exposes `subscribe` + `getVersion` (a monotonic counter used as the
  snapshot). `useScene` is glue. Out-of-React observability comes for free.

- **Container layout strategies — deferred.** v1 ships absolute-positioning
  containers only: children's poses are stored absolute, and `SceneCanvas`
  cascades container-drag deltas to descendants at commit time. Layout
  strategies (proportional scaling, anchor-based stretching, clip-to-
  container, stack/grid/flex) have their own design surface — preview-
  overlay UX, drop-target semantics, pose-shape coupling — and should be
  designed against real friction from a consumer on the v1 Scene rather than
  guessed at now. The `Node` / `ContainerNode` shape doesn't need to change
  to add them later; strategies will be additive.

- **Canvas integration — separate component, not a Canvas prop.** The
  proposal originally suggested adding a `scene?` slot to `<Canvas>`.
  Shipped as `<SceneCanvas>` instead — keeps `<Canvas>` agnostic about scene
  state and gives the wrapper a place to own scene-specific defaults
  (undo/redo gesture wiring, container cascade) without bloating `<Canvas>`'s
  prop surface.

- **Trivial-form shorthand — added during implementation.**
  `useScene({ items })` is a third call shape that auto-creates a `'default'`
  system layer and treats `pose === data === item`. Lower-ceremony than the
  full form when the consumer just wants a flat list with kit-owned undo.

---

## Migration / compatibility

- The existing `MoveAdapter` / `ResizeAdapter` / `RotateAdapter` /
  `InsertAdapter` contracts stay. Tier (3) is unchanged. Consumers with
  external stores keep their current path.
- The inline-props shorthand stays. Tier (1) remains the lowest-ceremony
  option for genuinely flat scenes; nothing about its surface changed to
  accommodate tier (2).
- No deprecation. The three tiers coexist. Documentation should steer new
  consumers to tier (2) by default and explain when to drop down to (1) or
  jump up to (3).

---

## Open follow-ups

- **Op log serialization.** Persistence + sync are stated motivators for
  hybrid id generation, but the on-disk shape of built-in ops
  (`add`/`remove`/`move`/`setPose`) isn't defined. Consumer `recordOp`
  payloads are required to be JSON-serializable; the matching guarantee for
  built-in ops needs to be pinned before the persistence story is real.

- **User-layer mutations.** `addLayer` / `removeLayer` / `renameLayer` /
  `moveLayer` (with `before`/`after` system-layer anchors). The data
  structure already supports them; methods aren't on the interface yet.
  Defer until a real consumer wants runtime layer management.

- **Selection in Scene vs external.** Selection state currently lives
  outside Scene (Canvas's `useSelection`). Moving it onto Scene would let
  undo capture selection-at-mutation and unify the persistence shape. Open
  question; not a Phase-defined task.

- **Container layout strategies.** See "Design decisions" above. Wait for
  consumer friction.

- **Tree-mutation invariants worth pinning explicitly.** `remove(containerId)`
  cascade vs orphan-to-root behavior; `move(id, parent)` cycle detection;
  whether `setLayer` on a container cascades. Today these have implementations
  but no docs.
