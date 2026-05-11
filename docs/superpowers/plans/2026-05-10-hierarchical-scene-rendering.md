# Hierarchical Scene Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch Canvas's scene-layer builder from flat (`adapter.getObjects()` loop) to hierarchical (tree walk emitting nested `GroupDrawCommand`s), and enforce that container subtrees stay on a single layer.

**Architecture:** New `buildSceneTree(adapter, drawOne, view)` pure function does the tree walk. Canvas's `buildSceneLayer` picks hierarchical vs flat based on a capability check on the adapter (`getLayers` + `getObject` + `getChildren`). Scene mutation paths (`add`, `move`, `setLayer`) gain cross-layer-subtree validation; `setLayer` on a container cascades through descendants atomically.

**Tech Stack:** TypeScript, vitest, React (testing), the existing weasel scene + renderer types. WebGL renderer is unchanged (already handles nested groups via state stack).

**Spec:** `docs/superpowers/specs/2026-05-10-hierarchical-scene-rendering-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/scene/scene.ts` | Modify | Cross-layer validation in `add`/`move`/`setLayer`; cascade `setLayer` over container subtrees |
| `src/core/scene/scene.test.ts` | Modify | Migrate 4 existing cross-layer tests to same-layer; add new validation tests |
| `src/core/adapters/types.ts` | Modify | Declare optional `getLayers?()` adapter method |
| `src/canvas/sceneAdapter.ts` | Modify | Implement `getLayers()` returning visible layers in order |
| `src/canvas/sceneAdapter.test.ts` | Modify | Test `getLayers()` |
| `src/canvas/buildSceneTree.ts` | Create | Pure function: walk adapter tree, emit nested `GroupDrawCommand[]` |
| `src/canvas/buildSceneTree.test.ts` | Create | Unit tests for `buildSceneTree` |
| `src/canvas/Canvas.tsx` | Modify | Capability switch in `buildSceneLayer`: hierarchical when adapter exposes the tree surface, flat otherwise |
| `src/canvas/Canvas.test.tsx` | Modify | Integration test: scene with container produces expected nested tree |

Total: 1 new module (2 files: impl + test), 5 files modified.

---

## Task 1: Scene validation — `add()` cross-layer rejection

**Files:**
- Modify: `src/core/scene/scene.ts` (the `add` method, ~line 302)
- Modify: `src/core/scene/scene.test.ts` (rewrite 4 cross-layer tests, add 2 new ones)

The kit's data model currently allows a child node to live on a different `layer` than its parent container. The hierarchical render model requires same-layer subtrees. This task rejects cross-layer parent assignments in `add()`.

The same commit must update 4 existing tests in `scene.test.ts` that construct cross-layer subtrees — they'd fail under the new rule and would block any subsequent task.

- [ ] **Step 1: Read the existing `add` implementation**

Read `src/core/scene/scene.ts` around line 302 (the `add` method) and the helper `requireNode`. The check needs to fire when `spec.parent != null`.

- [ ] **Step 2: Write failing test for cross-layer rejection**

Add to `src/core/scene/scene.test.ts` inside the existing `describe('Scene primitive')` block (or wherever existing add tests live):

```ts
it('rejects a child added on a different layer than its parent', () => {
  const s = makeScene();
  const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
  expect(() =>
    s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'plant' }, parent: bed }),
  ).toThrow(/subtree layer must match parent/);
});
```

- [ ] **Step 3: Run the test to verify it fails**

```
npx vitest run src/core/scene/scene.test.ts -t "rejects a child added on a different layer"
```

Expected: FAIL — currently `add` permits cross-layer parent.

- [ ] **Step 4: Implement the validation in `add`**

In `src/core/scene/scene.ts`, inside the `add` method, after `requireLayerIndex(spec.layer);` and `if (spec.parent != null) requireNode(spec.parent);`, add:

```ts
if (spec.parent != null) {
  const parentNode = requireNode(spec.parent);
  if (parentNode.layer !== spec.layer) {
    throw new Error(
      `Scene: cannot place node '${spec.id ?? '<new>'}' on layer '${spec.layer}' under parent '${spec.parent}' on layer '${parentNode.layer}' — subtree layer must match parent`,
    );
  }
}
```

(If `parent` checks already exist nearby for "is a container," fold the layer check in alongside them rather than duplicating the lookup. Read the existing structure first.)

