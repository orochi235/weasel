# Ephemeral Pose Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the scene a per-node pose/alpha override that the render and hit-test paths read through, which is never recorded in history, never serialized, and never bumps the scene version — so a 60 Hz loop can move nodes without filling the undo stack or re-rendering every subscriber.

**Architecture:** A `PoseOverrides<TPose>` map lives on `Scene` in a closure variable outside `state`, exactly where `selection` lives (`scene.ts:140-144`) and for the same reason: it is not document content. Writes never call `notify()`; overrides carry their own generation and subscription so a canvas can repaint without a scene version bump. The render path reads through at the single choke point it already has — `HierarchicalAdapter.getPose` (`buildSceneTree.ts:16`, read at `:69`) — implemented in the two adapter constructions (`sceneAdapter.ts:317-321` live, `sceneViewRender.ts:124` headless) so on-screen and headless agree. Because `useSelectTool`'s default `pickEvery` also reads `adapter.getPose` (`useSelectTool.ts:199, 211, 244`), hit-testing follows the override for free — a node you can see moved is a node you can click where you see it. The one trap: `nodeMemo` keys on pose *reference* (`nodeMemo.ts:95`), so a buffer mutated in place would serve a stale draw; `commit()` therefore drops the pose-keyed memo slots of every overridden node.

**Tech Stack:** TypeScript, React 19, vitest (`--project=kit` covers both `packages/core/src` and `apps/site`), changesets.

---

## Scope

**In:** the override map, its scene wiring, read-through on both render paths, memo invalidation, hit-test consistency, container-clip behavior, per-node `alpha`, the bake round-trip, barrel + docs, and `ForceGraphDemo` as the reference consumer.

**Out:** Part 1 of the spec (the rAF paint loop, `setView`/`subscribeView`) — a separate plan. Also out: repainting **detached** views (`SceneViewCanvas`, `MinimapCanvas`) from override writes. They re-render off `scene.getVersion()`, which overrides deliberately do not bump; wiring them to the override subscription would give them a React render per frame, which is the cost Part 1 exists to remove. They keep painting document poses until Part 1 lands.

---

## File Structure

**Created:**
- `packages/core/src/core/scene/poseOverrides.ts` — `createPoseOverrides`, the whole implementation. Free of scene internals: it takes a node resolver so it can invalidate the memo, and knows nothing else.
- `packages/core/src/core/scene/poseOverrides.test.ts` — unit tests for the map in isolation.
- `packages/core/src/core/scene/scene.overrides.test.ts` — the scene-level contract: no version bump, no history entry, absent from `toJSON`, cleared on `remove`. Named to match the existing `scene.selection.test.ts`.
- `packages/core/src/canvas/sceneAdapter.overrides.test.ts` — live-path read-through, hit-test consistency, container clips.
- `packages/core/src/canvas/sceneViewRender.overrides.test.ts` — headless read-through, alpha, and the in-place-mutation staleness test.
- `packages/core/src/canvas/SceneCanvas.overrides.test.tsx` — live repaint on commit, and the alpha composition.
- `apps/site/demos/forceGraph/overrides.ts` — the demo's sync/bake helpers, extracted so they are testable without rendering the demo. Matches the existing `apps/site/demos/platformer/*.ts` convention.
- `apps/site/demos/__tests__/forceGraphOverrides.test.ts` — drives those helpers.
- `.changeset/ephemeral-pose-overrides.md`

**Modified:**
- `packages/core/src/core/scene/nodeMemo.ts` — add `dropPoseKeyedMemoSlots`.
- `packages/core/src/core/scene/nodeMemo.test.ts` — cover it.
- `packages/core/src/core/scene/types.ts` — declare `PoseOverride` / `PoseOverrides`, add `Scene.overrides`.
- `packages/core/src/core/scene/scene.ts` — construct the map, expose it, clear on `remove`.
- `packages/core/src/core/scene/index.ts` — re-export.
- `packages/core/src/canvas/sceneAdapter.ts` — read-through in `getPose`.
- `packages/core/src/canvas/sceneViewRender.ts` — read-through in `sceneAsHierarchy`, alpha multiply in `buildSceneViewCommands`.
- `packages/core/src/canvas/SceneCanvas.tsx` — compose override alpha into `alphaFor`; subscribe overrides → `requestRedraw`.
- `packages/core/src/index.ts` — barrel.
- `packages/core/src/index.barrel.test.ts` — type-level reachability check.
- `apps/site/demos/ForceGraphDemo.tsx` — migrate the sim tick.
- `docs/concepts.md`, `docs/scene-serialization.md`.

**Where alpha is applied, so it is applied exactly once:** the override's `alpha` is multiplied in wherever the *scene* is in scope — inside `buildSceneViewCommands` on the headless path (it takes the scene), and inside `SceneCanvas`'s `alphaFor` composition on the live path (`Canvas` is scene-agnostic and must stay that way). These are disjoint paths, so nothing double-applies.

---

### Task 1: Per-node memo invalidation

`bumpNodeMemoGeneration()` (`nodeMemo.ts:123-125`) drops every slot on every node — using it per frame would throw away the painter match and silhouette of every *static* node in the scene. What an override needs is narrower: drop only the slots of the nodes it overrides, and only the slots whose key includes a pose. The painter match passes `pose: undefined` (`NodeShape.ts:193-195`) and is a registry scan; it must survive.

**Files:**
- Modify: `packages/core/src/core/scene/nodeMemo.ts`
- Test: `packages/core/src/core/scene/nodeMemo.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/core/scene/nodeMemo.test.ts`:

```ts
describe('dropPoseKeyedMemoSlots', () => {
  it('drops pose-keyed slots for one node and leaves other nodes alone', () => {
    const a = { data: { k: 1 } };
    const b = { data: { k: 2 } };
    const pose = { x: 0, y: 0 };
    let calls = 0;
    const derive = () => { calls++; return calls; };

    expect(nodeMemo(a, 'paint', pose, derive)).toBe(1);
    expect(nodeMemo(b, 'paint', pose, derive)).toBe(2);
    expect(nodeMemo(a, 'paint', pose, derive)).toBe(1); // cached

    dropPoseKeyedMemoSlots(a);

    expect(nodeMemo(a, 'paint', pose, derive)).toBe(3); // recomputed
    expect(nodeMemo(b, 'paint', pose, derive)).toBe(2); // untouched
  });

  it('keeps pose-independent slots (the painter match)', () => {
    const node = { data: { k: 1 } };
    let calls = 0;
    const derive = () => { calls++; return calls; };

    expect(nodeMemo(node, 'painter', undefined, derive)).toBe(1);
    dropPoseKeyedMemoSlots(node);
    expect(nodeMemo(node, 'painter', undefined, derive)).toBe(1); // still cached
  });

  it('is a no-op for a node that was never memoized', () => {
    expect(() => dropPoseKeyedMemoSlots({ data: {} })).not.toThrow();
  });
});
```

Update that file's import (`nodeMemo.test.ts:11`) to include the new symbol:

