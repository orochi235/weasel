# Hierarchical Scene Rendering (Phase 1 of nested clipping)

**Status:** design approved 2026-05-10. Phase 1 of a two-phase rollout. Phase 2 (the actual `clip` API and stencil renderer) will be specced separately after Phase 1 lands.

**Goal:** Switch Canvas's scene-layer builder from flat (`adapter.getNodes()` loop) to hierarchical (tree walk emitting nested `GroupDrawCommand`s). Add validation that forbids cross-layer subtrees, since subtree-bounded rendering cannot honor today's cross-layer escape behavior.

**Non-goals:**
- The `clip` API itself (Phase 2).
- Stencil-buffer rendering in WebGL (Phase 2).
- Clip-aware hit-testing (Phase 2).
- A transform stack on groups (out of scope entirely; weasel's flat-pose model is deliberate).

---

## Motivation

Garden needs nested clipping: regions clip beds, beds clip plantings. The renderer-side path Eric proposed (`clip?: Path` on `GroupDrawCommand`) requires that the kit emit hierarchical group commands in the first place. Today it doesn't — Canvas's scene layer iterates `adapter.getNodes()` flat and concatenates each node's `drawOne` output into a single list. Phase 1 fixes that. Phase 2 will add the `clip` channel on top.

## Decisions locked in

- **Subtree-bounded z-order.** A container is painted, then its entire subtree, then the next sibling. Standard editor model (Figma/SVG/Illustrator). The alternative — sibling-interleaved flat order — is incompatible with clip stencils once they land in Phase 2.
- **Parent below, children above.** A container's own draw commands precede its children's draw commands inside the wrapper group. Matches SVG and the existing flat order when a container's pose paint precedes its children's poses.
- **Layer-major remains outermost.** `buildSceneTree` produces one root group per layer (in `scene.layers` order). Hierarchical traversal happens within each layer's group.
- **Cross-layer subtrees are forbidden.** A child's `layer` must equal its parent container's `layer`. Enforced at `add`/`move`/`setLayer` time with explicit throws.
- **`setLayer` cascades over containers.** Calling `setLayer(node, layer)` on a container rewrites every descendant's layer atomically (single history entry, single notify). Calling it on a leaf with a parent on a different layer still throws — there's no way to satisfy the constraint without moving the parent. The strict "reject only" alternative is unworkable because no order of per-node `setLayer` calls satisfies the constraint during a subtree relayer.
- **No transform on groups.** Poses stay world-space; `transform?: Mat3` on `GroupDrawCommand` is left undefined by Phase 1's wrapper groups. Local-space children would be a substantial future redesign and aren't on the roadmap.
- **The `drawOne` signature is unchanged.** Consumers write `(node, pose, view) => DrawCommand[]` exactly as today. Hierarchy is internal to Canvas's scene-layer builder.

## Architecture

### New module: `src/canvas/buildSceneTree.ts`

Pure function:

```ts
export function buildSceneTree<TNode extends { id: string; kind?: 'leaf' | 'container'; layer?: string }, TPose>(
  adapter: HierarchicalRenderAdapter<TNode, string> & {
    getPose(id: string): TPose;
    getChildren(parentId: string | null): readonly string[];
  },
  drawOne: (obj: TNode, pose: TPose, view: View) => DrawCommand[],
  view: View,
): DrawCommand[];
```

Operates on the adapter, not the Scene directly — keeps `buildSceneTree` decoupled from `core/scene` so future adapter implementations (not just `sceneToAdapter`) can opt in.

Returns one root `GroupDrawCommand` per visible layer, in layer order. Each layer's group recursively walks the subtrees rooted at that layer's top-level nodes.

**Algorithm:**

```
for each layer in adapter.getLayers(), in order:
  if not layer.visible: skip
  layerGroup = { kind: 'group', children: [] }
  for each rootId in adapter.getChildren(null):
    rootNode = adapter.getNode(rootId)
    if rootNode.layer !== layer.id: skip
    layerGroup.children.push(buildNodeGroup(rootId))
  output.push(layerGroup)

buildNodeGroup(id):
  node = adapter.getNode(id)
  pose = adapter.getPose(id)
  self = drawOne(node, pose, view)
  children = adapter.getChildren(id).map(buildNodeGroup)
  return { kind: 'group', children: [...self, ...children] }
```

A leaf with no children still gets a wrapper group containing only its own draw commands. The wrapper is structural — it exists so Phase 2 can attach a clip path or other per-node effects without restructuring.

### Modified: `src/core/adapters/types.ts` — new optional surface

Today's adapter exposes `getNode`, `getNodes`, `getPose`, `getChildren(parentId | null)`. For hierarchical rendering we need two more — both optional, so hand-rolled adapters keep working:

```ts
interface HierarchicalRenderAdapter<TNode, TLayer extends string> {
  /** Visible layers in render order. When absent, hierarchical render
   *  falls back to a single implicit layer. */
  getLayers?(): readonly { id: TLayer; visible: boolean }[];
  /** The node, including its `kind` and `layer`. Used by `buildSceneTree`
   *  to know whether to recurse (`kind === 'container'`) and which layer
   *  group to place the wrapper in. */
  getNode?(id: string): TNode | undefined;
}
```

`getNode` already exists on `sceneToAdapter`; `getLayers` is added there. Both are additive.

### Modified: `src/canvas/Canvas.tsx`

`buildSceneLayer` gets a capability check. If the adapter exposes `getLayers` + `getNode` + `getChildren`, use `buildSceneTree`. Otherwise, fall back to today's flat loop.

Consumers with hand-rolled adapters (`arrayAdapter`, etc.) lack `getLayers` and hit the flat path — no behavior change for them.

### Modified: `src/core/scene/scene.ts`

Three mutation paths gain the cross-layer-subtree check:

- **`add(spec)`** — when `spec.parent != null`, require `scene.get(spec.parent).layer === spec.layer`.
- **`move(id, parent)`** — when `parent != null`, require `scene.get(id).layer === scene.get(parent).layer`. The moved node's descendants are already same-layer by induction.
- **`setLayer(id, layer)`** — if the node has a parent on a different layer, throw. Otherwise, write the new layer on the node and cascade through every descendant in one history entry (the operation is recorded as a single `kit:setLayer-subtree` with a list of (id, fromLayer) pairs for inversion).

Error format:

```
Scene: cannot place node 'X' on layer 'fg' under parent 'Y' on layer 'bg' —
subtree layer must match parent
```

No silent fallback. No warning-then-permit mode.

## Data flow

```
SceneCanvas → sceneToAdapter(scene) → Canvas
                                       │
                                       ▼
                          buildSceneLayer(cfg, adapter, ...)
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
            scene-backed adapter            hand-rolled adapter
                          │                         │
                          ▼                         ▼
              buildSceneTree(adapter, ...)    flat loop (today)
                          │                         │
                          ▼                         ▼
        nested GroupDrawCommand tree         flat DrawCommand[]
                          │                         │
                          └────────────┬────────────┘
                                       ▼
                              renderer (unchanged)
```

The renderer (WebGL `drawGroup`) already handles nested groups via its state stack. No changes there for Phase 1. Phase 2 will add the stencil-clip path inside `drawGroup`.

## Impact on existing code

- **Demos with containers but no children** (`SceneDemo.tsx` — `planter-1` only): no change.
- **Demos with containers + same-layer children** (`LayoutDemo.tsx`): no change. Visual output identical.
- **Flat scenes (everything else)**: no change. Same wrapper-group-per-leaf shape; renderer flattens it during draw.
- **`scene.test.ts`**: tests that exercise cross-layer subtrees must be updated. Either dropped (the scenarios become invalid) or rewritten as "rejection" tests asserting the new throw.
- **External consumers**: any code creating cross-layer subtrees throws on `add`/`move`/`setLayer` at runtime with an explicit message. No silent corruption.
- **`renderOrder()` itself is unchanged.** It stays layer-major and continues to drive selection / hit-test code paths that read it directly. Only Canvas's scene-layer builder uses the new hierarchical traversal.

## Components

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `buildSceneTree` | Walk adapter tree, produce nested DrawCommand groups | `HierarchicalRenderAdapter` (`getLayers`, `getNode`, `getChildren`, `getPose`), consumer's `drawOne`, current `View` |
| `Canvas.buildSceneLayer` | Choose hierarchical vs flat path based on adapter shape | `buildSceneTree`, today's flat loop |
| `Scene` mutation validation | Reject cross-layer subtree creation; cascade `setLayer` over containers | Scene's internal node map + layer lookup |

Each unit is independently testable: `buildSceneTree` is a pure function over the adapter surface; the validation is a set of guard clauses with explicit throw paths plus one cascade implementation; the Canvas wiring is a capability switch.

## Testing

### `src/canvas/buildSceneTree.test.ts` (new)

- Flat scene (no containers) → one root group per layer, leaf groups inside, z-order matches `renderOrder()`.
- Single container, two same-layer children → `{ group: [container_self, child1_group, child2_group] }`.
- Nested containers (3 levels) → matching nested group tree.
- Hidden layer → that layer's group is omitted.
- Empty `drawOne` for a node → empty wrapper group still emitted (stable tree shape).
- Node with no `drawOne` output AND no children → empty group (don't prune in v1).
- Multiple top-level roots on the same layer → all wrapped in the same layer-group.
- Multiple layers → multiple layer-groups in layer order.

### `src/core/scene/scene.test.ts` (additions)

- `add({ parent: container, layer: otherLayer })` throws with the expected message.
- `add` with same-layer parent succeeds (regression test for the positive path).
- `move(node, container)` with mismatched layers throws.
- `move(node, null)` (unparent) is always allowed — no parent means no constraint.
- `setLayer(node)` where node has a parent on a different layer throws.
- `setLayer(container)` cascades through every descendant; all descendants end up on the new layer.
- `setLayer(container)` records as a single history entry — `scene.undo()` restores every node to its original layer.
- `setLayer(leaf)` with no parent succeeds.

### `src/canvas/Canvas.test.tsx` (additions)

- A scene with one container + two children produces a `DrawCommand[]` tree with the expected nested-group shape.
- `LayoutDemo` and `SceneDemo` produce identical commands before and after the switch (regression — snapshot the command tree).
- Flat scene (arrayAdapter, no children) hits the flat fallback and produces the same commands as today.

### Not in Phase 1's test scope

- Performance benchmarks (not a regression risk at current demo sizes).
- Visual snapshots — current visual-regression rig covers the existing demos; if those pass, hierarchical rendering produces equivalent pixels.
- Clip behavior — Phase 2.
- Hit-test changes — Phase 2.

## Release notes (one-liner)

> Scene-layer rendering is now hierarchical: container nodes wrap their children in nested `GroupDrawCommand`s. Cross-layer subtrees are forbidden — a child's `layer` must equal its parent container's `layer`. Mutation paths (`add`, `move`, `setLayer`) throw with an explicit message on violations. Visual output is unchanged for all current demos.