- [ ] **Step 5: Run the test to verify it passes**

```
npx vitest run src/core/scene/scene.test.ts -t "rejects a child added on a different layer"
```

Expected: PASS.

- [ ] **Step 6: Migrate existing cross-layer tests to same-layer**

Four existing tests in `src/core/scene/scene.test.ts` create cross-layer subtrees and would now throw. Rewrite each to use the same layer for parent and children. The behavior they assert is independent of the layer mix.

In `it('rejects parent that is not a container', ...)` (around line 97):
```ts
// BEFORE:
s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'b' }, parent: leaf }),
// AFTER:
s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' }, parent: leaf }),
```

In `it('parents children under containers and tracks them in render order', ...)` (around line 105):
```ts
// BEFORE:
const tomato = s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'tomato' }, parent: bed });
// AFTER:
const tomato = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'tomato' }, parent: bed });
// Also update the inline comment on the next line — render order is now structures-only:
// "Render order: structures pass yields bed then tomato."
expect(order).toEqual([bed, tomato]);  // unchanged assertion
```

In `it('remove deletes the subtree and is undoable', ...)` (around line 116):
```ts
// BEFORE — both child layers:
const t1 = s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 't1' }, parent: bed });
s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 't2' }, parent: bed });
// AFTER:
const t1 = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 't1' }, parent: bed });
s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 't2' }, parent: bed });
```

In `it('move reparents and reindexes; cycle is rejected', ...)` (around line 131):
```ts
// BEFORE:
const child = s.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'c' }, parent: a });
// AFTER:
const child = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'c' }, parent: a });
```

- [ ] **Step 7: Add a positive-path test for same-layer add**

Add to `scene.test.ts`:

```ts
it('accepts a child added on the same layer as its parent', () => {
  const s = makeScene();
  const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
  const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'plant' }, parent: bed });
  expect(s.childrenOf(bed)).toEqual([plant]);
});
```

- [ ] **Step 8: Run the full scene test file**

```
npx vitest run src/core/scene/scene.test.ts
```

Expected: ALL PASS. The 4 migrated tests still cover their original behavior; the new tests assert the new rule.

- [ ] **Step 9: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): reject cross-layer subtrees in add()"
```

---

## Task 2: Scene validation — `move()` cross-layer rejection

**Files:**
- Modify: `src/core/scene/scene.ts` (the `move` method, ~line 356)
- Modify: `src/core/scene/scene.test.ts`

Same rule, different mutation path. `move(id, parent)` must reject if `id`'s layer doesn't match the new `parent`'s layer.

- [ ] **Step 1: Read the existing `move` implementation**

Read `src/core/scene/scene.ts` around the `move` method (line 356-ish). Note the existing cycle check.

- [ ] **Step 2: Write failing test**

Add to `scene.test.ts`:

```ts
it('rejects move() onto a parent on a different layer', () => {
  const s = makeScene();
  const bed1 = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed1' } });
  const bed2 = s.add({ kind: 'container', layer: 'plantings',  pose: POSE, data: { label: 'bed2' } });
  const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed1 });
  expect(() => s.move(plant, bed2)).toThrow(/subtree layer must match parent/);
});

it('allows move(id, null) regardless of layer', () => {
  const s = makeScene();
  const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
  const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
  s.move(plant, null);
  expect(s.childrenOf(bed)).toEqual([]);
});
```

- [ ] **Step 3: Run to verify the rejection test fails**

```
npx vitest run src/core/scene/scene.test.ts -t "rejects move"
```

Expected: FAIL.

- [ ] **Step 4: Implement validation in `move`**

In `src/core/scene/scene.ts`, inside `move`, after the existing parent-is-container check, add:

```ts
if (parent !== null) {
  const parentNode = requireNode(parent);
  const node = requireNode(id);
  if (parentNode.layer !== node.layer) {
    throw new Error(
      `Scene: cannot move node '${id}' on layer '${node.layer}' under parent '${parent}' on layer '${parentNode.layer}' — subtree layer must match parent`,
    );
  }
}
```

- [ ] **Step 5: Run both move tests**

```
npx vitest run src/core/scene/scene.test.ts -t "move"
```

Expected: PASS.

- [ ] **Step 6: Run the full scene test file**

```
npx vitest run src/core/scene/scene.test.ts
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): reject cross-layer move()"
```

---

## Task 3: Scene validation — `setLayer` parent rejection + container cascade

**Files:**
- Modify: `src/core/scene/scene.ts` (the `setLayer` method, ~line 350)
- Modify: `src/core/scene/scene.test.ts`

`setLayer(id, newLayer)` needs two changes:
1. If the node has a parent on a different layer than `newLayer`, throw.
2. If the node is a container (or has any descendants), cascade the new layer through every descendant atomically — wrap the per-node `kit:setLayer` ops in an internal `scene.batch` so undo restores everything in one step.

- [ ] **Step 1: Read the existing `setLayer` implementation**

Read `src/core/scene/scene.ts` around `setLayer` (line 350-ish) and the `kit:setLayer` op registration (line 207). Single-node setLayer already exists; we layer cascade on top via `scene.batch`.

- [ ] **Step 2: Write failing tests — parent rejection**

Add to `scene.test.ts`:

```ts
it('setLayer rejects when the node has a parent on a different layer', () => {
  const s = makeScene();
  const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
  const plant = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
  expect(() => s.setLayer(plant, 'plantings')).toThrow(/subtree layer must match parent/);
});