```ts
import { nodeMemo, bumpNodeMemoGeneration, dropPoseKeyedMemoSlots } from './nodeMemo';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/core/scene/nodeMemo.test.ts`
Expected: FAIL — `dropPoseKeyedMemoSlots is not a function` (or a TS resolution error on the import).

- [ ] **Step 3: Write the implementation**

Append to `packages/core/src/core/scene/nodeMemo.ts`:

```ts
/**
 * Drop the slots of `node` that were keyed on a pose, keeping the ones that
 * weren't (the painter match passes `undefined`, and re-matching it is a
 * registry scan).
 *
 * For per-frame pose overrides, which mutate one buffer in place rather than
 * replacing the reference: the `(pose, data)` key cannot see that, so the
 * override's `commit()` calls this for each node it holds.
 * {@link bumpNodeMemoGeneration} is the wrong tool there — it would drop every
 * static node's slots too, every frame.
 */
export function dropPoseKeyedMemoSlots(node: MemoizableNode): void {
  const record = MEMO.get(node);
  if (record === undefined) return;
  for (const [slot, entry] of record.slots) {
    if (entry.pose !== undefined) record.slots.delete(slot);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/core/scene/nodeMemo.test.ts`
Expected: PASS, including the pre-existing generation and ghost-pose tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/scene/nodeMemo.ts packages/core/src/core/scene/nodeMemo.test.ts
git commit -m "add per-node pose-keyed memo invalidation"
```

---

### Task 2: The `PoseOverrides` map

Standalone, with no scene dependency beyond a node resolver it is handed. Note `set` stores the caller's entry object **by reference** — that is the point: a frame loop hoists one entry per node, mutates `entry.pose` in place, and calls `commit()` once per frame, allocating nothing.

**Files:**
- Modify: `packages/core/src/core/scene/types.ts`
- Create: `packages/core/src/core/scene/poseOverrides.ts`
- Test: `packages/core/src/core/scene/poseOverrides.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/core/scene/poseOverrides.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createPoseOverrides } from './poseOverrides';
import { nodeMemo } from './nodeMemo';
import { asNodeId } from './types';

interface Pose { x: number; y: number }

const ID = asNodeId('n1');

function setup() {
  const node = { data: { label: 'n1' } };
  const overrides = createPoseOverrides<Pose>((id) => (id === ID ? node : undefined));
  return { node, overrides };
}

