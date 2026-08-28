# Derived Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a scene node's *path geometry* be computed from other nodes' poses, so an edge can be a real scene node without its path becoming undo noise.

**Architecture:** A node declares `dependsOn: NodeId[]` and a `derive` function resolved by key through `SceneRegistry`, mirroring how `clipFromPose` already works. The scene keeps a reverse index (dependency → dependents) and invalidates dependents' memo slots at the two places a pose changes: the `kit:setPose` op and the pose-override invalidation chokepoint. The scene walk resolves each derived path before painting and hands it to the painter through `NodePaintCtx`, which already exists for exactly this purpose (`resolveImage`). Deleting a node removes its dependents in the same undo entry.

**Tech Stack:** TypeScript, React, vitest. Tests run `npx vitest run --project=kit` from the repo root; typecheck is `npx tsc --noEmit` from the repo root.

---

## Scope correction against the spec

`docs/superpowers/specs/2026-08-28-diagram-plugin-design.md` names the group-bounds defect
(`packages/core/src/interactions/actions/defaults/group.ts:68`) as arc 1's first consumer. Mapping the
code shows that is **wrong, and the spec needs a one-line fix**: a group's stale bounds are a derived
**pose**, while an edge is a derived **path**. They are adjacent seams, not the same one.

A derived pose is also strictly more invasive — pose feeds bounds, which feeds hit-testing, selection
chrome, snapping and layout, so a pose changing inside the frame touches far more than painting does.

**This plan ships the derived-path seam only** — the necessary case, the one the edge requires. Derived
pose, and therefore the group-bounds fix, becomes its own arc after this one is proven. Task 6 records
the correction in the spec so the next reader is not misled.

## Deferred, deliberately

`dependsOn` is fixed when the node is added. Retargeting an edge to a different endpoint is remove +
add for now; the connect gesture (spec arc 5) is what will need a `setDependsOn` op, and it should be
designed alongside the interaction rather than guessed at here.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/core/scene/types.ts` | `dependsOn` / `derive` on `NodeBase`, `AddNodeSpec`, `SerializedNode.deriveKey`, `SceneRegistry.derive` |
| `packages/core/src/core/scene/dependents.ts` | **new** — the reverse index: dependency → dependents, with transitive walk |
| `packages/core/src/core/scene/dependents.test.ts` | **new** — unit tests for the index in isolation |
| `packages/core/src/core/scene/poseOverrides.ts` | Extend `createPoseOverrides` to invalidate dependents |
| `packages/core/src/core/scene/scene.ts` | Maintain the index on add/remove; invalidate on `kit:setPose`; cascade delete |
| `packages/core/src/core/scene/scene.derived.test.ts` | **new** — the guard tests |
| `packages/core/src/canvas/NodeShape.ts` | `NodePaintCtx.derivedPath` |
| `packages/core/src/canvas/derivedPath.ts` | **new** — resolve + memoize a node's derived path |
| `packages/core/src/canvas/derivedPath.test.ts` | **new** — memo correctness, including the stale-memo guard |

---

## Task 1: The dependents index

**Files:**
- Create: `packages/core/src/core/scene/dependents.ts`
- Test: `packages/core/src/core/scene/dependents.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createDependentsIndex } from './dependents';
import { asNodeId } from './types';

const a = asNodeId('a'), b = asNodeId('b'), c = asNodeId('c');