it('setLayer succeeds on a leaf with no parent', () => {
  const s = makeScene();
  const id = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
  s.setLayer(id, 'plantings');
  expect(s.get(id)?.layer).toBe('plantings');
});
```

- [ ] **Step 3: Run to verify the rejection test fails**

```
npx vitest run src/core/scene/scene.test.ts -t "setLayer rejects when the node has a parent"
```

Expected: FAIL.

- [ ] **Step 4: Implement the parent rejection**

In `src/core/scene/scene.ts`, inside `setLayer`, at the top, add:

```ts
const node = requireNode(id);
if (node.parent !== null) {
  const parentNode = requireNode(node.parent);
  if (parentNode.layer !== layer) {
    throw new Error(
      `Scene: cannot setLayer('${id}', '${layer}') — node has parent '${node.parent}' on layer '${parentNode.layer}', subtree layer must match parent`,
    );
  }
}
```

- [ ] **Step 5: Run the parent-rejection tests**

```
npx vitest run src/core/scene/scene.test.ts -t "setLayer"
```

Expected: PASS for both tests just added. The existing `setPose / setLayer / update round-trip through undo/redo` test (line 155) uses a leaf with no parent — still passes.

- [ ] **Step 6: Write failing test — container cascade**

Add to `scene.test.ts`:

```ts
it('setLayer on a container cascades through all descendants', () => {
  const s = makeScene();
  const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
  const sub = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'sub' }, parent: bed });
  const leaf = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'leaf' }, parent: sub });
  s.setLayer(bed, 'plantings');
  expect(s.get(bed)?.layer).toBe('plantings');
  expect(s.get(sub)?.layer).toBe('plantings');
  expect(s.get(leaf)?.layer).toBe('plantings');
});