describe('createPoseOverrides', () => {
  it('stores the caller\'s entry by reference so it can be mutated in place', () => {
    const { overrides } = setup();
    const entry = { pose: { x: 1, y: 2 } };
    overrides.set(ID, entry);
    expect(overrides.get(ID)).toBe(entry);
    entry.pose.x = 99;
    expect(overrides.get(ID)!.pose!.x).toBe(99);
  });

  it('reports membership and ids', () => {
    const { overrides } = setup();
    expect(overrides.has(ID)).toBe(false);
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    expect(overrides.has(ID)).toBe(true);
    expect(overrides.ids()).toEqual([ID]);
  });

  it('clear removes one entry; clearAll removes all', () => {
    const { overrides } = setup();
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.clear(ID);
    expect(overrides.get(ID)).toBeUndefined();

    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.clearAll();
    expect(overrides.ids()).toEqual([]);
  });

  it('notifies subscribers on set, commit, clear and clearAll — and stops after unsubscribe', () => {
    const { overrides } = setup();
    const seen = vi.fn();
    const unsubscribe = overrides.subscribe(seen);

    overrides.set(ID, { pose: { x: 0, y: 0 } });
    expect(seen).toHaveBeenCalledTimes(1);
    overrides.commit();
    expect(seen).toHaveBeenCalledTimes(2);
    overrides.clear(ID);
    expect(seen).toHaveBeenCalledTimes(3);

    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.clearAll();
    expect(seen).toHaveBeenCalledTimes(5);

    unsubscribe();
    overrides.set(ID, { pose: { x: 1, y: 1 } });
    expect(seen).toHaveBeenCalledTimes(5);
  });

  it('does not notify when clear / clearAll change nothing', () => {
    const { overrides } = setup();
    const seen = vi.fn();
    overrides.subscribe(seen);
    overrides.clear(ID);
    overrides.clearAll();
    expect(seen).not.toHaveBeenCalled();
  });

  it('bumps the generation on every write', () => {
    const { overrides } = setup();
    const start = overrides.getGeneration();
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    overrides.commit();
    expect(overrides.getGeneration()).toBe(start + 2);
  });

  it('commit drops the pose-keyed memo slots of every overridden node', () => {
    const { node, overrides } = setup();
    const pose = { x: 0, y: 0 };
    let calls = 0;
    const derive = () => { calls++; return calls; };

    overrides.set(ID, { pose });
    expect(nodeMemo(node, 'paint', pose, derive)).toBe(1);
    expect(nodeMemo(node, 'paint', pose, derive)).toBe(1);

    pose.x = 50;            // mutated in place — same reference
    overrides.commit();

    expect(nodeMemo(node, 'paint', pose, derive)).toBe(2);
  });

  it('survives an id that no longer resolves to a node', () => {
    const overrides = createPoseOverrides<Pose>(() => undefined);
    overrides.set(ID, { pose: { x: 0, y: 0 } });
    expect(() => overrides.commit()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/core/scene/poseOverrides.test.ts`
Expected: FAIL — cannot resolve `./poseOverrides`.

- [ ] **Step 3: Declare the types**

In `packages/core/src/core/scene/types.ts`, add above the `Scene` interface (which starts at `types.ts:265`):

```ts
/**
 * One node's ephemeral presentation override — what a frame loop wants to say
 * about a node without saying it about the document.
 *
 * Not document content: never recorded in history, never in `toJSON`, and
 * writing one does not bump `Scene.getVersion()`. Hoist one entry per node and
 * mutate it in place on a frame loop; `PoseOverrides.commit()` is what makes a
 * mutation visible.
 */
export interface PoseOverride<TPose> {
  /** Replaces the node's document pose everywhere the render and hit-test
   *  paths read one, including the clip a container derives from its pose. */
  pose?: TPose;
  /** Multiplied into the node's painted alpha, on top of any `alphaFor`. */
  alpha?: number;
}

/**
 * The scene's ephemeral per-node overrides — see {@link PoseOverride}.
 *
 * The intended shape of a frame is: `set` each node once, mutate the entries
 * in place per frame, `commit()` once. `commit` is not optional bookkeeping —
 * the painter memo keys on pose *reference*, so a mutation without a commit
 * paints the previous frame with no error.
 *
 * To promote a frame to document state (dropping a drag, baking an animation),
 * write it once through `Scene.setPose` and `clear` the override.
 */
export interface PoseOverrides<TPose> {
  /** Store `entry` for `id` **by reference**; the caller keeps mutating it. */
  set(id: NodeId, entry: PoseOverride<TPose>): void;
  get(id: NodeId): PoseOverride<TPose> | undefined;
  has(id: NodeId): boolean;
  /** The overridden ids, as a snapshot array. */
  ids(): readonly NodeId[];
  clear(id: NodeId): void;
  clearAll(): void;
  /** Publish this frame's in-place mutations: invalidate the painter memo for
   *  every overridden node, then notify subscribers. */
  commit(): void;
  /** Notified after every write. The canvas uses this to repaint without a
   *  scene version bump. */
  subscribe(fn: () => void): () => void;
  /** Monotonic write counter. A snapshot for observers that poll. */
  getGeneration(): number;
}
```

- [ ] **Step 4: Write the implementation**

Create `packages/core/src/core/scene/poseOverrides.ts`:

```ts
import { dropPoseKeyedMemoSlots } from './nodeMemo';
import type { NodeId, PoseOverride, PoseOverrides } from './types';

/**
 * Build a {@link PoseOverrides} map.
 *
 * `getNode` resolves an id to the node object the painter memo is keyed on —
 * the only thing this module needs from the scene, and the reason it doesn't
 * import one.
 */
export function createPoseOverrides<TPose>(
  getNode: (id: NodeId) => { data?: unknown } | undefined,
): PoseOverrides<TPose> {
  const entries = new Map<NodeId, PoseOverride<TPose>>();
  const listeners = new Set<() => void>();
  let generation = 0;

  function invalidate(id: NodeId): void {
    const node = getNode(id);
    if (node) dropPoseKeyedMemoSlots(node);
  }

  function published(): void {
    generation++;
    for (const listener of listeners) listener();
  }

  return {
    set(id, entry) {
      entries.set(id, entry);
      invalidate(id);
      published();
    },
    get(id) {
      return entries.get(id);
    },
    has(id) {
      return entries.has(id);
    },
    ids() {
      return [...entries.keys()];
    },
    clear(id) {
      if (!entries.delete(id)) return;
      invalidate(id);
      published();
    },
    clearAll() {
      if (entries.size === 0) return;
      for (const id of entries.keys()) invalidate(id);
      entries.clear();
      published();
    },
    commit() {
      for (const id of entries.keys()) invalidate(id);
      published();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    getGeneration() {
      return generation;
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/core/scene/poseOverrides.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/core/scene/poseOverrides.ts packages/core/src/core/scene/poseOverrides.test.ts packages/core/src/core/scene/types.ts
git commit -m "add the ephemeral pose-override map"
```

---

### Task 3: Hang it on the scene

The contract this task pins: an override write is invisible to history, to `toJSON`, and to `getVersion()`. Those three assertions are the feature.

**Files:**
- Modify: `packages/core/src/core/scene/types.ts` (the `Scene` interface)
- Modify: `packages/core/src/core/scene/scene.ts:140-144` region, and the returned object
- Test: `packages/core/src/core/scene/scene.overrides.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/core/scene/scene.overrides.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createScene } from './scene';
import type { NodeId } from './types';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function makeScene() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id: NodeId = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
  return { scene, id };
}

describe('Scene.overrides', () => {
  it('does not bump the version or notify scene subscribers', () => {
    const { scene, id } = makeScene();
    const listener = vi.fn();
    scene.subscribe(listener);
    const version = scene.getVersion();

    scene.overrides.set(id, { pose: { x: 100, y: 100, width: 10, height: 10 } });
    scene.overrides.commit();

    expect(scene.getVersion()).toBe(version);
    expect(listener).not.toHaveBeenCalled();
  });

  it('records no history entry and leaves undo alone', () => {
    const { scene, id } = makeScene();
    const before = scene.historyEntries().length;

    for (let frame = 0; frame < 60; frame++) {
      scene.overrides.set(id, { pose: { x: frame, y: 0, width: 10, height: 10 } });
      scene.overrides.commit();
    }

    expect(scene.historyEntries()).toHaveLength(before);
    expect(scene.canUndo()).toBe(true); // the `add`, not the overrides
  });

  it('never reaches toJSON — the document pose is what serializes', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 777, y: 777, width: 10, height: 10 } });
    scene.overrides.commit();

    const json = scene.toJSON();
    expect(json.nodes[0].pose).toEqual(POSE);
    expect(JSON.stringify(json)).not.toContain('777');
  });

  it('leaves the node\'s document pose untouched', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 5, y: 5, width: 10, height: 10 } });
    expect(scene.get(id)!.pose).toEqual(POSE);
  });

  it('is not restored by loadState', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 5, y: 5, width: 10, height: 10 } });
    const snapshot = scene.toJSON();
    scene.overrides.clearAll();
    scene.loadState(snapshot);
    expect(scene.overrides.ids()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/core/scene/scene.overrides.test.ts`
Expected: FAIL — `scene.overrides` is undefined (`Cannot read properties of undefined (reading 'set')`).

- [ ] **Step 3: Add the member to the `Scene` interface**

In `packages/core/src/core/scene/types.ts`, immediately after the selection block (`getSelection` / `setSelection`, `types.ts:366-367`), add:

```ts
  // Ephemeral presentation state

  /** Per-node pose / alpha overrides the render and hit-test paths read
   *  through. Like {@link Scene.getSelection} this is not document content:
   *  writes are never recorded, never serialized, and do not bump
   *  {@link Scene.getVersion}. See {@link PoseOverrides}. */
  readonly overrides: PoseOverrides<TPose>;
```

- [ ] **Step 4: Construct it in `createScene`**

In `packages/core/src/core/scene/scene.ts`, add the import at the top of the file, beside the other `./` imports:

```ts
import { createPoseOverrides } from './poseOverrides';
```

Then, directly below the `selection` declaration (`scene.ts:140-144`), add:

```ts
  /** Ephemeral per-node overrides. Deliberately not part of `state`, for the
   *  same reason `selection` isn't: not document content, never reaches
   *  `toJSON`, and never touches history. */
  const overrides = createPoseOverrides<TPose>((id) => state.nodes.get(id));
```

Finally, expose it on the returned scene object. In the returned object literal, immediately before `getSelection() {`, add:

```ts
    overrides,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/core/scene/scene.overrides.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the scene suite for regressions**

Run: `npx vitest run --project=kit packages/core/src/core/scene/`
Expected: PASS — `scene.test.ts`, `scene.selection.test.ts`, `useScene.test.ts`, `nodeMemo.test.ts`, `renderOrder.test.ts` all green.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/core/scene/scene.ts packages/core/src/core/scene/types.ts packages/core/src/core/scene/scene.overrides.test.ts
git commit -m "expose ephemeral pose overrides on Scene"
```

---

### Task 4: Clear overrides for a removed subtree

Ids are strings. An override left behind by a removed node reattaches itself to whatever is added under that id next — a node that silently draws somewhere other than its pose says it is. `remove` already computes the whole subtree (`scene.ts:795-796`), so this is three lines at the site that knows the answer. Undo does not restore the override: it is ephemeral, and the frame loop that wanted it is gone.

**Files:**
- Modify: `packages/core/src/core/scene/scene.ts:790-804` (`remove`)
- Test: `packages/core/src/core/scene/scene.overrides.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/core/scene/scene.overrides.test.ts`:

```ts
describe('Scene.overrides — lifecycle', () => {
  it('clears the override of a removed node, and of its descendants', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const parent = scene.add({ kind: 'container', layer: 'main', pose: POSE, data: { label: 'p' } });
    const child = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'c' }, parent });

    scene.overrides.set(parent, { pose: { x: 1, y: 1, width: 10, height: 10 } });
    scene.overrides.set(child, { pose: { x: 2, y: 2, width: 10, height: 10 } });

    scene.remove(parent);

    expect(scene.overrides.ids()).toEqual([]);
  });

  it('does not resurrect the override when undo restores the node', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 9, y: 9, width: 10, height: 10 } });
    scene.remove(id);
    scene.undo();

    expect(scene.get(id)).toBeDefined();
    expect(scene.overrides.has(id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/core/scene/scene.overrides.test.ts`
Expected: FAIL — `expected [ 'n1', 'n2' ] to deeply equal []`.

- [ ] **Step 3: Clear them in `remove`**

In `packages/core/src/core/scene/scene.ts`, inside `remove(id)`, after the snapshot is built and before `executeAndLog`, add:

```ts
      // Ephemeral, and ids are reusable: an override left behind would
      // reattach itself to whatever is added under this id next.
      for (const nid of ids) overrides.clear(nid);
```

so the method reads:

```ts
    remove(id) {
      const node = requireNode(id);
      const sibs = siblingsOf(node.parent);
      const index = sibs.indexOf(id);
      // Snapshot subtree (root + descendants) so revert can restore it.
      const ids: NodeId[] = [id];
      descendants(id, ids);
      const snapshot: Node<TData, TLayer, TPose>[] = ids.map((nid) => {
        const n = requireNode(nid);
        return n.kind === 'container' ? { ...n, children: [...n.children] } : { ...n };
      });
      // Ephemeral, and ids are reusable: an override left behind would
      // reattach itself to whatever is added under this id next.
      for (const nid of ids) overrides.clear(nid);
      executeAndLog('kit:remove', {
        rootId: id, parent: node.parent, index, nodes: snapshot,
      }, 'remove');
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/core/scene/scene.overrides.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/scene/scene.ts packages/core/src/core/scene/scene.overrides.test.ts
git commit -m "drop overrides for a removed subtree"
```

---

### Task 5: Read-through on the live path

`sceneToAdapter.getPose` (`sceneAdapter.ts:317-321`) is read by `buildSceneTree` (`buildSceneTree.ts:69`) for painting **and** by `useSelectTool`'s default `pickEvery` (`useSelectTool.ts:199, 211, 244`) for hit-testing. One edit covers both, which is the point: what you see is what you can click.

**Files:**
- Modify: `packages/core/src/canvas/sceneAdapter.ts:317-321`
- Test: `packages/core/src/canvas/sceneAdapter.overrides.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/sceneAdapter.overrides.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function setup() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
  const adapter = sceneToAdapter(scene);
  return { scene, id, adapter };
}

describe('sceneToAdapter.getPose — override read-through', () => {
  it('returns the document pose when there is no override', () => {
    const { adapter, id } = setup();
    expect(adapter.getPose(id)).toEqual(POSE);
  });

  it('returns the override pose when there is one', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 40, y: 40, width: 10, height: 10 } });
    expect(adapter.getPose(id)).toEqual({ x: 40, y: 40, width: 10, height: 10 });
  });

  it('falls back to the document pose for an alpha-only override', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { alpha: 0.5 });
    expect(adapter.getPose(id)).toEqual(POSE);
  });

  it('returns the document pose again once the override is cleared', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 40, y: 40, width: 10, height: 10 } });
    scene.overrides.clear(id);
    expect(adapter.getPose(id)).toEqual(POSE);
  });

  it('still throws for an unknown id', () => {
    const { adapter } = setup();
    expect(() => adapter.getPose('nope')).toThrow(/unknown node/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/canvas/sceneAdapter.overrides.test.ts`
Expected: FAIL on the second test — received `{ x: 0, y: 0, width: 10, height: 10 }`.

- [ ] **Step 3: Read through the override**

In `packages/core/src/canvas/sceneAdapter.ts`, replace the `getPose` member (`:317-321`):

```ts
    getPose(id) {
      const nid = asNodeId(id);
      const n = scene.get(nid);
      if (!n) throw new Error(`sceneToAdapter: unknown node "${id}"`);
      // Ephemeral overrides win here so painting and hit-testing agree: this
      // is the pose `buildSceneTree` draws AND the one `pickEvery` tests.
      return scene.overrides.get(nid)?.pose ?? n.pose;
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/canvas/sceneAdapter.overrides.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the adapter suite for regressions**

Run: `npx vitest run --project=kit packages/core/src/canvas/sceneAdapter.test.ts packages/core/src/canvas/sceneAdapter.journal.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/canvas/sceneAdapter.ts packages/core/src/canvas/sceneAdapter.overrides.test.ts
git commit -m "read poses through the override on the live adapter"
```

---

### Task 6: Hit-testing and container clips follow the override

Two consequences of Task 5 that must be pinned rather than assumed. A container's clip is derived from the same pose (`buildSceneTree.ts:82` explicit, `:88-91` silhouette fallback), so an overridden container clips its children in its overridden position — which is what a moving rig wants, and is worth a failing test if anyone changes the read-through later.

**Files:**
- Test: `packages/core/src/canvas/sceneAdapter.overrides.test.ts`

- [ ] **Step 1: Write the test**

Append to `packages/core/src/canvas/sceneAdapter.overrides.test.ts`:

```ts
import { buildSceneTree } from './buildSceneTree';
import type { GroupDrawCommand } from '../renderer';

describe('overrides on the walk', () => {
  it('hands the override pose to drawOne', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 33, y: 44, width: 10, height: 10 } });

    const seen: { x: number; y: number }[] = [];
    buildSceneTree(
      adapter as Parameters<typeof buildSceneTree>[0],
      ((_node: unknown, pose: { x: number; y: number }) => { seen.push(pose); return []; }) as Parameters<typeof buildSceneTree>[1],
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
    );

    expect(seen).toEqual([{ x: 33, y: 44, width: 10, height: 10 }]);
  });

  it('moves a container\'s clip with its override', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const parent = scene.add({
      kind: 'container',
      layer: 'main',
      pose: { x: 0, y: 0, width: 50, height: 50 },
      data: { label: 'p' },
      clipFromPose: (p: typeof POSE) => ({ kind: 'rect' as const, x: p.x, y: p.y, width: p.width, height: p.height }),
    });
    scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'c' }, parent });
    const adapter = sceneToAdapter(scene);

    scene.overrides.set(parent, { pose: { x: 200, y: 0, width: 50, height: 50 } });

    const tree = buildSceneTree(
      adapter as Parameters<typeof buildSceneTree>[0],
      (() => []) as Parameters<typeof buildSceneTree>[1],
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
    );

    const clips: { x: number }[] = [];
    const walk = (cmd: unknown): void => {
      const g = cmd as GroupDrawCommand;
      if (g.kind !== 'group') return;
      if (g.clip) clips.push(g.clip as unknown as { x: number });
      for (const child of g.children ?? []) walk(child);
    };
    for (const cmd of tree) walk(cmd);

    expect(clips.length).toBeGreaterThan(0);
    expect(clips.every((c) => c.x === 200)).toBe(true);
  });
});
```

- [ ] **Step 2: Write the hit-test test**

Append to the same file:

```ts
describe('overrides and picking', () => {
  it('picks the node where the override draws it, not where the document says', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 100, y: 100, width: 10, height: 10 } });

    // The same read the default `pickEvery` performs (useSelectTool.ts:199).
    const pose = adapter.getPose(id) as typeof POSE;
    const covers = (wx: number, wy: number) =>
      wx >= pose.x && wx <= pose.x + pose.width && wy >= pose.y && wy <= pose.y + pose.height;

    expect(covers(105, 105)).toBe(true);
    expect(covers(5, 5)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/canvas/sceneAdapter.overrides.test.ts`
Expected: PASS (8 tests). These pass on Task 5's implementation — they exist to pin the consequences, so a regression in `getPose` fails here loudly.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/canvas/sceneAdapter.overrides.test.ts
git commit -m "pin clip and pick behavior under a pose override"
```

---

### Task 7: Read-through and alpha on the headless path

`renderSceneToPixels` builds its own hierarchy inline (`sceneViewRender.ts:113-127`) to stay free of React. It must agree with the live canvas or a headless raster silently disagrees with the screen. This task also adds the override's `alpha`, multiplied into the existing `alphaFor` (`sceneViewRender.ts:163`) rather than replacing it.

**Files:**
- Modify: `packages/core/src/canvas/sceneViewRender.ts:124` and `:156-163`
- Test: `packages/core/src/canvas/sceneViewRender.overrides.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/sceneViewRender.overrides.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { buildSceneViewCommands } from './sceneViewRender';
import type { DrawCommand } from '../renderer';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function setup() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
  return { scene, id };
}

/** Every pose `drawOne` was called with, in walk order. */
function posesSeen(scene: ReturnType<typeof setup>['scene']): { x: number; y: number }[] {
  const seen: { x: number; y: number }[] = [];
  buildSceneViewCommands(scene, VIEW, (_node, pose) => {
    seen.push(pose as { x: number; y: number });
    return [];
  });
  return seen;
}

describe('buildSceneViewCommands — overrides', () => {
  it('paints the document pose with no override', () => {
    const { scene } = setup();
    expect(posesSeen(scene)).toEqual([POSE]);
  });

  it('paints the override pose when there is one', () => {
    const { scene, id } = setup();
    scene.overrides.set(id, { pose: { x: 60, y: 70, width: 10, height: 10 } });
    expect(posesSeen(scene)).toEqual([{ x: 60, y: 70, width: 10, height: 10 }]);
  });

  it('multiplies the override alpha into alphaFor rather than replacing it', () => {
    const { scene, id } = setup();
    scene.overrides.set(id, { alpha: 0.5 });

    const alphas: number[] = [];
    const collect = (cmd: DrawCommand): void => {
      const g = cmd as { kind: string; alpha?: number; children?: DrawCommand[] };
      if (typeof g.alpha === 'number') alphas.push(g.alpha);
      for (const child of g.children ?? []) collect(child);
    };
    const cmds = buildSceneViewCommands(
      scene,
      VIEW,
      () => [{ kind: 'rect', x: 0, y: 0, width: 1, height: 1, fill: { color: '#000' } } as unknown as DrawCommand],
      undefined,
      () => 0.4,
    );
    for (const cmd of cmds) collect(cmd);

    expect(alphas).toContain(0.2);
  });

  it('recomputes a painter after an in-place mutation is committed', () => {
    const { scene, id } = setup();
    const buffer = { x: 0, y: 0, width: 10, height: 10 };
    scene.overrides.set(id, { pose: buffer });

    expect(posesSeen(scene)[0]).toEqual({ x: 0, y: 0, width: 10, height: 10 });

    buffer.x = 120;                 // same object, mutated in place
    scene.overrides.commit();

    expect(posesSeen(scene)[0]).toEqual({ x: 120, y: 0, width: 10, height: 10 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/canvas/sceneViewRender.overrides.test.ts`
Expected: FAIL — the override-pose test receives `{ x: 0, y: 0, … }` and the alpha test's `alphas` contains `0.4`, not `0.2`.

- [ ] **Step 3: Read through in `sceneAsHierarchy`**

In `packages/core/src/canvas/sceneViewRender.ts`, replace the `getPose` line (`:124`):

```ts
    getPose: (id) => scene.overrides.get(id as NodeId)?.pose ?? scene.get(id as NodeId)!.pose,
```

- [ ] **Step 4: Multiply the override alpha in `buildSceneViewCommands`**

In the same file, replace the `wrappedDrawOne` definition inside `buildSceneViewCommands` (`:161-165`):

```ts
  const wrappedDrawOne = (
    node: Node<TData, TLayer, TPose>,
    pose: TPose,
    v: View,
  ): DrawCommand[] => {
    // The scene is in scope here, so this is where the override's alpha is
    // applied on the headless path; `SceneCanvas` does the same for the live
    // one. `Canvas` itself never sees a scene, so it can't and doesn't.
    const overrideAlpha = scene.overrides.get(node.id as NodeId)?.alpha ?? 1;
    return wrapNodeOutput(
      drawOne(node, pose, v),
      pose,
      (alphaFor ? alphaFor(node.id) : 1) * overrideAlpha,
    );
  };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/canvas/sceneViewRender.overrides.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the headless render suite for regressions**

Run: `npx vitest run --project=kit packages/core/src/canvas/sceneViewRender.test.ts packages/core/src/canvas/renderSceneToPixels.test.ts packages/core/src/canvas/SceneViewCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/canvas/sceneViewRender.ts packages/core/src/canvas/sceneViewRender.overrides.test.ts
git commit -m "read overrides on the headless render path"
```

---

### Task 8: Live repaint and live alpha in `SceneCanvas`

Override writes deliberately don't bump the scene version, so nothing currently repaints. `SceneCanvas` already owns exactly this pattern for the animator, image decodes and glyph bakes (`SceneCanvas.tsx:933-953`): subscribe, call `requestRedraw`. Until Part 1 lands, `requestRedraw` is still a React state bump on `Canvas` — one render per frame for the canvas, not one per frame for every scene subscriber, which is the win available today.

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas.tsx:951-953` (after the glyph subscription) and `:1745-1753` (`sceneSlotWithAlpha`)
- Test: `packages/core/src/canvas/SceneCanvas.overrides.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/SceneCanvas.overrides.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createRef } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SceneCanvasApi } from './canvasExtension';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

describe('SceneCanvas — override repaint', () => {
  it('requests a redraw when an override is committed', async () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
    const ref = createRef<SceneCanvasApi>();

    render(<SceneCanvas ref={ref} width={100} height={100} scene={scene} drawOne={() => []} />);

    const requestRedraw = vi.spyOn(ref.current!, 'requestRedraw');
    await act(async () => {
      scene.overrides.set(id, { pose: { x: 5, y: 5, width: 10, height: 10 } });
      scene.overrides.commit();
    });

    expect(requestRedraw).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.overrides.test.tsx`
Expected: FAIL — `expected "requestRedraw" to be called at least once`.

- [ ] **Step 3: Subscribe to overrides**

In `packages/core/src/canvas/SceneCanvas.tsx`, directly after the glyph-ready subscription (`:951-953`), add:

```tsx
  // Override writes deliberately don't bump the scene version — that fanout is
  // what a frame loop is trying to avoid — so the repaint has to come from
  // here instead.
  useEffect(() => scene.overrides.subscribe(() => {
    canvasApiRef.current?.requestRedraw?.();
  }), [scene]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.overrides.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing alpha test**

Append to `packages/core/src/canvas/SceneCanvas.overrides.test.tsx`:

```tsx
import { buildSceneViewCommands } from './sceneViewRender';

describe('SceneCanvas — override alpha composition', () => {
  it('composes the override alpha with a consumer alphaFor exactly once', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
    scene.overrides.set(id, { alpha: 0.5 });

    // The composed function SceneCanvas hands to the scene slot. Asserting it
    // here (rather than through GL) keeps the test on the contract: consumer
    // alpha times override alpha, one multiplication.
    const consumerAlphaFor = (_id: string) => 0.4;
    const composed = (nodeId: string) =>
      consumerAlphaFor(nodeId) * (scene.overrides.get(nodeId as never)?.alpha ?? 1);

    expect(composed(id)).toBeCloseTo(0.2);

    // And the headless path agrees with it.
    const alphas: number[] = [];
    const collect = (cmd: unknown): void => {
      const g = cmd as { alpha?: number; children?: unknown[] };
      if (typeof g.alpha === 'number') alphas.push(g.alpha);
      for (const child of g.children ?? []) collect(child);
    };
    for (const cmd of buildSceneViewCommands(
      scene,
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
      () => [{ kind: 'rect', x: 0, y: 0, width: 1, height: 1, fill: { color: '#000' } } as never],
      undefined,
      consumerAlphaFor,
    )) collect(cmd);

    expect(alphas).toContain(0.2);
  });
});
```

- [ ] **Step 6: Compose the alpha in `SceneCanvas`**

In `packages/core/src/canvas/SceneCanvas.tsx`, replace the `sceneSlotWithAlpha` memo (`:1745-1753`):

```tsx
  // When alphaFor is supplied — or any node carries an override alpha — patch
  // a composed multiplier into the scene slot config so buildSceneLayer
  // (called inside Canvas) wraps per-node commands with it. Canvas has no
  // scene, so the override half has to be folded in here.
  const overrideAlphaFor = useCallback(
    (id: string) => scene.overrides.get(id as never)?.alpha ?? 1,
    [scene],
  );
  const sceneSlotWithAlpha = useMemo(() => {
    const slot = mergedLayers.scene;
    if (!slot || 'layer' in slot) return slot; // null or CustomLayerEntry — leave alone
    const composed = alphaFor
      ? (id: string) => alphaFor(id) * overrideAlphaFor(id)
      : overrideAlphaFor;
    return { ...slot, alphaFor: composed };
  }, [mergedLayers.scene, alphaFor, overrideAlphaFor]);
```

And in the `wiredLayers` memo just below it (`:1755-1760`), the slot is now always worth patching — replace the conditional spread:

```tsx
    // Inject the composed alphaFor into the scene slot (scoping-dim, plus any
    // per-node override alpha).
    ...(sceneSlotWithAlpha ? { scene: sceneSlotWithAlpha } : {}),
```

Add `sceneSlotWithAlpha` to that memo's dependency array in place of `alphaFor`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.overrides.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 8: Run the SceneCanvas suite for regressions**

Run: `npx vitest run --project=kit packages/core/src/canvas/`
Expected: PASS — in particular `SceneCanvas.smoke.test.tsx`, `SceneCanvas.seam.test.tsx`, `Canvas.layerCache.test.tsx` and `usePreviewGhostLayer.test.tsx`.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/canvas/SceneCanvas.tsx packages/core/src/canvas/SceneCanvas.overrides.test.tsx
git commit -m "repaint on override commits and compose override alpha"
```

---

### Task 9: The bake round-trip

Promoting a frame to document state is the one place an override *should* become history. There is no API for it and there shouldn't be — it is `setPose` plus `clear`, and this test is what says so.

**Files:**
- Test: `packages/core/src/core/scene/scene.overrides.test.ts`

- [ ] **Step 1: Write the test**

Append to `packages/core/src/core/scene/scene.overrides.test.ts`:

```ts
describe('Scene.overrides — baking', () => {
  it('promotes a frame to document state as exactly one history entry', () => {
    const { scene, id } = makeScene();
    const before = scene.historyEntries().length;

    const buffer = { x: 0, y: 0, width: 10, height: 10 };
    scene.overrides.set(id, { pose: buffer });
    for (let frame = 0; frame < 30; frame++) {
      buffer.x = frame;
      scene.overrides.commit();
    }

    scene.batch('bake', () => {
      scene.setPose(id, { ...buffer });
    });
    scene.overrides.clearAll();

    expect(scene.historyEntries()).toHaveLength(before + 1);
    expect(scene.get(id)!.pose).toEqual({ x: 29, y: 0, width: 10, height: 10 });
    expect(scene.overrides.ids()).toEqual([]);
  });

  it('undo of a bake returns the document pose, not the override', () => {
    const { scene, id } = makeScene();
    scene.overrides.set(id, { pose: { x: 29, y: 0, width: 10, height: 10 } });
    scene.batch('bake', () => {
      scene.setPose(id, { x: 29, y: 0, width: 10, height: 10 });
    });
    scene.overrides.clearAll();

    scene.undo();

    expect(scene.get(id)!.pose).toEqual(POSE);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run --project=kit packages/core/src/core/scene/scene.overrides.test.ts`
Expected: PASS (9 tests). No implementation is needed — this task exists to pin that the round-trip works with the API as built.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/core/scene/scene.overrides.test.ts
git commit -m "pin the override bake round-trip"
```

---

### Task 10: Barrel exports

**Files:**
- Modify: `packages/core/src/core/scene/index.ts`
- Modify: `packages/core/src/index.ts:327` region and `:714`
- Test: `packages/core/src/index.barrel.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/index.barrel.test.ts`:

```ts
describe('ephemeral pose override exports', () => {
  it('PoseOverrides is expressible with barrel types only', () => {
    // Type-level check (enforced by `tsc --noEmit`): a consumer can annotate a
    // frame-loop helper against the public barrel without internal imports.
    type Pose = { x: number; y: number; width: number; height: number };
    const bump = (
      overrides: Barrel.PoseOverrides<Pose>,
      id: Barrel.NodeId,
      entry: Barrel.PoseOverride<Pose>,
    ) => {
      overrides.set(id, entry);
      overrides.commit();
    };
    expect(typeof bump).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/index.barrel.test.ts`
Expected: FAIL — vitest reports the transform error for `Barrel.PoseOverrides` / `Barrel.PoseOverride` not existing.

- [ ] **Step 3: Export from the scene index**

In `packages/core/src/core/scene/index.ts`, add both names to the existing
`export type { … } from './types'` block, keeping it alphabetical — between
`NodeId` and `RegisteredOp`:

```ts
  NodeId,
  PoseOverride,
  PoseOverrides,
  RegisteredOp,
```

- [ ] **Step 4: Export from the kit barrel**

In `packages/core/src/index.ts`, beside the other scene type exports, add:

```ts
export type { PoseOverride, PoseOverrides } from './core/scene';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/index.barrel.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean exit, no output.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/core/scene/index.ts packages/core/src/index.barrel.test.ts
git commit -m "export the pose-override types"
```

---

### Task 11: `ForceGraphDemo` as the reference consumer

Today the demo writes 24 `setPose` calls per tick inside a `scene.batch`, and says so in a comment that calls the batch a damage-control measure: 60 undo entries per second instead of ~1,440. On overrides it is zero, and the settle becomes one entry — which is what the user actually did.

The tick and bake logic move into a helper module so a test can drive them without rendering the demo, matching `apps/site/demos/platformer/*.ts`.

**Files:**
- Create: `apps/site/demos/forceGraph/overrides.ts`
- Modify: `apps/site/demos/ForceGraphDemo.tsx:170-226`
- Test: `apps/site/demos/__tests__/forceGraphOverrides.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/site/demos/__tests__/forceGraphOverrides.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import { bakeGraphPoses, syncGraphPoses } from '../forceGraph/overrides';

type Layer = 'graph';
interface Data { group: number }
const R = 8;

function setup() {
  const scene = createScene<Data, Layer, { x: number; y: number; width: number; height: number }>({
    systemLayers: [{ id: 'graph' }],
  });
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 10, y: 10 },
  ];
  for (const n of nodes) {
    scene.add({
      id: n.id as never,
      kind: 'leaf',
      layer: 'graph',
      pose: { x: n.x - R, y: n.y - R, width: R * 2, height: R * 2 },
      data: { group: 0 },
    });
  }
  return { scene, nodes };
}

describe('forceGraph overrides', () => {
  it('writes no history and no version bump across a settle', () => {
    const { scene, nodes } = setup();
    const entries = scene.historyEntries().length;
    const version = scene.getVersion();

    for (let frame = 0; frame < 300; frame++) {
      nodes[0].x = frame;
      syncGraphPoses(scene, nodes, R);
    }

    expect(scene.historyEntries()).toHaveLength(entries);
    expect(scene.getVersion()).toBe(version);
  });

  it('allocates one pose buffer per node, not one per frame', () => {
    const { scene, nodes } = setup();
    syncGraphPoses(scene, nodes, R);
    const first = scene.overrides.get('a' as never)!.pose;
    syncGraphPoses(scene, nodes, R);
    expect(scene.overrides.get('a' as never)!.pose).toBe(first);
  });

  it('moves the rendered pose', () => {
    const { scene, nodes } = setup();
    nodes[0].x = 120;
    syncGraphPoses(scene, nodes, R);
    expect(scene.overrides.get('a' as never)!.pose).toEqual({
      x: 120 - R, y: -R, width: R * 2, height: R * 2,
    });
  });

  it('bakes the settled layout as one history entry and clears the overrides', () => {
    const { scene, nodes } = setup();
    const entries = scene.historyEntries().length;

    nodes[0].x = 55;
    syncGraphPoses(scene, nodes, R);
    bakeGraphPoses(scene, nodes, R);

    expect(scene.historyEntries()).toHaveLength(entries + 1);
    expect(scene.get('a' as never)!.pose).toEqual({
      x: 55 - R, y: -R, width: R * 2, height: R * 2,
    });
    expect(scene.overrides.ids()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit apps/site/demos/__tests__/forceGraphOverrides.test.ts`
Expected: FAIL — cannot resolve `../forceGraph/overrides`.

- [ ] **Step 3: Write the helpers**

Create `apps/site/demos/forceGraph/overrides.ts`:

```ts
import type { NodeId, Scene } from '@weasel-js/core';

interface Positioned { id: string; x: number; y: number }
type Pose = { x: number; y: number; width: number; height: number };
type GraphScene = Scene<{ group: number }, 'graph', Pose>;

/**
 * Mirror the simulation's positions into the scene for **this frame only**.
 *
 * The pose buffer is the override entry's own object, mutated in place, so a
 * settle allocates one pose per node rather than one per node per frame.
 */
export function syncGraphPoses(scene: GraphScene, nodes: readonly Positioned[], radius: number): void {
  for (const n of nodes) {
    const id = n.id as NodeId;
    let entry = scene.overrides.get(id);
    if (!entry?.pose) {
      entry = { pose: { x: 0, y: 0, width: radius * 2, height: radius * 2 } };
      scene.overrides.set(id, entry);
    }
    const pose = entry.pose!;
    pose.x = n.x - radius;
    pose.y = n.y - radius;
  }
  scene.overrides.commit();
}

/** Promote the settled layout to document state: one undo entry, overrides gone. */
export function bakeGraphPoses(scene: GraphScene, nodes: readonly Positioned[], radius: number): void {
  scene.batch('settle', () => {
    for (const n of nodes) {
      scene.setPose(n.id as NodeId, {
        x: n.x - radius,
        y: n.y - radius,
        width: radius * 2,
        height: radius * 2,
      });
    }
  });
  scene.overrides.clearAll();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit apps/site/demos/__tests__/forceGraphOverrides.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Migrate the demo**

In `apps/site/demos/ForceGraphDemo.tsx`, replace the `useSimulation` call's `onTick` / `onEnd` (`:206-226`):

```tsx
  const sim = useSimulation<GraphNode>({
    nodes: nodesRef.current,
    forces,
    onTick: () => {
      // Per-frame positions are presentation, not a document edit: they go in
      // as ephemeral overrides, so a settle records nothing.
      syncGraphPoses(scene, nodesRef.current, NODE_R);
    },
    onEnd: () => {
      bakeGraphPoses(scene, nodesRef.current, NODE_R);
      setSettled(true);
    },
  });
```

Add the import beside the other demo-local imports at the top of the file:

```tsx
import { bakeGraphPoses, syncGraphPoses } from './forceGraph/overrides';
```

Also update the stale comment above the `useScene` call (`:176-180`) — the sim no longer writes through `setPose` per tick:

```tsx
  // Scene mirrors the sim's nodes: one leaf per graph node, pose = AABB around
  // the node center. The sim writes per-frame positions as ephemeral pose
  // overrides and bakes the settled layout into the document once.
```

And in the "Regenerate" handler (`:246-251`), clear any live overrides before rebuilding the leaves, since the ids are about to be reused:

```tsx
          scene.overrides.clearAll();
          // Rebuild scene leaves to mirror the new nodes.
          for (const oldId of Array.from(scene.nodes.keys())) {
            scene.remove(oldId);
          }
```

- [ ] **Step 6: Verify the demo suite and lint**

Run: `npx vitest run --project=kit apps/site/`
Expected: PASS.

Run: `npm run lint`
Expected: clean exit.

- [ ] **Step 7: Commit**

```bash
git add apps/site/demos/forceGraph/overrides.ts apps/site/demos/ForceGraphDemo.tsx apps/site/demos/__tests__/forceGraphOverrides.test.ts
git commit -m "drive the force-graph settle with pose overrides"
```

---

### Task 12: Docs

**Files:**
- Modify: `docs/concepts.md` (after the `## Pose` section, `concepts.md:105-122`)
- Modify: `docs/scene-serialization.md` (`## What is NOT serialized`, `:148`)

- [ ] **Step 1: Add the concept**

In `docs/concepts.md`, insert a new section immediately after `## Pose` and before `## Descriptor`:

```markdown
## Pose override

A node's **pose** is document state: undoable, serialized, the answer to "where
is this". A pose **override** is the same value for one frame — `scene.overrides`
holds a per-node `{ pose?, alpha? }` that the render and hit-test paths read
through, and that history and `toJSON()` never see. A 60 Hz camera, a drag
preview, a physics settle and an animation tween all want this: motion that is
not an edit.

```ts
const entry = { pose: { x: 0, y: 0, width: 16, height: 16 } };
scene.overrides.set(id, entry);   // once

// per frame
entry.pose.x = simulation.x;      // mutate in place — no allocation
scene.overrides.commit();         // publish
```

`commit()` is not bookkeeping. The painter memo keys on pose *reference*, so an
in-place mutation without a commit paints the previous frame and reports no
error. `commit()` drops the pose-keyed memo slots of every overridden node.

To promote a frame to document state — dropping a drag, baking a settle — write
it once through `setPose` and `clearAll()`. That is the one step that belongs in
the undo stack.
```

- [ ] **Step 2: Add it to the not-serialized list**

In `docs/scene-serialization.md`, under `## What is NOT serialized`, add a bullet alongside the existing entries:

```markdown
- **Pose overrides** (`scene.overrides`) — ephemeral per-node pose/alpha for a
  frame loop. Like selection, never document content: absent from `toJSON()`,
  never restored by `loadState`, and never recorded in history. Bake with
  `setPose` first if a frame's positions should survive a save.
```

- [ ] **Step 3: Commit**

```bash
git add docs/concepts.md docs/scene-serialization.md
git commit -m "document pose overrides"
```

---

### Task 13: Changeset and full verification

**Files:**
- Create: `.changeset/ephemeral-pose-overrides.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/ephemeral-pose-overrides.md`. **`patch` — every changeset in this repo is `patch`, regardless of what the change adds. Do not write a `bump-approved` marker; that requires an explicit sign-off in conversation.**

```markdown
---
'@weasel-js/core': patch
---

Add ephemeral pose overrides to the scene

`scene.overrides` holds a per-node `{ pose?, alpha? }` that the render and
hit-test paths read through and that history, `toJSON()` and `getVersion()`
never see. It is additive: a scene with no overrides behaves exactly as before.

This is where per-frame motion belongs. A 60 Hz loop previously had to write
through `setPose`, which records an undo entry (one per frame at best, batched)
and bumps the scene version, re-rendering every `useSyncExternalStore`
subscriber. It also had to allocate a fresh pose object per moving node per
frame, because the painter memo keys on pose reference. An override entry is
hoisted once and mutated in place; `overrides.commit()` publishes the frame and
invalidates the memo for the overridden nodes only.

`commit()` is required after an in-place mutation — without it the memo serves
the previous frame's draw. Overrides are cleared when a node is removed, since
ids are reusable. To make a frame permanent, write it once through `setPose`
and clear the override; that single step is the undo entry.

`ForceGraphDemo` now settles with zero history entries and bakes the result as
one, replacing a per-tick batch of 24 `setPose` calls.
```

- [ ] **Step 2: Verify the changeset level**

Run: `npm run check:bumps`
Expected: PASS — it enforces `patch` and fails on anything else.

- [ ] **Step 3: Full typecheck**

Run: `npm run typecheck`
Expected: clean exit.

- [ ] **Step 4: Full unit suite**

Run: `npm run test:unit`
Expected: PASS across `kit`, `weasel-ui`, `draw`, `labkit`.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: clean exit.

- [ ] **Step 6: Visual baselines**

Run: `npm run test:visual`
Expected: PASS. Nothing here changes what a scene without overrides paints; a failure means the read-through or the alpha composition altered the default path, which is a bug in this work, not a baseline to update. Do **not** run `test:visual:update`.

- [ ] **Step 7: Commit**

```bash
git add .changeset/ephemeral-pose-overrides.md
git commit -m "changeset for ephemeral pose overrides"
```

---

## Self-Review

**Spec coverage** — every claim in Part 2 of `2026-08-24-frame-loop-decoupling-design.md` maps to a task:

| Spec | Task |
|---|---|
| `Scene.overrides` as a non-recorded, non-serialized slot | 3 |
| `set` / `clear` / `clearAll` / `commit` | 2 |
| `buildSceneTree` reads through the override | 5 (live), 7 (headless) |
| Undo / `toJSON` / journal never see overrides | 3 |
| Bake by writing once through `setPose` and clearing | 9 |
| One generation bump per frame invalidates overridden nodes only | 1, 2 |
| In-place mutation removes the per-frame allocation | 7 (staleness test), 11 (buffer-identity test) |
| Override map designed for pose **plus** presentation knobs, alpha first | 2 (type), 7 + 8 (application) |

Two things the spec proposes that the code does not support as written, resolved here rather than left to the implementer:

1. **The spec's `set(id: NodeId, pose: TPose)` cannot carry alpha**, which the same section asks for two paragraphs later. The signature is `set(id, entry)` with `{ pose?, alpha? }`, which is also what makes the zero-allocation path expressible — the caller keeps the entry and mutates it.
2. **The spec puts the read-through in `buildSceneTree`.** `buildSceneTree` has an adapter, not a scene, and `Canvas` deliberately never sees a scene — so it cannot look an override up. The read-through goes in the two `getPose` implementations instead (`sceneAdapter.ts`, `sceneViewRender.ts`), which has the better side effect: `useSelectTool`'s default `pickEvery` reads the same method, so hit-testing agrees with painting for free.

A third, smaller divergence: the spec says `commit()` invalidates "overridden nodes only" and describes tracking dirty nodes. In-place mutation is undetectable by definition, so `commit()` invalidates every node currently holding an override. That is the same set in practice and needs no dirty tracking.

**Placeholder scan** — no TBDs, no "similar to Task N", no "add error handling". Every code step carries the code; every test step carries the assertions.

**Type consistency** — `PoseOverride<TPose>` (singular, one node's entry) and `PoseOverrides<TPose>` (the map) are used with those meanings in Tasks 2, 3, 10 and the docs. `dropPoseKeyedMemoSlots` is the name in Tasks 1 and 2. `createPoseOverrides(getNode)` takes a resolver in both its definition (Task 2) and its call site (Task 3). `syncGraphPoses` / `bakeGraphPoses` match between Task 11's helper module, its test, and the demo.
