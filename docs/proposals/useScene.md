# Proposal: `useScene()` — kit-owned scene primitive

## Status

Proposal. Not yet implemented. Drafted 2026-05-03.

This document sketches a third tier of scene-state ergonomics for
`@orochi235/weasel`. It is forward-looking: type signatures and method names
are illustrative, not normative. No implementation work should be derived from
this doc without a follow-up review.

---

## Motivation

Today the kit offers two ways to wire a scene into `<Canvas>`:

1. **Explicit adapter.** The consumer implements `SceneAdapter` (or a
   `GroupAdapter` for grouped/nested scenes), owns the underlying state shape,
   and passes the adapter via `<Canvas adapter={...} />`. Maximum flexibility,
   maximum boilerplate — the consumer has to design every storage, ordering,
   parenting, and selection-projection decision.

2. **Inline-props shorthand.** The recently-shipped flat-list path:
   `<Canvas items setItems toPose fromPose createDefault ... />`. Internally
   this synthesizes an `arrayAdapter` against a `TObject[]` the consumer holds
   in `useState`. Drastically reduces ceremony for the common case, but bakes
   in one assumption: **the scene is a flat array of objects**. Group/container
   scenes still drop back to tier (1).

Two failure modes follow:

- **Consumer knows too much.** Even for the flat case, the consumer is asked
  to reason about pose projection (`toPose`/`fromPose`), default construction,
  setter contracts, and op ordering — concerns the kit could shoulder if it
  owned the state.
- **Array shape is a wall.** Any consumer that wants a container/leaf tree
  (the eric-style "structures hold plantings" topology, or any nesting
  scenario) must abandon the shorthand and reimplement `GroupAdapter`. There
  is no middle tier.

`useScene()` fills that gap: a kit-owned scene primitive that handles flat
lists and container trees uniformly, declares layers as first-class
orthogonal tags, and bundles undo/redo so consumers don't reinvent it.

---

## The three tiers

| Tier | API | When to use |
|------|-----|-------------|
| 1. Inline-props shorthand | `<Canvas items setItems toPose fromPose createDefault ... />` | Flat list, consumer already has `useState<TObject[]>`, no nesting needed. |
| 2. `useScene()` (this proposal) | `const scene = useScene<TData, TLayer>(opts); <Canvas scene={scene} />` | Anything from a flat list to a deeply-nested container tree with named layers. Default choice for new apps. |
| 3. Explicit adapter | `<Canvas adapter={myAdapter} />` | BYO state container — the consumer has an external store (Zustand, Redux, CRDT, Yjs document, etc.) and needs the kit to read through to it without duplicating storage. |

Tier (1) and tier (3) remain as-is. Tier (2) is new.

---

## Type sketch

> All signatures are illustrative. Names like `Node`, `Scene`, `LayerRecord`
> may collide with existing exports and will need a namespace decision before
> implementation.

### Identifiers and nodes

```ts
/** Opaque branded id. Kit-generated; consumers treat as opaque. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** Common base for both node kinds. */
interface NodeBase<TData, TLayer extends string> {
  id: NodeId;
  /** Required layer tag. Layer membership is orthogonal to tree position. */
  layer: TLayer;
  /** The node's own pose, in its parent's local space. */
  pose: RectPose;
  /** Consumer-owned domain payload. Must be JSON-serializable. */
  data: TData;
  /** Parent container, or null for root-level nodes. */
  parent: NodeId | null;
}

export interface LeafNode<TData, TLayer extends string>
  extends NodeBase<TData, TLayer> {
  kind: 'leaf';
}

export interface ContainerNode<TData, TLayer extends string>
  extends NodeBase<TData, TLayer> {
  kind: 'container';
  /** Ordered child ids. Children's layers may differ from this node's. */
  children: NodeId[];
}

export type Node<TData, TLayer extends string> =
  | LeafNode<TData, TLayer>
  | ContainerNode<TData, TLayer>;
```

Notes:

- A container's `pose` resizes independently of its children. v1 ships
  absolute-positioning containers only: children retain their local poses
  unchanged on container resize, and there is no auto-reflow (no stack, grid,
  or flex). Layout strategies are a separable follow-up; the `Node` /
  `Container` shape above does not need to change to add them later —
  strategies will be additive (see "Resolved design decisions").
- Cross-layer parenting is allowed: a container on `'structures'` may hold a
  child on `'plantings'`. Each node's layer is its own.
- `data` is opaque to the kit. The kit stores it, returns it via getters,
  and snapshots it for undo. It never inspects fields inside `data`.

### Layer records

Layers are tagged orthogonal to the tree. The `Scene` maintains an ordered
list of `LayerRecord`s; render order is layer order, then tree order
(depth-first preorder) within each layer.

```ts
interface LayerRecordBase<TLayer extends string> {
  id: TLayer;
  visible: boolean;
  locked: boolean;
}

export interface SystemLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'system';
}

export interface UserLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'user';
  name: string;
}

export type LayerRecord<TLayer extends string> =
  | SystemLayerRecord<TLayer>
  | UserLayerRecord<TLayer>;
```

System layers are declared at Scene construction and cannot be deleted,
renamed, or reordered. User-layer mutation methods (`addLayer`,
`removeLayer`, `renameLayer`, `moveLayer`) are deferred to a future
revision, but the data structure must support them now: ordered list,
`kind` discriminator, positional insertion via system-layer anchors (never
numeric indices). No nested user layers.

### Scene interface

```ts
export interface Scene<TData, TLayer extends string> {
  // ─── Reads ────────────────────────────────────────────────────────────
  /** All nodes, keyed by id. Stable identity between unrelated mutations. */
  readonly nodes: ReadonlyMap<NodeId, Node<TData, TLayer>>;
  /** Root-level nodes in tree order. */
  readonly roots: readonly NodeId[];
  /** Layer records in render order. */
  readonly layers: readonly LayerRecord<TLayer>[];

  /** O(1) lookup. Returns undefined if id is unknown. */
  get(id: NodeId): Node<TData, TLayer> | undefined;
  /** Children of a container in order; empty array for leaves or unknown ids. */
  childrenOf(id: NodeId): readonly NodeId[];
  /** Walk ancestors from `id` up to root (exclusive of `id`). */
  ancestorsOf(id: NodeId): readonly NodeId[];
  /** Render-ordered traversal: layers in order, tree DFS within each. */
  renderOrder(): Iterable<NodeId>;

  // ─── Node mutations (all auto-undoable) ──────────────────────────────
  add(spec: AddNodeSpec<TData, TLayer>): NodeId;
  remove(id: NodeId): void;
  update(id: NodeId, patch: Partial<Pick<Node<TData, TLayer>, 'data'>>): void;
  setPose(id: NodeId, pose: RectPose): void;
  setLayer(id: NodeId, layer: TLayer): void;

  /** Reparent. `parent: null` moves to root. `index` defaults to end. */
  move(id: NodeId, parent: NodeId | null, index?: number): void;
  /** Reorder within current parent. */
  reorder(id: NodeId, index: number): void;

  // ─── Layer state mutations (all auto-undoable) ───────────────────────
  setLayerVisible(layer: TLayer, visible: boolean): void;
  setLayerLocked(layer: TLayer, locked: boolean): void;

  // ─── Custom op seam (consumer-defined undoable ops) ──────────────────
  registerOp<K extends string, P>(kind: K, handler: RegisteredOp<P>): void;
  recordOp<P>(op: { kind: string; payload: P }): void;

  // ─── History ─────────────────────────────────────────────────────────
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Group subsequent mutations into one undo entry. */
  batch<T>(label: string, fn: () => T): T;

  // ─── Subscription (for non-React observers; React reads via the hook) ─
  subscribe(listener: () => void): () => void;
}

export interface AddNodeSpec<TData, TLayer extends string> {
  kind: 'leaf' | 'container';
  layer: TLayer;
  pose: RectPose;
  data: TData;
  parent?: NodeId | null;
  index?: number;
  /**
   * Optional explicit id. When present, wins over both the Scene's
   * `generateId` and the kit's default generator. Collisions throw.
   */
  id?: NodeId;
}

export interface RegisteredOp<P> {
  apply: (payload: P) => void;
  revert: (payload: P) => void;
}
```