it('setLayer cascade is one undo step', () => {
  const s = makeScene();
  const bed = s.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
  const leaf = s.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'leaf' }, parent: bed });
  s.setLayer(bed, 'plantings');
  s.undo();
  expect(s.get(bed)?.layer).toBe('structures');
  expect(s.get(leaf)?.layer).toBe('structures');
});
```

- [ ] **Step 7: Run to verify cascade tests fail**

```
npx vitest run src/core/scene/scene.test.ts -t "setLayer on a container cascades"
```

Expected: FAIL — `setLayer` currently only changes the target node.

- [ ] **Step 8: Implement the cascade**

In `src/core/scene/scene.ts`, change `setLayer` to walk descendants and batch the per-node ops. The existing logic plus the new validation, restructured:

```ts
setLayer(id, layer) {
  const node = requireNode(id);
  if (node.parent !== null) {
    const parentNode = requireNode(node.parent);
    if (parentNode.layer !== layer) {
      throw new Error(
        `Scene: cannot setLayer('${id}', '${layer}') — node has parent '${node.parent}' on layer '${parentNode.layer}', subtree layer must match parent`,
      );
    }
  }
  // Collect the subtree (node + all descendants, DFS preorder) and emit one
  // kit:setLayer op per node inside a batch. Batch coalesces into one undo
  // entry and one notify.
  const subtree: NodeId[] = [];
  const stack: NodeId[] = [id];
  while (stack.length > 0) {
    const curId = stack.pop()!;
    const cur = state.nodes.get(curId);
    if (!cur) continue;
    subtree.push(curId);
    if (cur.kind === 'container') {
      for (let i = cur.children.length - 1; i >= 0; i--) {
        stack.push(cur.children[i]);
      }
    }
  }
  this.batch('setLayer', () => {
    for (const sid of subtree) {
      const cur = requireNode(sid);
      if (cur.layer === layer) continue;
      executeAndLog('kit:setLayer', { id: sid, from: cur.layer, to: layer }, 'setLayer');
    }
  });
},
```

Note: `this.batch` inside an object literal won't work if `setLayer` is defined as a property — adjust to call the local `batch` helper that the file defines, or invoke via the returned object. Read the surrounding code to see how other methods reference each other; some use closure helpers, some use `this`. Match the existing pattern. If the existing code uses a `function batch(...)` helper in scope, call that directly. If methods are defined in an object literal returned at the bottom of the function, you may need to extract `batch` into a top-level helper before `setLayer` references it.

- [ ] **Step 9: Run the cascade tests**

```
npx vitest run src/core/scene/scene.test.ts -t "setLayer"
```

Expected: PASS — cascade walks the tree; undo reverses every node.

- [ ] **Step 10: Run the full scene test file**

```
npx vitest run src/core/scene/scene.test.ts
```

Expected: ALL PASS, including the pre-existing `setPose / setLayer / update round-trip` test (which uses a leaf with no descendants, so cascade is a no-op).

- [ ] **Step 11: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): setLayer rejects parent mismatch, cascades over containers"
```

---

## Task 4: Adapter contract — optional `getLayers()` method

**Files:**
- Modify: `src/core/adapters/types.ts`
- Modify: `src/canvas/sceneAdapter.ts`
- Modify: `src/canvas/sceneAdapter.test.ts`

The hierarchical render path needs a way to enumerate visible layers in z-order from the adapter. Add an optional `getLayers()` method to the adapter contract; implement it in `sceneToAdapter`. Hand-rolled adapters (arrayAdapter) won't implement it and will hit the flat fallback in Canvas (Task 6).

- [ ] **Step 1: Read the existing adapter types and `sceneToAdapter`**

Read `src/core/adapters/types.ts` to see the current interfaces. Read `src/canvas/sceneAdapter.ts` around the returned adapter object — note `scene.layers` is the source of truth.

- [ ] **Step 2: Write failing test in `sceneAdapter.test.ts`**

Add to `src/canvas/sceneAdapter.test.ts`:

```ts
it('getLayers returns visible layers in order, reflects visibility changes', () => {
  const scene = makeScene();
  const adapter = sceneToAdapter(scene);
  expect(adapter.getLayers!().map((l) => l.id)).toEqual(['bg', 'fg']);
  expect(adapter.getLayers!().every((l) => l.visible)).toBe(true);
  scene.setLayerVisible('bg', false);
  const after = adapter.getLayers!();
  expect(after.find((l) => l.id === 'bg')?.visible).toBe(false);
  expect(after.find((l) => l.id === 'fg')?.visible).toBe(true);
});
```

(Use the existing `makeScene` helper at the top of the file. If it doesn't exist with `bg`/`fg` layers, adapt to the file's existing test scene shape.)

- [ ] **Step 3: Run to verify the test fails**

```
npx vitest run src/canvas/sceneAdapter.test.ts -t "getLayers"
```

Expected: FAIL — `adapter.getLayers` is undefined.

- [ ] **Step 4: Declare the optional method in `types.ts`**

Add (or extend an existing adapter type) in `src/core/adapters/types.ts`:

```ts
/**
 * Optional surface that lets `buildSceneTree` walk the adapter by layer.
 * Adapters that don't implement this fall back to flat rendering in Canvas's
 * scene layer.
 */
export interface LayerEnumerableAdapter<TLayer extends string = string> {
  getLayers?(): readonly { id: TLayer; visible: boolean }[];
}
```

Then export it from the module's existing re-export so consumers can reference the type. (Read the file's existing export pattern and match it.)

- [ ] **Step 5: Implement `getLayers` in `sceneToAdapter`**

In `src/canvas/sceneAdapter.ts`, on the returned adapter object, add:

```ts
getLayers() {
  return scene.layers.map((l) => ({ id: l.id, visible: l.visible }));
},
```

Place it near the other read methods (`getObject`, `getObjects`, etc.).

