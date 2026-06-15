# Move Behavior Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the kit's default `moveAction` run `opts.behaviors` so the existing move behaviors (`snapToContainer`, `snapBackOrDelete`, `snapToGrid`, `snapToGuides`) work end-to-end through the dispatcher-routed move action.

**Architecture:** Mirror the behavior loop `resize.ts` already runs, but adapted to move's group-transform space. `moveAction` builds a hand-rolled scene-backed gesture adapter (kept inside `interactions/` to avoid an `interactions→canvas` import cycle), fires behavior `onStart` at drag start, folds behavior `onMove` results into the proposed `GroupTransform` each frame, and at `onEnd` runs a first-non-undefined-wins reducer: `Op[]` commits via `scene.applyBatch`, `null` aborts, all-`undefined` falls through to today's default translate/`reparentOnDrop` path. A one-file consumer surface revival (`useSelectTool.move.behaviors`) lets a demo reach the pipeline the normal way.

**Tech Stack:** TypeScript, React, vitest. Kit modules under `src/interactions/`, `src/tools/`, `src/canvas/`; demos under `demo/`.

**Spec:** `docs/superpowers/specs/2026-06-15-move-behavior-pipeline-design.md`

---

## File Structure

- **Create** `src/interactions/actions/move/gestureAdapter.ts` — minimal scene-backed `MoveAdapter` for the pipeline (no `canvas/` import).
- **Create** `src/interactions/actions/move/gestureAdapter.test.ts` — unit test for the adapter.
- **Modify** `src/interactions/actions/defaults/move.ts` — wire behaviors into `start`/`onMove`/`onEnd`.
- **Create** `src/interactions/actions/defaults/move.behaviors.integration.test.ts` — end-to-end behavior test with a real scene.
- **Modify** `src/tools/builtin/select/useSelectTool.ts` — revive `move` option; thread `behaviors` into the move binding `opts`.
- **Modify** `src/tools/builtin/select/useSelectTool.test.ts` (or nearest existing test) — assert binding `opts.behaviors` populated.
- **Create** `demo/demos/MoveSnapDemo.tsx` — new terse demo.
- **Modify** `demo/registry.ts` — register the demo.

---

## Task 1: Scene-backed gesture adapter

**Files:**
- Create: `src/interactions/actions/move/gestureAdapter.ts`
- Test: `src/interactions/actions/move/gestureAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/interactions/actions/move/gestureAdapter.test.ts
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { moveGestureAdapter } from './gestureAdapter';

interface D { color: string }
type L = 'main';
interface P { x: number; y: number; width: number; height: number }

function fixture() {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'container', layer: 'main', data: { color: '#eee' }, pose: { x: 0, y: 0, width: 200, height: 200 } });
  const leaf = scene.add({ kind: 'leaf', layer: 'main', data: { color: '#f00' }, pose: { x: 10, y: 10, width: 20, height: 20 } });
  return { scene, box, leaf };
}

describe('moveGestureAdapter', () => {
  it('reads nodes, poses, and parents from the scene', () => {
    const { scene, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    expect(a.getNode(leaf as string)?.id).toBe(leaf);
    expect(a.getPose(leaf as string)).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(a.getParent(leaf as string)).toBeNull();
    expect(a.getNodes().map((n) => n.id)).toContain(leaf);
  });

  it('setParent reparents and getParent reflects it', () => {
    const { scene, box, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    a.setParent(leaf as string, box as string);
    expect(scene.get(asNodeId(leaf as string))?.parent).toBe(box);
  });

  it('removeNode then insertNode round-trips a node', () => {
    const { scene, leaf } = fixture();
    const a = moveGestureAdapter<P>(scene);
    const node = a.getNode(leaf as string)!;
    a.removeNode(leaf as string);
    expect(scene.get(asNodeId(leaf as string))).toBeUndefined();
    a.insertNode(node);
    expect(scene.get(asNodeId(leaf as string))?.id).toBe(leaf);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/move/gestureAdapter.test.ts`