### Hook options

```ts
export interface UseSceneOptions<TData, TLayer extends string> {
  /** Required. System layers in render order. */
  systemLayers: readonly { id: TLayer; visible?: boolean; locked?: boolean }[];
  /** Optional initial nodes. Specs without `parent` become roots. */
  initial?: readonly AddNodeSpec<TData, TLayer>[];
  /** Optional pre-registered consumer ops (avoid post-mount registerOp churn). */
  ops?: Record<string, RegisteredOp<unknown>>;
  /** Optional hard cap on undo stack depth. Default unbounded. */
  historyLimit?: number;
  /**
   * Optional id generator. Used when an `add` call omits an explicit `id`.
   * Falls through to the kit's default generator (nanoid-style) when absent.
   * Returned ids must be unique within the Scene; collisions throw.
   */
  generateId?: () => NodeId;
}

export function useScene<TData, TLayer extends string>(
  options: UseSceneOptions<TData, TLayer>,
): Scene<TData, TLayer>;
```

The hook returns a stable `Scene` reference for the lifetime of the host
component. Internally the Scene is an external store — `subscribe(listener)
=> unsubscribe` and `getSnapshot() => SceneState` — and `useScene()` is
glue over `useSyncExternalStore`. The `subscribe` method on the `Scene`
interface above is the same `subscribe` the hook consumes; there is no
parallel React-only channel. Consumer-facing API is unchanged from a pure-
React implementation, but out-of-React observability (devtools, persistence
sync, non-React hosts) comes essentially for free.

### Node id generation

Three precedence tiers:

1. Explicit `id` on the `add` call (see `AddNodeSpec.id`).
2. The Scene's `generateId` from `UseSceneOptions`.
3. The kit's default generator (nanoid-style; implementation detail —
   consumers treat `NodeId` as opaque).

Collisions on consumer-supplied or `generateId`-returned ids throw
immediately. Silent overwrites would be a debugging nightmare; failing fast
also makes the hybrid model safe for consumers who mix explicit and
generated ids in the same Scene.

This matters in two situations: persistence and sync — consumers reopening
a saved scene need the same ids to come back so undo logs, selection state,
and external references stay valid — and domains with natural ids (file
paths, database rows, CRDT handles) where the consumer wants the external
identifier to be the `NodeId`.

---

## Worked example: eric-shaped use

A garden app with five system layers, structures (raised beds) holding
plantings, plus a custom rename op.

```tsx
type Layer =
  | 'background'
  | 'grid'
  | 'structures'
  | 'plantings'
  | 'overlay';

interface PlantData {
  kind: 'plant';
  species: string;
  plantedOn: string; // ISO date
}

interface StructureData {
  kind: 'structure';
  name: string;
  material: 'wood' | 'stone' | 'metal';
}

type GardenData = PlantData | StructureData;

function Garden() {
  const scene = useScene<GardenData, Layer>({
    systemLayers: [
      { id: 'background' },
      { id: 'grid' },
      { id: 'structures' },
      { id: 'plantings' },
      { id: 'overlay' },
    ],
    ops: {
      'eric:rename-structure': {
        apply: (p: { id: NodeId; from: string; to: string }) => {
          const node = scene.get(p.id);
          if (node && node.data.kind === 'structure') {
            scene.update(p.id, { data: { ...node.data, name: p.to } });
          }
        },
        revert: (p) => {
          const node = scene.get(p.id);
          if (node && node.data.kind === 'structure') {
            scene.update(p.id, { data: { ...node.data, name: p.from } });
          }
        },
      },
    },
  });

  // Add a raised bed (container) on the structures layer.
  const bedId = scene.add({
    kind: 'container',
    layer: 'structures',
    pose: { x: 0, y: 0, width: 240, height: 120 },
    data: { kind: 'structure', name: 'East bed', material: 'wood' },
  });

  // Add a tomato (leaf) on the plantings layer, parented to the bed.
  scene.add({
    kind: 'leaf',
    layer: 'plantings',
    pose: { x: 16, y: 16, width: 32, height: 32 },
    data: { kind: 'plant', species: 'Solanum lycopersicum', plantedOn: '2026-04-15' },
    parent: bedId,
  });

  // Hide the grid while dragging, etc.
  scene.setLayerVisible('grid', false);

  // Invoke the custom rename op (undoable on the same stack).
  scene.recordOp({
    kind: 'eric:rename-structure',
    payload: { id: bedId, from: 'East bed', to: 'East raised bed' },
  });

  return <Canvas scene={scene} />;
}
```