- [ ] **Step 6: Update `SceneCanvasAdapter` type to include it**

In `src/canvas/sceneAdapter.ts`, extend the `SceneCanvasAdapter` type alias to include `LayerEnumerableAdapter<TLayer>`. The existing type is an intersection; add the new interface to the chain:

```ts
export type SceneCanvasAdapter<TData, TLayer extends string, TPose> =
  & MoveAdapter<Node<TData, TLayer, TPose>, TPose>
  & ResizeAdapter<Node<TData, TLayer, TPose>, TPose>
  // ... existing ...
  & LayerEnumerableAdapter<TLayer>
  & Partial<InsertAdapter<Node<TData, TLayer, TPose>>>;
```

(If `LayerEnumerableAdapter` lives in a different module path, import accordingly.)

- [ ] **Step 7: Run the new test**

```
npx vitest run src/canvas/sceneAdapter.test.ts -t "getLayers"
```

Expected: PASS.

- [ ] **Step 8: Run the full adapter test file**

```
npx vitest run src/canvas/sceneAdapter.test.ts
```

Expected: ALL PASS — `getLayers` is additive; no existing test should break.

- [ ] **Step 9: Commit**

```bash
git add src/core/adapters/types.ts src/canvas/sceneAdapter.ts src/canvas/sceneAdapter.test.ts
git commit -m "feat(adapters): optional getLayers() for hierarchical render"
```

---

## Task 5: `buildSceneTree` — pure tree-walker emitting nested `GroupDrawCommand[]`

**Files:**
- Create: `src/canvas/buildSceneTree.ts`
- Create: `src/canvas/buildSceneTree.test.ts`

The core new module. Pure function — takes the adapter (which must implement `getLayers`, `getObject`, `getChildren`, `getPose`), a `drawOne` callback, and the current view; returns a `DrawCommand[]` shaped as one group per visible layer, with each group's children being the per-root subtree groups.

This task writes all the test cases (flat, single container, nested, hidden layer, empty drawOne), runs them all, then implements `buildSceneTree` once to make them all pass. The function is small enough that test-driving each case separately is more overhead than value.

- [ ] **Step 1: Sketch the input types**

Read `src/renderer/DrawCommand.ts` to confirm `GroupDrawCommand` shape (`{ kind: 'group', children: DrawCommand[] }`). Read `src/core/viewport/view.ts` for the `View` type.

- [ ] **Step 2: Write all failing tests**