describe('createDependentsIndex', () => {
  it('records dependents and returns them for each dependency', () => {
    const idx = createDependentsIndex();
    idx.add(c, [a, b]);
    expect([...idx.dependentsOf(a)]).toEqual([c]);
    expect([...idx.dependentsOf(b)]).toEqual([c]);
    expect([...idx.dependentsOf(c)]).toEqual([]);
  });

  it('removes a node from every dependency it registered against', () => {
    const idx = createDependentsIndex();
    idx.add(c, [a, b]);
    idx.remove(c);
    expect([...idx.dependentsOf(a)]).toEqual([]);
    expect([...idx.dependentsOf(b)]).toEqual([]);
  });

  it('walks transitively — a label depending on an edge depending on a node', () => {
    const idx = createDependentsIndex();
    idx.add(b, [a]);   // edge b depends on node a
    idx.add(c, [b]);   // label c depends on edge b
    expect([...idx.transitiveDependentsOf(a)].sort()).toEqual([b, c]);
  });

  it('terminates on a dependency cycle rather than looping forever', () => {
    const idx = createDependentsIndex();
    idx.add(b, [a]);
    idx.add(a, [b]);
    expect([...idx.transitiveDependentsOf(a)].sort()).toEqual([a, b]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit dependents.test.ts`
Expected: FAIL — `Failed to resolve import "./dependents"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/core/scene/dependents.ts`:

```ts
/**
 * Reverse index for derived geometry: which nodes must recompute when a given
 * node's pose changes. Maintained by the scene on add and remove.
 */
import type { NodeId } from './types';

export interface DependentsIndex {
  /** Record that `id` derives from each of `deps`. */
  add(id: NodeId, deps: readonly NodeId[]): void;
  /** Forget `id` entirely — both as a dependent and as a dependency. */
  remove(id: NodeId): void;
  /** Nodes that derive directly from `id`. */
  dependentsOf(id: NodeId): Iterable<NodeId>;
  /** Nodes that derive from `id` directly or through a chain. Excludes `id`
   *  itself unless a cycle leads back to it. */
  transitiveDependentsOf(id: NodeId): Iterable<NodeId>;
}

const EMPTY: readonly NodeId[] = [];

export function createDependentsIndex(): DependentsIndex {
  /** dependency -> nodes deriving from it */
  const forward = new Map<NodeId, Set<NodeId>>();
  /** dependent -> the dependencies it registered against */
  const reverse = new Map<NodeId, readonly NodeId[]>();

  return {
    add(id, deps) {
      if (deps.length === 0) return;
      reverse.set(id, [...deps]);
      for (const dep of deps) {
        let set = forward.get(dep);
        if (set === undefined) { set = new Set(); forward.set(dep, set); }
        set.add(id);
      }
    },

    remove(id) {
      const deps = reverse.get(id);
      if (deps !== undefined) {
        for (const dep of deps) {
          const set = forward.get(dep);
          if (set === undefined) continue;
          set.delete(id);
          if (set.size === 0) forward.delete(dep);
        }
        reverse.delete(id);
      }
      forward.delete(id);
    },

    dependentsOf(id) {
      return forward.get(id) ?? EMPTY;
    },

    transitiveDependentsOf(id) {
      const out = new Set<NodeId>();
      const queue: NodeId[] = [...(forward.get(id) ?? EMPTY)];
      while (queue.length > 0) {
        const next = queue.pop()!;
        if (out.has(next)) continue;   // also what stops a cycle
        out.add(next);
        for (const d of forward.get(next) ?? EMPTY) queue.push(d);
      }
      return out;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit dependents.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/scene/dependents.ts packages/core/src/core/scene/dependents.test.ts
git commit -m "add the dependents index for derived geometry"
```

---

## Task 2: Node types and registry serialization

**Files:**
- Modify: `packages/core/src/core/scene/types.ts`
- Modify: `packages/core/src/core/scene/scene.ts`
- Test: `packages/core/src/core/scene/scene.derived.test.ts` (create)

`clipFromPose` is the precedent to mirror, and it threads through **six** sites in `scene.ts`.
Miss one and the failure is silent — most often on redo, where `kit:add` replays without the
original spec. Find each by grepping `clipFromPose` and `clipKey`, and mirror it:

| # | Site | What it does |
|---|---|---|
| 1 | `reverseClipFromPose` (~line 57) | function → key map, built from the registry at scene construction |
| 2 | `add()` (~line 782) | looks the key up in that reverse map and puts `clipKey` on the `kit:add` payload |
| 3 | `patchClipFromPose` (~line 317) | attaches the function to the live node **and caches it in `pendingClipPatches` for redo** |
| 4 | `kit:add` apply (~line 350) | restores from the redo cache, else resolves `clipKey` through the registry, else `dwarn`s |
| 5 | `toJSON()` (~line 1140) | emits `clipFromPoseKey`, **throwing** if the function has no registry key |
| 6 | `specsFromSerialized` (~line 1271) | resolves the key back to a function; shared by `sceneFromJSON` and `loadState`, so both are covered at once |

**One difference from `clipFromPose`:** it is container-only and guarded by
`spec.kind === 'container'` at every site. `dependsOn` / `derive` apply to **every** node kind,
so those guards must not be copied across.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/core/scene/scene.derived.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { asNodeId, type RectPose } from './types';
import { linePath } from 'features/paths';

const LAYERS = [{ id: 'main' as const }];

/** A derive that draws a line between the centers of its two dependencies. */
const connectCenters = (_node: unknown, deps: readonly (RectPose | undefined)[]) => {
  const [from, to] = deps;
  if (!from || !to) return null;
  return linePath(
    from.x + from.width / 2, from.y + from.height / 2,
    to.x + to.width / 2, to.y + to.height / 2,
  );
};

const registry = { derive: { 'test:connect': connectCenters } };

describe('derived geometry — serialization', () => {
  it('round-trips dependsOn and the derive registry key', () => {
    const scene = createScene<{}, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });

    const json = scene.toJSON();
    const node = json.nodes.find((n) => n.id === edge)!;
    expect(node.dependsOn).toEqual([a, b]);
    expect(node.deriveKey).toBe('test:connect');

    // sceneFromJSON reads systemLayers out of the JSON — it takes no such option.
    const restored = sceneFromJSON(json, { registry });
    const live = restored.get(asNodeId(edge))!;
    expect(live.dependsOn).toEqual([a, b]);
    expect(live.derive).toBe(connectCenters);
  });

  it('a node with no dependsOn serializes without the fields', () => {
    const scene = createScene<{}, 'main', RectPose>({ systemLayers: LAYERS, registry });
    scene.add({ layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const json = scene.toJSON();
    expect(json.nodes[0]!.dependsOn).toBeUndefined();
    expect(json.nodes[0]!.deriveKey).toBeUndefined();
  });

  it('keeps derive attached across undo then redo', () => {
    const scene = createScene<{}, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });
    scene.undo();
    scene.redo();
    // kit:add replays without the spec — without a redo cache this is undefined.
    expect(scene.get(asNodeId(edge))!.derive).toBe(connectCenters);
  });

  it('throws from toJSON when derive is not in the registry', () => {
    const scene = createScene<{}, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    scene.add({
      layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a], derive: () => null,   // never registered
    });
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit scene.derived.test.ts`
Expected: FAIL — TypeScript rejects `dependsOn` / `derive` on `AddNodeSpec`.

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/core/scene/types.ts`, add to `interface NodeBase`:

```ts
  /** Nodes whose poses this node's geometry is computed from. Fixed at add
   *  time. Absent or empty means the node's geometry is authored, which is the
   *  normal case. */
  dependsOn?: readonly NodeId[];
  /** Computes this node's path from its dependencies' poses, in `dependsOn`
   *  order. A dependency that has been removed arrives as `undefined`.
   *  Returning `null` means "nothing to draw right now". Re-evaluated when a
   *  dependency's pose changes, never authored. */
  derive?: (
    node: Node<TData, TLayer, TPose>,
    deps: readonly (TPose | undefined)[],
  ) => Path | null;
```

Add both to `AddNodeSpec` too (taking the live function, exactly as `clipFromPose` does — the
key is looked up from it, not passed). Then `SerializedNode`:

```ts
  /** Ids this node's geometry derives from. Omitted when it derives from nothing. */
  dependsOn?: readonly string[];
  /** Registry key for the node's `derive` function. Omitted when it has none. */
  deriveKey?: string;
```

And `SceneRegistry`:

```ts
  /** Maps registry keys to `derive` functions for nodes with `dependsOn`. */
  derive?: Readonly<Record<string, (
    node: never,
    deps: readonly (TPose | undefined)[],
  ) => Path | null>>;
```

Then work the six sites in the table above. `dependsOn` is a plain array of ids and travels
through the `kit:add` payload as ordinary serializable data — only `derive` needs the
key/reverse-map/redo-cache treatment.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit scene.derived.test.ts`
Expected: PASS, 4 tests.

Run the existing scene suite for regressions: `npx vitest run --project=kit core/scene`
Expected: PASS.

Then `npx tsc --noEmit` from the worktree root. Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/scene/types.ts packages/core/src/core/scene/scene.ts packages/core/src/core/scene/scene.derived.test.ts
git commit -m "carry dependsOn and a derive registry key through the scene"
```

---

## Task 3: Maintain the index, and invalidate on pose change

This is where the arc's real bug lives. A pose changes two ways, and only one of them replaces
the pose reference. **A drag uses the other one.**

**Files:**
- Modify: `packages/core/src/core/scene/scene.ts`
- Modify: `packages/core/src/core/scene/poseOverrides.ts`
- Test: `packages/core/src/core/scene/scene.derived.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `scene.derived.test.ts`:

```ts
import { dropPoseKeyedMemoSlots, nodeMemo } from './nodeMemo';

describe('derived geometry — invalidation', () => {
  function setup() {
    const scene = createScene<{}, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });
    return { scene, a, b, edge };
  }

  /** Memoize a counter against the edge the way the paint path will, so a
   *  surviving cache entry is observable as a call that did not happen. */
  function derivedCount(scene: ReturnType<typeof setup>['scene'], id: string, counter: { n: number }) {
    const node = scene.get(asNodeId(id))!;
    return nodeMemo(node, 'test:derived', node.pose, () => { counter.n++; return counter.n; });
  }

  it('drops the dependent memo when a dependency pose is set', () => {
    const { scene, a, edge } = setup();
    const counter = { n: 0 };
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);           // cached, as it should be

    scene.setPose(asNodeId(a), { x: 50, y: 0, width: 10, height: 10 });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);           // dependency moved -> recomputed
  });

  it('drops the dependent memo when a dependency pose OVERRIDE commits', () => {
    const { scene, a, edge } = setup();
    const counter = { n: 0 };
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    // This is what a drag does: mutate one buffer in place, then commit.
    // The pose REFERENCE never changes, so a reference-keyed memo cannot see it.
    scene.overrides.set(asNodeId(a), { pose: { x: 50, y: 0, width: 10, height: 10 } });
    scene.overrides.commit();

    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });

  it('invalidates transitively — a label on an edge on a node', () => {
    const { scene, a, edge } = setup();
    const label = scene.add({
      layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [asNodeId(edge)], derive: connectCenters,
    });
    const counter = { n: 0 };
    derivedCount(scene, label, counter);
    expect(counter.n).toBe(1);

    scene.setPose(asNodeId(a), { x: 50, y: 0, width: 10, height: 10 });
    derivedCount(scene, label, counter);
    expect(counter.n).toBe(2);
  });

  it('undo of a dependency move also invalidates dependents', () => {
    const { scene, a, edge } = setup();
    const counter = { n: 0 };
    scene.setPose(asNodeId(a), { x: 50, y: 0, width: 10, height: 10 });
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(1);

    scene.undo();
    derivedCount(scene, edge, counter);
    expect(counter.n).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit scene.derived.test.ts -t invalidation`
Expected: FAIL on all four — the counter stays at 1 because nothing drops the dependent's slot.

Note which ones fail and how. The override case is the one that will still be failing after a
naive fix, and it is the one that matters: it is what a drag does.

- [ ] **Step 3: Write minimal implementation**

In `scene.ts`, next to the existing state, add the index and one invalidation helper:

```ts
import { createDependentsIndex } from './dependents';
import { dropPoseKeyedMemoSlots } from './nodeMemo';

const dependents = createDependentsIndex();

/** Drop the memoized derivation of everything downstream of `id`. */
function invalidateDependents(id: NodeId): void {
  for (const dep of dependents.transitiveDependentsOf(id)) {
    const node = state.nodes.get(dep);
    if (node !== undefined) dropPoseKeyedMemoSlots(node);
  }
}
```

Register in the index when a node is added (inside the same place `patchDerive` runs), and
call `dependents.remove(id)` for every id removed in `remove()`.

Extend the `kit:setPose` op so **both halves** invalidate — undo moves a node just as much as
a drag does:

```ts
  registerKitOp<{ id: NodeId; from: TPose; to: TPose }>('kit:setPose', {
    apply: (p) => {
      (requireNode(p.id) as { pose: TPose }).pose = p.to;
      invalidateDependents(p.id);
    },
    revert: (p) => {
      (requireNode(p.id) as { pose: TPose }).pose = p.from;
      invalidateDependents(p.id);
    },
  });
```

Then the override path. `createPoseOverrides` currently takes only a node lookup; give it a
second argument so its existing per-id invalidation chokepoint reaches dependents too. In
`poseOverrides.ts`:

```ts
export function createPoseOverrides<TPose>(
  lookup: (id: NodeId) => { data?: unknown } | undefined,
  onInvalidate?: (id: NodeId) => void,
) {
```

and inside its `invalidate`, after the existing `dropPoseKeyedMemoSlots` call:

```ts
    onInvalidate?.(id);
```

Then in `scene.ts` at line ~149:

```ts
const overrides = createPoseOverrides<TPose>(
  (id) => state.nodes.get(id),
  (id) => invalidateDependents(id),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit scene.derived.test.ts`
Expected: PASS, 6 tests.

Run the whole scene suite for regressions: `npx vitest run --project=kit core/scene`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/scene/scene.ts packages/core/src/core/scene/poseOverrides.ts packages/core/src/core/scene/scene.derived.test.ts
git commit -m "invalidate derived nodes when a dependency pose changes"
```

---

## Task 4: Resolve the path and hand it to the painter

**Files:**
- Create: `packages/core/src/canvas/derivedPath.ts`
- Create: `packages/core/src/canvas/derivedPath.test.ts`
- Modify: `packages/core/src/canvas/NodeShape.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/derivedPath.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { resolveDerivedPath } from './derivedPath';
import { asNodeId, type RectPose } from 'core/scene/types';
import { linePath } from 'features/paths';

const pose = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });

function makeNode(derive: ReturnType<typeof vi.fn>) {
  return {
    id: asNodeId('edge'), kind: 'leaf' as const, layer: 'main', data: {},
    parent: null, pose: pose(0),
    dependsOn: [asNodeId('a'), asNodeId('b')],
    derive,
  };
}

describe('resolveDerivedPath', () => {
  it('returns null for a node that derives from nothing', () => {
    const plain = { id: asNodeId('n'), kind: 'leaf' as const, layer: 'main', data: {}, parent: null, pose: pose(0) };
    expect(resolveDerivedPath(plain as never, () => undefined)).toBeNull();
  });

  it('calls derive with dependency poses in dependsOn order', () => {
    const derive = vi.fn(() => linePath(0, 0, 1, 1));
    const node = makeNode(derive);
    const poses = new Map([[asNodeId('a'), pose(0)], [asNodeId('b'), pose(100)]]);
    resolveDerivedPath(node as never, (id) => poses.get(id));
    expect(derive).toHaveBeenCalledWith(node, [pose(0), pose(100)]);
  });

  it('passes undefined for a dependency that no longer resolves', () => {
    const derive = vi.fn(() => null);
    const node = makeNode(derive);
    const poses = new Map([[asNodeId('a'), pose(0)]]);
    resolveDerivedPath(node as never, (id) => poses.get(id));
    expect(derive).toHaveBeenCalledWith(node, [pose(0), undefined]);
  });

  it('memoizes — a second call with unchanged poses does not re-derive', () => {
    const derive = vi.fn(() => linePath(0, 0, 1, 1));
    const node = makeNode(derive);
    const poses = new Map([[asNodeId('a'), pose(0)], [asNodeId('b'), pose(100)]]);
    const lookup = (id: ReturnType<typeof asNodeId>) => poses.get(id);
    resolveDerivedPath(node as never, lookup);
    resolveDerivedPath(node as never, lookup);
    expect(derive).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit derivedPath.test.ts`
Expected: FAIL — `Failed to resolve import "./derivedPath"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/canvas/derivedPath.ts`:

```ts
/**
 * Resolve a node's derived path.
 *
 * The memo slot is keyed on the node's own pose, which is what
 * `dropPoseKeyedMemoSlots` clears — that is the contract the scene's
 * `invalidateDependents` relies on. Nothing here watches dependency poses; the
 * scene pushes invalidation instead, because a pose override mutates its buffer
 * in place and no reference comparison could see it.
 */
import type { Node } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { Path } from 'core/geometry/path';
import { nodeMemo } from 'core/scene/nodeMemo';

const SLOT = 'kit:derivedPath';

export function resolveDerivedPath<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  poseOf: (id: NodeId) => TPose | undefined,
): Path | null {
  const deps = node.dependsOn;
  if (deps === undefined || deps.length === 0 || node.derive === undefined) return null;
  return nodeMemo(node, SLOT, node.pose, () =>
    node.derive!(node, deps.map((id) => poseOf(id))),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit derivedPath.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add `derivedPath` to the paint context**

In `packages/core/src/canvas/NodeShape.ts`, extend `NodePaintCtx`:

```ts
  /** The node's derived path, resolved by the scene walk before painting.
   *  Present only for nodes with `dependsOn`; a painter for authored geometry
   *  never sees it. Supplied here rather than computed by the painter because
   *  `paint` has no scene handle and deriving needs other nodes' poses. */
  derivedPath?: Path | null;
```

Then in the scene walk (`buildSceneLayer` and `buildSceneViewCommands`), call
`resolveDerivedPath` for each node and pass the result through in the `NodePaintCtx` handed to
`drawOne`.

- [ ] **Step 6: Run the full canvas suite**

Run: `npx vitest run --project=kit canvas`
Expected: PASS, no regressions.

Then `npx tsc --noEmit` from the repo root. Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/canvas/derivedPath.ts packages/core/src/canvas/derivedPath.test.ts packages/core/src/canvas/NodeShape.ts
git commit -m "resolve derived paths in the scene walk and pass them to painters"
```

---

## Task 5: Cascade delete

Deleting a node must take its dependents with it, in one undo entry — otherwise an edge
survives with a dangling endpoint, and undo restores the two halves separately.

**Files:**
- Modify: `packages/core/src/core/scene/scene.ts` (`remove`, ~line 796)
- Test: `packages/core/src/core/scene/scene.derived.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `scene.derived.test.ts`:

```ts
describe('derived geometry — cascade delete', () => {
  function setup() {
    const scene = createScene<{}, 'main', RectPose>({ systemLayers: LAYERS, registry });
    const a = scene.add({ layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
    const b = scene.add({ layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: {} });
    const edge = scene.add({
      layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [a, b], derive: connectCenters,
    });
    return { scene, a, b, edge };
  }

  it('removes dependents along with the node they depend on', () => {
    const { scene, a, b, edge } = setup();
    scene.remove(asNodeId(a));
    expect(scene.get(asNodeId(a))).toBeUndefined();
    expect(scene.get(asNodeId(edge))).toBeUndefined();
    expect(scene.get(asNodeId(b))).toBeDefined();
  });

  it('is a single undo entry — one undo restores both', () => {
    const { scene, a, edge } = setup();
    scene.remove(asNodeId(a));
    scene.undo();
    expect(scene.get(asNodeId(a))).toBeDefined();
    expect(scene.get(asNodeId(edge))).toBeDefined();
  });

  it('cascades transitively to a label on the edge', () => {
    const { scene, a, edge } = setup();
    const label = scene.add({
      layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {},
      dependsOn: [asNodeId(edge)], derive: connectCenters,
    });
    scene.remove(asNodeId(a));
    expect(scene.get(asNodeId(label))).toBeUndefined();
  });

  it('restores a cascaded node with its dependsOn and derive intact', () => {
    const { scene, a, edge } = setup();
    scene.remove(asNodeId(a));
    scene.undo();
    const live = scene.get(asNodeId(edge))!;
    expect(live.dependsOn).toHaveLength(2);
    expect(live.derive).toBe(connectCenters);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit scene.derived.test.ts -t cascade`
Expected: FAIL — the edge survives with a dangling `dependsOn`.

- [ ] **Step 3: Write minimal implementation**

In `remove()`, widen the id set before snapshotting. It currently collects the root and its
descendants; it must also collect dependents, and each dependent's own descendants:

```ts
    remove(id) {
      const node = requireNode(id);
      const sibs = siblingsOf(node.parent);
      const index = sibs.indexOf(id);

      // Root + descendants, then everything deriving from any of them, then
      // those nodes' descendants. A dependent is NOT a descendant, so this is a
      // second reachability pass, not a deeper walk of the first.
      const ids: NodeId[] = [id];
      descendants(id, ids);
      const seen = new Set<NodeId>(ids);
      for (let i = 0; i < ids.length; i++) {
        for (const dep of dependents.transitiveDependentsOf(ids[i]!)) {
          if (seen.has(dep) || state.nodes.get(dep) === undefined) continue;
          seen.add(dep);
          ids.push(dep);
          const sub: NodeId[] = [];
          descendants(dep, sub);
          for (const s of sub) if (!seen.has(s)) { seen.add(s); ids.push(s); }
        }
      }

      const snapshot: Node<TData, TLayer, TPose>[] = ids.map((nid) => {
        const n = requireNode(nid);
        return n.kind === 'container' ? { ...n, children: [...n.children] } : { ...n };
      });
      for (const nid of ids) { overrides.clear(nid); dependents.remove(nid); }
      executeAndLog('kit:remove', {
        rootId: id, parent: node.parent, index, nodes: snapshot,
      }, 'remove');
    },
```

`kit:remove`'s `apply` deletes every id in `p.nodes`, so widening the snapshot is what deletes
the dependents. Its `revert` already restores every node in the list — extend it to re-register
each restored node in the dependents index:

```ts
    revert: (p) => {
      for (const n of p.nodes) {
        const clone: Node<TData, TLayer, TPose> = n.kind === 'container'
          ? { ...n, children: [...n.children] }
          : { ...n };
        state.nodes.set(n.id, clone);
        if (clone.dependsOn !== undefined) dependents.add(clone.id, clone.dependsOn);
      }
      attach(p.rootId, p.parent, p.index);
    },
```

Note the snapshot carries the live `derive` function reference through, since it is a shallow
clone of the node — which is what the fourth test checks.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit scene.derived.test.ts`
Expected: PASS, 14 tests.

Run the full kit suite: `npx vitest run --project=kit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/scene/scene.ts packages/core/src/core/scene/scene.derived.test.ts
git commit -m "delete a node's dependents with it in one undo entry"
```

---

## Task 6: Document the seam and correct the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`
- Modify: `docs/extending.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Correct the spec's arc 1**

Replace the claim that the group-bounds defect is arc 1's first consumer. The group's stale
bounds are a derived **pose**; this arc ships derived **paths**. Change the "Core change 1"
section's last paragraph and arc 1's description to say so, and add a line to the arc list:

```markdown
1b. **Derived pose.** The same dependency machinery driving a node's pose rather than its path,
    which is what the group-bounds defect at `core/src/interactions/actions/defaults/group.ts:68`
    needs. Deferred behind arc 1 because pose feeds bounds, hit-testing, selection chrome and
    layout, so it reaches much further into the frame than painting does.
```

- [ ] **Step 2: Document the seam in `docs/extending.md`**

Add a section after "Non-rect poses" covering `dependsOn` / `derive` / `SceneRegistry.derive`,
following the shape of the sections around it: what it is, the minimal example, and the trap —
that invalidation is pushed by the scene rather than pulled by a reference comparison, because
pose overrides mutate in place.

- [ ] **Step 3: Add the follow-ups to `docs/TODO.md`**

```markdown
### Derived geometry follow-ups

- **(P2) Derived pose.** Arc 1b of `docs/superpowers/specs/2026-08-28-diagram-plugin-design.md`.
  Unblocks the group-bounds snapshot defect (`core/src/interactions/actions/defaults/group.ts:68`),
  where a container's union AABB is computed once at creation and never re-derived.
- **(P3) `setDependsOn` op.** `dependsOn` is fixed at add time; retargeting is remove + add.
  Design it with the connect gesture rather than ahead of it.
```

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run --project=kit && npx tsc --noEmit`
Expected: PASS, no errors.

```bash
git add docs/
git commit -m "document the derived-geometry seam and correct arc 1's scope"
```

---

## Self-review notes

**Spec coverage.** `dependsOn` + `derive` (Task 2), resolve pass ahead of paint (Task 4), memo
invalidation (Task 3), cascade delete (Task 5), `SceneRegistry` serialization (Task 2). The
group-bounds fix is **deliberately not covered** — Task 6 records why and moves it to arc 1b.

**Guard test.** The spec asks for a test that fails on a stale memo. That is Task 3's second
case, the pose-override one, and it is the case a naive reference-keyed implementation still
fails after the obvious fix passes. Do not skip watching it fail.

**Not verified by these tests.** That a derived path actually renders. The unit tests cover
resolution and invalidation, not pixels. A visual check belongs with the first real consumer,
in the diagram arcs.