Two things to notice:

- The bed sits on `'structures'` and the tomato sits on `'plantings'`, but
  the tomato's parent is the bed. Render order interleaves them: the bed's
  fill paints during the structures pass, the tomato's icon paints during
  the plantings pass, both honoring the bed's local-to-world transform.
- The custom rename op is on the same undo stack as `scene.add`,
  `scene.setPose`, and `scene.setLayerVisible`. One Cmd-Z, one
  `useUndoRedo(scene)` line, no consumer-side history bookkeeping.

---

## Integration with `<Canvas>`

Today (sketch):

```tsx
// Tier 1 (inline-props shorthand)
<Canvas items={items} setItems={setItems} toPose={...} fromPose={...} createDefault={...} />

// Tier 3 (explicit adapter)
<Canvas adapter={myAdapter} />
```

With this proposal:

```tsx
// Tier 2 (new)
<Canvas scene={scene} />
```

The `<Canvas>` props gain a `scene?: Scene<TData, TLayer>` slot, mutually
exclusive with `adapter` and the inline-props shorthand. Internally the
canvas synthesizes a `SceneAdapter` view over the `Scene` for the existing
gesture/action hooks; nothing in the gesture pipeline changes. The
`SceneAdapter` contract remains the kit's narrow internal protocol and
continues to be the BYO escape hatch for tier (3).

Selection, gesture wiring, layer rendering, and undo all flow from
`scene` automatically. Consumer-supplied custom render layers continue to
work via `<Canvas customLayers={...}>`.

---

## Resolved design decisions

Captured here for traceability; the choices are reflected in the type
sketch, hook options, and worked example above.

- **Node id generation — hybrid, three-tier precedence.** Explicit `id` on
  the `add` spec wins; otherwise the Scene's `generateId` from
  `UseSceneOptions` is called; otherwise the kit's default nanoid-style
  generator runs. Collisions throw. See "Node id generation" above for the
  persistence and natural-id rationale.

- **Subscription model — `useSyncExternalStore` under the hood.** The Scene
  is an external store with `subscribe` / `getSnapshot`; `useScene()` is
  glue. Consumer-facing API is unchanged from a pure-React implementation;
  out-of-React observability (devtools, persistence sync, non-React hosts)
  comes for free.

- **Container layout strategies — deferred to a follow-up.** v1 ships
  absolute-positioning containers only: children's local poses are
  untouched on container resize. Layout strategies (proportional scaling,
  anchor-based stretching, clip-to-container, stack/grid/flex) have their
  own design surface — preview-overlay UX, drop-target semantics, pose-
  shape coupling — and should be designed against real friction from a
  consumer on the v1 Scene rather than guessed at now. The `Node` /
  `Container` shape doesn't need to change to add them later; strategies
  will be additive.

---

## Migration / compatibility

- The eric app is the forcing function that surfaced the
  container/leaf-with-layers requirement, but it is **not** the design
  target. `useScene()` should serve any consumer with a nesting requirement,
  named render layers, or a desire to stop hand-rolling undo.
- The existing `SceneAdapter` / `GroupAdapter` contracts stay. Tier (3) is
  unchanged. Consumers with external stores keep their current path.
- The inline-props shorthand stays. Tier (1) remains the lowest-ceremony
  option for genuinely flat scenes; nothing about its surface needs to
  change to accommodate tier (2).
- No deprecation. The three tiers coexist. Documentation should steer new
  consumers to tier (2) by default and explain when to drop down to (1) or
  jump up to (3).