Create `src/canvas/buildSceneTree.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import type { DrawCommand } from 'renderer';
import type { View } from 'core/viewport/view';

interface Data { label: string }
interface Pose { x: number; y: number; width: number; height: number }

function makeScene() {
  return createScene<Data, 'bg' | 'fg', Pose>({
    systemLayers: [{ id: 'bg' }, { id: 'fg' }],
  });
}

const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const VIEW: View = { tx: 0, ty: 0, scale: 1 };

// Helper: a drawOne that emits one path per node, labeled with the node's data.
function labelDraw(node: { data: Data }, _pose: Pose): DrawCommand[] {
  return [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: node.data.label } }];
}

describe('buildSceneTree', () => {
  it('flat scene → one root group per layer, leaf wrappers inside', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
    scene.add({ kind: 'leaf', layer: 'fg', pose: POSE, data: { label: 'b' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    expect(out).toHaveLength(2); // one per layer
    expect(out[0].kind).toBe('group');
    expect(out[1].kind).toBe('group');
    expect((out[0] as { children: DrawCommand[] }).children).toHaveLength(1);
    expect((out[1] as { children: DrawCommand[] }).children).toHaveLength(1);
  });

  it('container with two same-layer children → group with [container_self, child1_group, child2_group]', () => {
    const scene = makeScene();
    const bed = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'bed' } });
    const p1 = scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'p1' }, parent: bed });
    const p2 = scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'p2' }, parent: bed });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    // bg layer group → contains bed's group
    const bgGroup = out[0] as { children: DrawCommand[] };
    expect(bgGroup.children).toHaveLength(1);
    const bedGroup = bgGroup.children[0] as { kind: 'group'; children: DrawCommand[] };
    expect(bedGroup.kind).toBe('group');
    // bed's group: self paint (one path) + 2 child groups = 3 children
    expect(bedGroup.children).toHaveLength(3);
    // first child is bed's own paint
    expect((bedGroup.children[0] as { kind: string }).kind).toBe('path');
    // next two are child wrapper groups
    expect((bedGroup.children[1] as { kind: string }).kind).toBe('group');
    expect((bedGroup.children[2] as { kind: string }).kind).toBe('group');
    void p1; void p2;
  });

  it('nested containers (3 levels) produce matching nested groups', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'b' }, parent: a });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'c' }, parent: b });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    const aGroup = (out[0] as { children: DrawCommand[] }).children[0] as { children: DrawCommand[] };
    // a's group: [a_self_path, b_group]
    expect(aGroup.children).toHaveLength(2);
    const bGroup = aGroup.children[1] as { kind: string; children: DrawCommand[] };
    expect(bGroup.kind).toBe('group');
    // b's group: [b_self_path, c_group]
    expect(bGroup.children).toHaveLength(2);
    const cGroup = bGroup.children[1] as { kind: string; children: DrawCommand[] };
    expect(cGroup.kind).toBe('group');
    // c's group: just c_self_path (no descendants)
    expect(cGroup.children).toHaveLength(1);
    expect((cGroup.children[0] as { kind: string }).kind).toBe('path');
  });

  it('hidden layer is omitted from output', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
    scene.add({ kind: 'leaf', layer: 'fg', pose: POSE, data: { label: 'b' } });
    scene.setLayerVisible('bg', false);
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
    expect(out).toHaveLength(1); // only fg
  });

  it('empty drawOne output still produces a wrapper group (stable tree shape)', () => {
    const scene = makeScene();
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'a' } });
    const adapter = sceneToAdapter(scene);
    const out = buildSceneTree(adapter as never, () => [], VIEW);
    const bgGroup = out[0] as { children: DrawCommand[] };
    expect(bgGroup.children).toHaveLength(1);
    const leafWrapper = bgGroup.children[0] as { kind: string; children: DrawCommand[] };
    expect(leafWrapper.kind).toBe('group');
    expect(leafWrapper.children).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run to verify all tests fail**

```
npx vitest run src/canvas/buildSceneTree.test.ts
```

Expected: FAIL on every test — module does not exist.

- [ ] **Step 4: Implement `buildSceneTree`**

Create `src/canvas/buildSceneTree.ts`:

```ts
import type { DrawCommand, GroupDrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';

interface HierarchicalAdapter<TObject, TPose> {
  getLayers(): readonly { id: string; visible: boolean }[];
  getObject(id: string): TObject | undefined;
  getChildren(parentId: string | null): readonly string[];
  getPose(id: string): TPose;
}

/**
 * Walk the adapter's scene tree and emit nested `GroupDrawCommand`s,
 * grouped by layer. One top-level group per visible layer (in adapter
 * order); within each layer, the roots whose `layer` matches are walked
 * as subtrees.
 *
 * Each node produces a wrapper group containing:
 *  - its own paint (`drawOne(node, pose, view)`)
 *  - one subgroup per child, recursively
 *
 * A leaf with no children still gets a wrapper group — phase 2 attaches
 * per-node effects (clip path, etc.) to this wrapper, so the structure
 * needs to be stable regardless of whether the node has children.
 */
export function buildSceneTree<
  TObject extends { id: string; layer: string },
  TPose,
>(
  adapter: HierarchicalAdapter<TObject, TPose>,
  drawOne: (obj: TObject, pose: TPose, view: View) => DrawCommand[],
  view: View,
): DrawCommand[] {
  const out: DrawCommand[] = [];

  function buildNodeGroup(id: string): GroupDrawCommand {
    const node = adapter.getObject(id);
    if (!node) return { kind: 'group', children: [] };
    const pose = adapter.getPose(id);
    const self = drawOne(node, pose, view);
    const childIds = adapter.getChildren(id);
    const children: DrawCommand[] = [...self];
    for (const cid of childIds) {
      children.push(buildNodeGroup(cid));
    }
    return { kind: 'group', children };
  }

  for (const layer of adapter.getLayers()) {
    if (!layer.visible) continue;
    const layerGroup: GroupDrawCommand = { kind: 'group', children: [] };
    for (const rootId of adapter.getChildren(null)) {
      const rootNode = adapter.getObject(rootId);
      if (!rootNode || rootNode.layer !== layer.id) continue;
      layerGroup.children.push(buildNodeGroup(rootId));
    }
    out.push(layerGroup);
  }
  return out;
}
```

- [ ] **Step 5: Run all tests**

```
npx vitest run src/canvas/buildSceneTree.test.ts
```

Expected: ALL PASS.

- [ ] **Step 6: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/buildSceneTree.ts src/canvas/buildSceneTree.test.ts
git commit -m "feat(canvas): buildSceneTree — hierarchical scene-layer emitter"
```

---

## Task 6: Canvas wiring — capability switch in `buildSceneLayer`

**Files:**
- Modify: `src/canvas/Canvas.tsx` (the `buildSceneLayer` helper, ~line 377)
- Modify: `src/canvas/Canvas.test.tsx`

`buildSceneLayer` today does a flat loop over `adapter.getObjects()`. Add a capability check: if the adapter exposes `getLayers` AND `getObject` AND `getChildren`, use `buildSceneTree`. Otherwise, fall back to the existing flat loop.

- [ ] **Step 1: Re-read the existing `buildSceneLayer`**

Read `src/canvas/Canvas.tsx` lines 377-410-ish. Note the `cfg.objects ?? adapter?.getObjects() ?? []` precedence — if a consumer passes explicit `objects`, that bypasses the adapter entirely. Hierarchical only fires when `objects` is absent AND the adapter has the capability.

- [ ] **Step 2: Export `buildSceneLayer` for tests**

`buildSceneLayer` is currently a file-local helper. The tests need to call it directly. Edit `src/canvas/Canvas.tsx`: change `function buildSceneLayer<...>(...)` to `export function buildSceneLayer<...>(...)`. No other changes yet.

- [ ] **Step 3: Write failing tests**

Add to `src/canvas/Canvas.test.tsx`. Match the existing imports and test-scene shape at the top of the file (look at how other tests build a scene + adapter; reuse those helpers if present).

```ts
import { buildSceneLayer } from './Canvas';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import { arrayAdapter } from 'core/adapters/arrayAdapter';
import type { DrawCommand } from 'renderer';

const VIEW = { tx: 0, ty: 0, scale: 1 };
const DIMS = { width: 100, height: 100 };
const POSE = { x: 0, y: 0, width: 10, height: 10 };

describe('buildSceneLayer hierarchical path', () => {
  it('emits nested GroupDrawCommand tree for scene-backed adapter', () => {
    const scene = createScene<{ label: string }, 'bg', typeof POSE>({
      systemLayers: [{ id: 'bg' }],
    });
    const bed = scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'bed' } });
    scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'plant' }, parent: bed });
    const adapter = sceneToAdapter(scene);
    const layer = buildSceneLayer(
      { drawOne: (node, _p) => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: 'red' } }] },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    expect(out).toHaveLength(1); // one group per visible layer
    const bgGroup = out[0] as { kind: string; children: DrawCommand[] };
    expect(bgGroup.kind).toBe('group');
    expect(bgGroup.children).toHaveLength(1); // one root: bed
    const bedGroup = bgGroup.children[0] as { kind: string; children: DrawCommand[] };
    expect(bedGroup.kind).toBe('group');
    expect(bedGroup.children).toHaveLength(2); // bed paint + plant wrapper group
  });

  it('falls back to flat output for non-scene adapter (no getLayers)', () => {
    interface Rect { id: string; x: number; y: number; width: number; height: number }
    type Pose = { x: number; y: number; width: number; height: number };
    const rects: Rect[] = [{ id: 'a', x: 0, y: 0, width: 10, height: 10 }];
    const rectsRef = { current: rects };
    const adapter = arrayAdapter<Rect, Pose>({
      ref: rectsRef,
      setItems: () => {},
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    });
    const layer = buildSceneLayer(
      { drawOne: (_obj, _p) => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { color: 'red' } }] },
      adapter as never,
      null,
      () => null,
      () => null,
    );
    const out = layer.draw(null, VIEW, DIMS) as DrawCommand[];
    // Flat: every element is a path command, not a group wrapper.
    expect(out.every((c) => c.kind === 'path')).toBe(true);
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run the failing tests**

```
npx vitest run src/canvas/Canvas.test.tsx -t "buildSceneLayer hierarchical"
```

Expected: FAIL — `buildSceneLayer` still does flat iteration.

- [ ] **Step 5: Implement the capability switch**

In `src/canvas/Canvas.tsx`:

1. Import `buildSceneTree` at the top of the file:
   ```ts
   import { buildSceneTree } from './buildSceneTree';
   ```
2. Inside `buildSceneLayer`, change the `draw` callback. Read the existing body (it ignores `_data`, calls `adapter?.getObjects()`, etc.). Replace it with:

   ```ts
   draw: (_data, view) => {
     const hidden = hideIds();
     // Capability check: hierarchical render needs getLayers + getObject +
     // getChildren on the adapter, and no explicit `cfg.objects` override.
     const a = adapter as unknown as {
       getLayers?: () => readonly { id: string; visible: boolean }[];
       getObject?: (id: string) => unknown;
       getChildren?: (parentId: string | null) => readonly string[];
       getPose?: (id: string) => TPose;
     };
     if (
       cfg.objects === undefined &&
       typeof a.getLayers === 'function' &&
       typeof a.getObject === 'function' &&
       typeof a.getChildren === 'function' &&
       drawOne
     ) {
       // Wrap drawOne with the hide-list filter — hidden ids contribute
       // empty draw commands but still get their wrapper group so tree
       // shape stays stable.
       const filteredDrawOne = (obj: TObject, pose: TPose, v: View): DrawCommand[] => {
         if (hidden && hidden.has(obj.id)) return [];
         const cmds = drawOne(obj, pose, v);
         if (debugSink) {
           const b = boundsOfFn ? boundsOfFn(obj.id) : null;
           if (b) debugSink.recordBounds(obj.id, b);
           const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
           const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
           debugSink.recordOrigin(obj.id, { x: ox, y: oy });
         }
         return cmds;
       };
       return buildSceneTree(
         a as Parameters<typeof buildSceneTree>[0],
         filteredDrawOne as Parameters<typeof buildSceneTree>[1],
         view,
       );
     }
     // Flat fallback (unchanged): the existing body of `draw` continues here.
     const objects = cfg.objects ?? adapter?.getObjects() ?? [];
     const children: DrawCommand[] = [];
     for (const obj of objects) {
       if (hidden && hidden.has(obj.id)) continue;
       const pose: TPose = toPose(obj);
       if (drawOne) {
         for (const cmd of drawOne(obj, pose, view)) children.push(cmd);
       }
       if (debugSink) {
         const b = boundsOfFn ? boundsOfFn(obj.id) : null;
         if (b) debugSink.recordBounds(obj.id, { x: b.x, y: b.y, width: b.width, height: b.height });
         const ox = (pose as { x?: number }).x ?? (b ? b.x : 0);
         const oy = (pose as { y?: number }).y ?? (b ? b.y : 0);
         debugSink.recordOrigin(obj.id, { x: ox, y: oy });
       }
     }
     return children;
   },
   ```

- [ ] **Step 6: Run the Canvas tests**

```
npx vitest run src/canvas/Canvas.test.tsx -t "buildSceneLayer hierarchical"
```

Expected: PASS.

```
npx vitest run src/canvas/Canvas.test.tsx
```

Expected: ALL PASS — flat scenes still flat, scene-backed adapters now hierarchical.

- [ ] **Step 7: Run the full kit suite**

```
npx vitest run
```

Expected: 1 unrelated failure (pre-existing `GradientPlaygroundDemo` resolve error), everything else green. If anything else fails, those tests were relying on the flat output of scene-backed adapters and need updating — investigate and fix.

- [ ] **Step 8: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 9: Build**

```
npm run build
```

Expected: clean.

- [ ] **Step 10: Smoke-test the demos in a browser**

Start dev server: `npm run dev`. Open the demos that use containers (Scene primitive, Layout) and any random selection of flat demos (Rect, Resize, Multi-select). Confirm visual parity with main — nothing should look different. If anything does, inspect the `draw` output via a console.log on the scene layer and compare.

- [ ] **Step 11: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): scene layer renders hierarchically when adapter supports it"
```

---

## After all tasks

Run the full pipeline one more time:

```
npx tsc --noEmit && npx vitest run && npm run build
```

The visual-regression rig will compare against the baselines; container demos (LayoutDemo, SceneDemo) should match pixel-for-pixel since the renderer flattens nested groups during draw. If a baseline differs, regenerate it locally and inspect the diff before committing the new baseline.

Phase 2 (the actual `clip` API, stencil renderer, clip-aware hit-test) is a separate spec and plan — not in this scope.