Expected: FAIL — `moveGestureAdapter` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/interactions/actions/move/gestureAdapter.ts
/**
 * Minimal scene-backed adapter for the move behavior pipeline.
 *
 * Lives in `interactions/` rather than reusing `canvas/sceneAdapter.ts` so the
 * move action does not import from `canvas/` (that back-edge would create an
 * `interactions → canvas → interactions` cycle). Carries exactly the methods
 * the move behaviors call (`getParent` / `getNodes` / `getNode`) plus the
 * mutators the committed ops apply through (`setPose` / `setParent` /
 * `removeNode` / `insertNode`).
 */
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { MoveAdapter } from 'core/adapters/types';

export type MoveGestureAdapter<TPose> = MoveAdapter<Node<unknown, string, TPose>, TPose> & {
  setParent(id: string, parentId: string | null): void;
  removeNode(id: string): void;
  insertNode(node: Node<unknown, string, TPose>): void;
};

export function moveGestureAdapter<TPose>(
  scene: Scene<unknown, string, TPose>,
): MoveGestureAdapter<TPose> {
  return {
    getNode: (id) => scene.get(asNodeId(id)),
    getNodes: () => {
      const out: Node<unknown, string, TPose>[] = [];
      for (const id of scene.renderOrder()) {
        const n = scene.get(id);
        if (n) out.push(n);
      }
      return out;
    },
    getPose: (id) => scene.get(asNodeId(id))!.pose,
    getParent: (id) => scene.get(asNodeId(id))?.parent ?? null,
    setPose: (id, pose) => scene.setPose(asNodeId(id), pose),
    setParent: (id, parentId) =>
      scene.move(asNodeId(id), parentId === null ? null : asNodeId(parentId)),
    removeNode: (id) => scene.remove(asNodeId(id)),
    insertNode: (node) =>
      scene.add({
        kind: node.kind,
        layer: node.layer,
        pose: node.pose,
        data: node.data,
        id: node.id,
        ...(node.parent !== null ? { parent: node.parent } : {}),
      }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/interactions/actions/move/gestureAdapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/interactions/actions/move/gestureAdapter.ts src/interactions/actions/move/gestureAdapter.test.ts
git commit -m "feat(move): scene-backed gesture adapter for the behavior pipeline"
```

---

## Task 2: Wire behaviors into `moveAction`

**Files:**
- Modify: `src/interactions/actions/defaults/move.ts`
- Test: `src/interactions/actions/defaults/move.behaviors.integration.test.ts`

Context to re-read before editing: `move.ts:106-131` (the `MoveScratch` interface), `move.ts:276-398` (`start`/`onMove`/`onEnd`). The behavior contracts live in `src/interactions/gestures/types.ts` (`MoveBehavior`, `GroupTransform`, `BehaviorResult`, `GestureContext`). `snapToContainer`/`snapBackOrDelete`/`snapToGrid` are in `src/interactions/actions/move/behaviors/` and re-exported from `src/interactions/actions/move/index.ts`.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/interactions/actions/defaults/move.behaviors.integration.test.ts
import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import { snapToContainer } from '../move/behaviors/snapToContainer';
import { snapBackOrDelete } from '../move/behaviors/snapBackOrDelete';
import { snapToGrid } from '../move/behaviors/snapToGrid';
import type { InvocationCtx, BindingOpts, OngoingHandle } from '../invoker';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { SnapTarget } from 'core/adapters/types';

interface D { color: string }
type L = 'main';
interface P { x: number; y: number; width: number; height: number }

function stubSelection(ids: string[]): SelectionApi {
  return { get: () => ids } as unknown as SelectionApi;
}

/** Build a minimal ongoing InvocationCtx. `drag.current`/`delta` drive onMove;
 *  `world` drives the gesture pointer the behaviors read. */
function ctx(
  scene: ReturnType<typeof createScene<D, L, P>>,
  ids: string[],
  drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } },
): InvocationCtx {
  return {
    world: drag ? { x: drag.current.x, y: drag.current.y } : { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: stubSelection(ids), scene },
    drag,
  } as unknown as InvocationCtx;
}

function fixture() {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'container', layer: 'main', data: { color: '#eee' }, pose: { x: 200, y: 0, width: 200, height: 200 } });
  const leaf = scene.add({ kind: 'leaf', layer: 'main', data: { color: '#f00' }, pose: { x: 0, y: 0, width: 20, height: 20 } });
  return { scene, box: box as string, leaf: leaf as string };
}

describe('moveAction behavior pipeline', () => {
  it('snapToContainer reparents the dragged node on commit', () => {
    const { scene, box, leaf } = fixture();
    const target: SnapTarget<P> = { parentId: box, slotPose: { x: 210, y: 10, width: 20, height: 20 } };
    const opts: BindingOpts = {
      behaviors: [
        snapToContainer<P>({
          dwellMs: 0,
          isInstant: () => true,
          findTarget: (_id, wx) => (wx > 200 ? target : null),
        }) as never,
      ],
    };
    const handle = moveAction.invoker.start(ctx(scene, [leaf]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 260, y: 10 }, delta: { x: 250, y: 0 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 260, y: 10 }, delta: { x: 250, y: 0 } }), 'commit');

    expect(scene.get(asNodeId(leaf))?.parent).toBe(box);
    expect(scene.get(asNodeId(leaf))?.pose).toEqual({ x: 210, y: 10, width: 20, height: 20 });
  });

  it('snapBackOrDelete aborts (no pose change) within radius', () => {
    const { scene, leaf } = fixture();
    const before = scene.get(asNodeId(leaf))!.pose;
    const opts: BindingOpts = {
      behaviors: [snapBackOrDelete<P>({ radius: 100, onFreeRelease: 'snap-back' }) as never],
    };
    const handle = moveAction.invoker.start(ctx(scene, [leaf]), opts) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 15, y: 12 }, delta: { x: 5, y: 2 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 10, y: 10 }, current: { x: 15, y: 12 }, delta: { x: 5, y: 2 } }), 'commit');

    expect(scene.get(asNodeId(leaf))?.pose).toEqual(before);
  });

  it('snapToGrid quantizes the committed delta', () => {
    const { scene, leaf } = fixture();
    const opts: BindingOpts = {
      behaviors: [snapToGrid<P>({ cellWidth: 20, cellHeight: 20 }) as never],
    };
    const handle = moveAction.invoker.start(ctx(scene, [leaf]), opts) as OngoingHandle;
    // raw delta (23, 19) → committed pose should snap to the 20px grid.
    handle.onMove!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 23, y: 19 }, delta: { x: 23, y: 19 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 23, y: 19 }, delta: { x: 23, y: 19 } }), 'commit');

    const pose = scene.get(asNodeId(leaf))!.pose;
    expect(pose.x % 20).toBe(0);
    expect(pose.y % 20).toBe(0);
  });

  it('empty behaviors = today’s translate-only commit', () => {
    const { scene, leaf } = fixture();
    const handle = moveAction.invoker.start(ctx(scene, [leaf]), {}) as OngoingHandle;
    handle.onMove!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 30, y: 40 }, delta: { x: 30, y: 40 } }));
    handle.onEnd!(ctx(scene, [leaf], { start: { x: 0, y: 0 }, current: { x: 30, y: 40 }, delta: { x: 30, y: 40 } }), 'commit');
    expect(scene.get(asNodeId(leaf))?.pose).toEqual({ x: 30, y: 40, width: 20, height: 20 });
  });
});
```

> **Note for implementer:** verify the exact `snapToGrid` arg names by reading `src/interactions/actions/move/behaviors/snapToGrid.ts` before running — adjust the test's `{ cellWidth, cellHeight }` to match its real signature. Same for any `snapToContainer`/`snapBackOrDelete` arg drift. The assertions (reparent / no-change / grid-aligned) stay the same regardless of arg names.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/defaults/move.behaviors.integration.test.ts`
Expected: FAIL — behaviors not run (leaf not reparented; pose not snapped). The empty-behaviors case should already pass.

- [ ] **Step 3: Extend `MoveScratch` and imports**

In `move.ts`, add imports near the existing ones:

```ts
import type { MoveBehavior, GroupTransform, GestureContext } from '../../gestures/types';
import { moveGestureAdapter, type MoveGestureAdapter } from '../move/gestureAdapter';
```

Add fields to the `MoveScratch` interface (after `projection?`):

```ts
  /** Behaviors from `opts.behaviors`; empty array when none supplied. */
  behaviors: MoveBehavior<unknown>[];
  /** Reused gesture context handed to behaviors across the drag. */
  gestureCtx: GestureContext<unknown>;
  /** Scene-backed adapter the committed behavior ops apply through. */
  adapter: MoveGestureAdapter<unknown>;
```

- [ ] **Step 4: Build behaviors + gesture ctx in `start`**

In `start`, after the `scratch` object is created (currently `move.ts:319-327`), replace the bare scratch construction so it also wires behaviors. Insert before `return {`:

```ts
const behaviors = (opts?.behaviors ?? []) as MoveBehavior<unknown>[];
const adapter = moveGestureAdapter<unknown>(scene);
const origin = new Map<string, unknown>();
for (const [id, pose] of startPoses) origin.set(id as string, pose);
const gestureCtx: GestureContext<unknown> = {
  draggedIds: ids as unknown as string[],
  origin,
  current: new Map(origin),
  snap: null,
  modifiers: { ...ctx.modifiers },
  pointer: { worldX: ctx.world.x, worldY: ctx.world.y, clientX: 0, clientY: 0 },
  adapter: adapter as unknown as GestureContext<unknown>['adapter'],
  scratch: {},
};
for (const b of behaviors) b.onStart?.(gestureCtx);
```

And add `behaviors, gestureCtx, adapter` to the `MoveScratch` literal:

```ts
const scratch: MoveScratch = {
  startPoses,
  ids,
  cascadeIds,
  scene,
  currentDelta: { dx: 0, dy: 0 },
  previews: new Map<NodeId, unknown>(),
  projection,
  behaviors,
  gestureCtx,
  adapter,
};
```

- [ ] **Step 5: Fold behavior results in `onMove`**

Replace the body of `onMove` (currently `move.ts:331-345`) with:

```ts
onMove(moveCtx: InvocationCtx): void {
  if (!moveCtx.drag) return;
  let dx = moveCtx.drag.delta.x;
  let dy = moveCtx.drag.delta.y;

  if (scratch.behaviors.length > 0) {
    const gctx = scratch.gestureCtx;
    gctx.modifiers = { ...moveCtx.modifiers };
    gctx.pointer = { worldX: moveCtx.drag.current.x, worldY: moveCtx.drag.current.y, clientX: 0, clientY: 0 };
    // Refresh live poses (origin + raw delta) so behaviors read current state.
    for (const [id, ori] of scratch.startPoses) {
      gctx.current.set(id as string, translatePoseGeneric(ori, dx, dy, scratch.projection));
    }
    let transform: GroupTransform = { kind: 'translate', dx, dy };
    const primary = scratch.ids[0] as NodeId | undefined;
    for (const b of scratch.behaviors) {
      const r = b.onMove?.(gctx, transform);
      if (!r) continue;
      if (r.transform && r.transform.kind === 'translate') {
        transform = r.transform;
      } else if (r.pose !== undefined && primary !== undefined) {
        // Legacy primary-pose channel → derive a uniform translate from the
        // pose diff against the primary's origin (documented BehaviorResult shim).
        const o = scratch.startPoses.get(primary) as { x: number; y: number } | undefined;
        const p = r.pose as unknown as { x: number; y: number };
        if (o) transform = { kind: 'translate', dx: p.x - o.x, dy: p.y - o.y };
      }
      if (r.snap !== undefined) gctx.snap = r.snap;
    }
    if (transform.kind === 'translate') { dx = transform.dx; dy = transform.dy; }
  }

  scratch.currentDelta = { dx, dy };
  scratch.previews.clear();
  for (const [id, ori] of scratch.startPoses) {
    scratch.previews.set(id, translatePoseGeneric(ori, dx, dy, scratch.projection));
  }
},
```

- [ ] **Step 6: Add the `onEnd` behavior reducer**

In `onEnd`, after the `cancel` early-return (currently `move.ts:347-351`) and the `const { dx, dy } = scratch.currentDelta;` line, insert the behavior pipeline BEFORE the existing `if (dx === 0 && dy === 0)` guard:

```ts
// Behavior pipeline owns the commit if any behavior returns non-undefined.
if (scratch.behaviors.length > 0) {
  const gctx = scratch.gestureCtx;
  for (const [id, ori] of scratch.startPoses) {
    gctx.current.set(id as string, translatePoseGeneric(ori, dx, dy, scratch.projection));
  }
  for (const b of scratch.behaviors) {
    const r = b.onEnd?.(gctx);
    if (r === undefined) continue;        // defer to next behavior / default
    if (r === null) {                     // abort (e.g. snap-back)
      scratch.previews.clear();
      return;
    }
    // Op[] → behavior owns commit. One undo entry via scene.applyBatch.
    scratch.scene.applyBatch(r, 'Move', scratch.adapter);
    scratch.previews.clear();
    return;
  }
  // all behaviors deferred → fall through to the default path below.
}
```

The existing `if (dx === 0 && dy === 0)` guard and the `scratch.scene.batch('Move', ...)` default block stay unchanged after this insert.

- [ ] **Step 7: Run the integration test + the existing move test**

Run: `npx vitest run src/interactions/actions/defaults/move.behaviors.integration.test.ts src/interactions/actions/defaults/move.test.ts`
Expected: PASS (all behavior cases + the unchanged default-path tests).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/interactions/actions/defaults/move.ts src/interactions/actions/defaults/move.behaviors.integration.test.ts
git commit -m "feat(move): run opts.behaviors through the move action pipeline"
```

---

## Task 3: Consumer surface — `useSelectTool.move.behaviors`

**Files:**
- Modify: `src/tools/builtin/select/useSelectTool.ts`
- Test: `src/tools/builtin/select/useSelectTool.test.ts` (or the nearest existing select-tool test file — confirm by `ls src/tools/builtin/select/`)

Context: the move binding is built at `useSelectTool.ts:352-374`; it already conditionally attaches `opts: { params: { reparentOnDrop } }`. The `move?: unknown` option is at `useSelectTool.ts:57-58` (the "ignored after Phase 14e Task 3" comment).

- [ ] **Step 1: Write the failing test**

```ts
// in the select-tool test file
import { snapToContainer } from '../../../interactions/actions/move/behaviors/snapToContainer';
// ... within a describe block ...
it('threads move.behaviors into the move binding opts', () => {
  const beh = snapToContainer({ dwellMs: 0, findTarget: () => null });
  // Render/construct the tool with move behaviors. Use the file's existing
  // harness for invoking useSelectTool (renderHook or the direct-call helper
  // already present in this test file).
  const tool = makeSelectTool({ move: { behaviors: [beh] } }); // adapt to harness
  const moveBinding = tool.bindings.find((b) => b.actionId === 'move');
  expect(moveBinding?.opts?.behaviors).toEqual([beh]);
});
```

> **Note for implementer:** match the existing test harness in this file for constructing the tool and reading `bindings`. If the file uses `renderHook(() => useSelectTool(adapter, opts))`, follow that. The assertion target is `binding.opts.behaviors`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/builtin/select/useSelectTool.test.ts`
Expected: FAIL — `opts.behaviors` undefined (the `move` option is ignored today).

- [ ] **Step 3: Re-type the `move` option**

In `useSelectTool.ts`, add the import:

```ts
import type { UseMoveOptions } from '../../../interactions/actions/move/options';
```

Replace the ignored `move?: unknown` field (lines ~57-58) with:

```ts
  /** Move-action options. After Phase 14e the move gesture is dispatcher-routed,
   *  so only `behaviors` is consumed here — threaded into the move binding's
   *  `opts.behaviors`. Other `UseMoveOptions` fields are accepted for API shape
   *  but not read by this tool. */
  move?: UseMoveOptions<TPose>;
```

- [ ] **Step 4: Attach behaviors to the move binding**

At the move binding construction (lines ~370-373), generalize the existing `opts` spread so it carries BOTH params and behaviors. Replace:

```ts
            actionId: 'move',
            ...(options.reparentOnDrop && options.reparentOnDrop !== 'off'
              ? { opts: { params: { reparentOnDrop: options.reparentOnDrop } } }
              : {}),
```

with:

```ts
            actionId: 'move',
            ...((() => {
              const reparent = options.reparentOnDrop && options.reparentOnDrop !== 'off'
                ? { params: { reparentOnDrop: options.reparentOnDrop } }
                : undefined;
              const behaviors = options.move?.behaviors?.length
                ? { behaviors: options.move.behaviors }
                : undefined;
              return reparent || behaviors
                ? { opts: { ...reparent, ...behaviors } }
                : {};
            })()),
```

- [ ] **Step 5: Run the test + typecheck**

Run: `npx vitest run src/tools/builtin/select/useSelectTool.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Verify upper-layer forwarding preserves `behaviors`**

Read `src/canvas/SceneCanvas/useSceneSelectTool.ts` around the `wiredMoveOptions` construction (search `wiredMoveOptions`). Confirm it spreads `...moveOptions` (so `behaviors` survives) before adding `cascadeWorldPose`. If it builds a fresh object that omits `behaviors`, add `behaviors: moveOptions?.behaviors` to it. No code change if it already spreads.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/tools/builtin/select/useSelectTool.ts src/tools/builtin/select/useSelectTool.test.ts src/canvas/SceneCanvas/useSceneSelectTool.ts
git commit -m "feat(select): thread move.behaviors into the move binding opts"
```

---

## Task 4: Demo — `MoveSnapDemo`

**Files:**
- Create: `demo/demos/MoveSnapDemo.tsx`
- Modify: `demo/registry.ts`

Context: model on `demo/demos/MoveDemo.tsx`. Read `demo/registry.ts` to copy the exact registration shape (how `MoveDemo` is listed). Confirm `snapToContainer`/`snapBackOrDelete` are exported from `@weasel-js/core` (check `src/index.ts`; if not top-level exported, import from the package subpath the index uses — grep `snapToContainer` in `src/index.ts`).

- [ ] **Step 1: Create the demo**

```tsx
// demo/demos/MoveSnapDemo.tsx
import { useState } from 'react';
import { SceneCanvas, useScene, useSelection, snapToContainer, snapBackOrDelete } from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 320;
// A "planting" drag: drop a token into either bin (container) to reparent it;
// release it on empty canvas within the snap-back radius and it returns home.
const BIN_A = { x: 40, y: 200, width: 160, height: 90 };
const BIN_B = { x: 260, y: 200, width: 160, height: 90 };

function inside(b: { x: number; y: number; width: number; height: number }, wx: number, wy: number) {
  return wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height;
}

export function MoveSnapDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'binA' as never, kind: 'container', layer: 'default', pose: BIN_A, data: { color: '#e8efe4' } },
      { id: 'binB' as never, kind: 'container', layer: 'default', pose: BIN_B, data: { color: '#efe9e4' } },
      { id: 'token' as never, kind: 'leaf', layer: 'default', pose: { x: 210, y: 40, width: 40, height: 40 }, data: { color: '#7fb069' } },
    ],
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectTool={{
        move: {
          behaviors: [
            snapToContainer<Pose>({
              dwellMs: 250,
              findTarget: (_id, wx, wy) => {
                if (inside(BIN_A, wx, wy)) return { parentId: 'binA', slotPose: { x: BIN_A.x + 20, y: BIN_A.y + 25, width: 40, height: 40 } };
                if (inside(BIN_B, wx, wy)) return { parentId: 'binB', slotPose: { x: BIN_B.x + 20, y: BIN_B.y + 25, width: 40, height: 40 } };
                return null;
              },
            }),
            snapBackOrDelete<Pose>({ radius: 30, onFreeRelease: 'snap-back' }),
          ],
        },
      }}
      view={view}
      onViewChange={setView}
      viewport={{}}
      layers={{
        scene: {
          drawOne: (n, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: n.data.color },
          }],
        },
        selectionOverlay: { handles: false },
      }}
    />
  );
}
```

> **Note for implementer:** verify `snapToContainer`/`snapBackOrDelete`/`SnapTarget` arg + return shapes against their source files and adjust the `findTarget` return literal to the real `SnapTarget` shape (`{ parentId, slotPose }`). Adjust `dwellMs`/`radius`/`onFreeRelease` field names if they differ.

- [ ] **Step 2: Register the demo**

Read `demo/registry.ts`, find the `MoveDemo` entry, and add an analogous `MoveSnapDemo` entry (import + registry record) immediately after it. Match the existing field shape exactly (id, title/label, component).

- [ ] **Step 3: Typecheck + build the demo**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Start the demo dev server (background) and open `MoveSnapDemo`. Drag the token into a bin → it reparents and snaps to the slot. Drag it a tiny bit off-home and release → it snaps back. (Launch headless/background per the workspace's Playwright rules if scripting it.)

- [ ] **Step 5: Commit**

```bash
git add demo/demos/MoveSnapDemo.tsx demo/registry.ts
git commit -m "feat(demo): MoveSnapDemo exercising container-snap + snap-back"
```

---

## Task 5: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Run the release gate**

Run: `npx tsc --noEmit && npx vitest run && npx tsup build`
Expected: typecheck clean, all tests pass, build succeeds. (This matches CI's release gate — `vitest` alone does not typecheck production code.)

- [ ] **Step 2: Confirm the diagnosis is closed**

Manually confirm `moveAction` now consumes `opts.behaviors` (grep `behaviors` in `move.ts` returns runtime usage, not just the header comment), and the header's "Phase 7 TODO" note for the behavior pipeline is updated to reflect that it's now wired (leave the separate `move.ts:412` `Action.enabled` Phase 7 TODO untouched).

- [ ] **Step 3: Update the move.ts header comment**

In `move.ts`, update the "Features deferred to Phase 7" block (lines ~30-34) to remove the "Behavior pipeline ... via `opts.behaviors`" bullet (now implemented) and note where it landed. Leave the "Live drag overlay" and "Cascading children" bullets as-is unless already shipped.

- [ ] **Step 4: Commit**

```bash
git add src/interactions/actions/defaults/move.ts
git commit -m "docs(move): mark the behavior pipeline Phase 7 TODO as shipped"
```

---

## Self-Review Notes

- **Spec coverage:** §1 behavior source → Task 2 Step 4; §2 adapter → Task 1; §3 ctx lifecycle → Task 2 Step 4; §4 onStart → Task 2 Step 4; §5 onMove folding → Task 2 Step 5; §6 onEnd reducer → Task 2 Step 6; §7 consumer surface → Task 3; §8 out-of-scope (chrome/transient) → untouched by design; testing → Tasks 2/3 tests + Task 5 gate; demo → Task 4.
- **Type consistency:** `moveGestureAdapter` / `MoveGestureAdapter` used identically in Task 1 and Task 2. `MoveScratch.{behaviors,gestureCtx,adapter}` defined (Step 3) before use (Steps 4-6). `opts.behaviors` shape matches `BindingOpts.behaviors`.
- **Known verify-points flagged inline:** exact behavior arg names (`snapToGrid`/`snapToContainer`/`snapBackOrDelete`), `SnapTarget` shape, select-tool test harness, demo registry shape, and `wiredMoveOptions` spread — each called out as a "Note for implementer" to confirm against source before running.
