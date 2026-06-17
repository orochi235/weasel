# Layout-drop local-pose migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make weasel's layout-drop subsystem (`runLayoutPass` + the layout-drop commit in `move.ts`) correct under hierarchical local-pose scene semantics, so cross-container drag reparents *and* positions children correctly at any container origin / nesting depth.

**Architecture:** The `LayoutStrategy` callback contract stays **world in, world out** (no consumer change). The kit composes scene poses to world before calling strategy callbacks, and rebases world→local on the way out — into `scratch.previews` and into the committed transform ops — using the same `composeWorldPose`/`rebaseLocalPose` helpers `applyReparent` already uses.

**Tech Stack:** TypeScript, Vitest. All work is in `~/src/weasel`. Spec: `docs/superpowers/specs/2026-06-17-layout-drop-local-pose-migration-design.md`.

---

## File structure

- **Modify** `src/interactions/actions/defaults/move.ts`
  - `runLayoutPass` (lines ~92–205): compose strategy inputs to world; rebase reflow folds to local for previews; store world poses in `sourceReflow`.
  - Layout-drop commit block (lines ~587–628): build the commit `draggedArg` in world; rebase every `transform` op from `commitDrop` to local; rebase `sourceReflow` ops to local.
- **Modify** `src/interactions/actions/defaults/move.layout.test.ts`
  - Add regression tests (non-origin source; correct local drop pose; nested destination).
  - Convert the existing cross-container stub from absolute to true local poses.

All helpers are already imported in `move.ts`: `composeWorldPose`, `composeRectPose`, `rebaseLocalPose`, `decomposeRectPose`, `RectPose` (lines ~61–63), `createTransformOp` (line ~45/615 usage), `scenePoseAdapter` (line ~218), `asNodeId`. Confirm before adding new imports.

Run tests with: `cd ~/src/weasel && npx vitest run src/interactions/actions/defaults/move.layout.test.ts`

---

### Task 1: Failing test — gate must find a destination from a non-origin source container

**Files:**
- Test: `src/interactions/actions/defaults/move.layout.test.ts`

- [ ] **Step 1: Add the failing test** (append inside the `describe('moveAction layout reflow', …)` block)

```ts
  it('finds the destination when the source container is not at world origin', () => {
    // Source C at world {40,40} holds child a (LOCAL {0,0}); destination D at
    // world {200,0} holds d1 (LOCAL {0,0}). Pre-migration draggedCenter is
    // computed in C-local space, so it never lands inside D's world bounds —
    // the drag falls through to a translate-only commit (no reparent op,
    // appliedBatches stays empty).
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a world center starts at {40+25, 40+50} = {65,90}. delta {160,-40} puts
    // the world center at {225,50}, inside D's first cell.
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    expect(scene.appliedBatches.length).toBe(1);
    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
  });
```

- [ ] **Step 2: Run to verify it FAILS**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts -t "not at world origin"`
Expected: FAIL — `appliedBatches.length` is `0` (the layout pass never found `D`, so the gesture fell through to the translate-only commit which doesn't call `applyBatch`). This red proves Defect 1.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/interactions/actions/defaults/move.layout.test.ts
git commit -m "test(layout): failing regression — gate misses dest from non-origin source

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migrate `runLayoutPass` inputs to world (fix the gate)

**Files:**
- Modify: `src/interactions/actions/defaults/move.ts` (`runLayoutPass`, lines ~92–205)

- [ ] **Step 1: World-compose the dragged preview** — replace the head of `runLayoutPass` (the block from `const draggedPose = scratch.previews.get(draggedId);` through the `draggedCenter` assignment):

```ts
  const poseAdapter = scenePoseAdapter(scene);
  const sourceContainerId = scene.get(draggedId)?.parent ?? null;
  if (!scene.get(draggedId)) return;
  const { dx, dy } = scratch.currentDelta;
  // Dragged preview in WORLD: compose the committed start pose up the parent
  // chain, then add the world drag delta (same math as `applyReparent`). The
  // LayoutStrategy contract is world-framed, so every pose handed to it below
  // is composed to world; reflow results are rebased back to local.
  const startWorld = composeWorldPose(poseAdapter, draggedId as string, composeRectPose);
  const draggedWorld: RectPose = { ...startWorld, x: startWorld.x + dx, y: startWorld.y + dy };
  const draggedCenter = {
    x: draggedWorld.x + (draggedWorld.width ?? 0) / 2,
    y: draggedWorld.y + (draggedWorld.height ?? 0) / 2,
  };
```

- [ ] **Step 2: World-compose candidate container bounds** — in `consider`, replace the `testInside(node.pose, layout)` guard + `bounds: node.pose …` push:

```ts
    const node = scene.get(id);
    if (!node) return;
    const worldBounds = composeWorldPose(poseAdapter, id as string, composeRectPose);
    if (!testInside(worldBounds, layout)) return;
    candidates.push({
      id,
      bounds: worldBounds as { x: number; y: number; width: number; height: number },
      layout,
      zPath,
      depth: zPath.length,
    });
```

- [ ] **Step 3: World-compose children + dragged arg** — replace the `children` map and `draggedArg` (lines ~160–168):

```ts
  const children: LayoutChild<unknown>[] = scene.childrenOf(dest.id)
    .filter((cid) => cid !== draggedId || sourceContainerId === (dest!.id as string))
    .map((cid) => ({
      id: cid as string,
      pose: composeWorldPose(poseAdapter, cid as string, composeRectPose),
    }));
  const draggedArg = {
    id: draggedId as string,
    originPose: startWorld,
    pose: draggedWorld,
    sourceContainerId,
  };
```

- [ ] **Step 4: Rebase destination reflow → local before folding into previews** — replace the destination reflow loop (lines ~173–177):

```ts
  // Destination reflow → fold into previews (skip the dragged id itself).
  // `reflowPoses` returns world; previews are local (substituted for
  // node.pose and composed through the parent chain), so rebase to the
  // child's current parent frame first.
  for (const [cid, pose] of layout.reflowPoses(container, children, draggedArg, target)) {
    if (asNodeId(cid) === draggedId) continue;
    const parent = scene.get(asNodeId(cid))?.parent ?? null;
    const local = rebaseLocalPose(poseAdapter, pose as RectPose, parent, composeRectPose, decomposeRectPose);
    scratch.previews.set(asNodeId(cid), local);
  }
```

- [ ] **Step 5: World-compose source reflow; store world in `sourceReflow`, rebase for previews** — replace the source-reflow block body (lines ~184–201, inside `if (srcLayout && srcNode)`):

```ts
      const srcContainer: LayoutContainer = {
        id: sourceContainerId,
        bounds: composeWorldPose(poseAdapter, sourceContainerId, composeRectPose) as { x: number; y: number; width: number; height: number },
      };
      const srcChildren: LayoutChild<unknown>[] = scene.childrenOf(asNodeId(sourceContainerId))
        .filter((cid) => cid !== draggedId)
        .map((cid) => ({
          id: cid as string,
          pose: composeWorldPose(poseAdapter, cid as string, composeRectPose),
        }));
      for (const [cid, pose] of srcLayout.childPoses(srcContainer, srcChildren)) {
        const cur = composeWorldPose(poseAdapter, cid, composeRectPose) as Record<string, unknown>;
        const next = pose as Record<string, unknown>;
        const same = cur.x === next.x && cur.y === next.y
          && cur.width === next.width && cur.height === next.height;
        if (same) continue;
        sourceReflow.set(cid, pose); // WORLD — rebased at each consumption point
        const parent = scene.get(asNodeId(cid))?.parent ?? null;
        scratch.previews.set(asNodeId(cid), rebaseLocalPose(poseAdapter, pose as RectPose, parent, composeRectPose, decomposeRectPose));
      }
```

- [ ] **Step 6: Run Task 1's test — expect PASS**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts -t "not at world origin"`
Expected: PASS — the gate composes `a` to world `{40,40}+delta`, lands center `{225,50}` inside `D`'s world bounds, and emits `reparent(a→D)`.

- [ ] **Step 7: Run the whole layout test file — expect all green**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts`
Expected: PASS (4 prior tests + the new one). The 3 prior tests use at-origin source containers, so world == local for their dragged nodes and behavior is unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/interactions/actions/defaults/move.ts
git commit -m "fix(layout): compose runLayoutPass strategy inputs to world

Gate + strategy callbacks now receive world poses (dragged center,
container bounds, children); reflow results rebased to local before
folding into previews. Fixes cross-container drag missing the
destination when the source container isn't at world origin.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Failing test — dropped child must land at the destination-local pose

**Files:**
- Test: `src/interactions/actions/defaults/move.layout.test.ts`

- [ ] **Step 1: Widen the `AppliedBatch` op type to expose `to`** — in the `AppliedBatch` interface, change the `ops` element type so the transform pose is readable:

```ts
interface AppliedBatch {
  ops: { name?: string; id?: string; label?: string; args?: { id?: string; toParentId?: string | null; to?: P } }[];
  label: string;
}
```

- [ ] **Step 2: Add the failing test** (append inside the describe block)

```ts
  it('writes the dropped child pose LOCAL to the destination container', () => {
    // Same geometry as the non-origin-source test: D at world {200,0}. The
    // snapped cell is D's cell 0 at world {200,0}. Because the scene stores
    // local poses, the committed pose must be {0,0} (local to D), which
    // composes back to the world cell. Pre-commit-migration the transform
    // writes the world pose {200,0} → wrong.
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    expect(drop!.args?.to).toMatchObject({ x: 0, y: 0 });
  });
```

- [ ] **Step 3: Run to verify it FAILS**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts -t "LOCAL to the destination"`
Expected: FAIL — `drop.args.to` is `{ x: 200, y: 0 }` (the world cell, written verbatim). This red proves Defect 2.

- [ ] **Step 4: Commit the failing test**

```bash
git add src/interactions/actions/defaults/move.layout.test.ts
git commit -m "test(layout): failing regression — drop pose must be destination-local

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rebase the layout-drop commit poses to local

**Files:**
- Modify: `src/interactions/actions/defaults/move.ts` (layout-drop commit block, lines ~589–627)

- [ ] **Step 1: Build the commit `draggedArg` in world** — replace the `draggedArg` construction (lines ~592–597):

```ts
            const draggedId = scratch.ids[0];
            const commitAdapter = scenePoseAdapter(scratch.scene);
            const startWorld = composeWorldPose(commitAdapter, draggedId as string, composeRectPose);
            const sourceContainerId = scratch.scene.get(draggedId)?.parent ?? null;
            const draggedArg = {
              id: draggedId as string,
              originPose: startWorld,
              pose: { ...startWorld, x: startWorld.x + dx, y: startWorld.y + dy } as RectPose,
              sourceContainerId,
            };
```

- [ ] **Step 2: Rebase every transform op from `commitDrop` to local** — replace the `const dropOps = lp.layout.commitDrop(...)` line with a mapped version that rebases:

```ts
            const destId = lp.container.id;
            // commitDrop returns world poses (the contract is world in/out).
            // Rebase each transform op to local: the dragged id lands under the
            // destination container; any other id keeps its current parent.
            // `from` rebases under the node's PRE-commit parent (the batch
            // applies reparent before the transform, but we pre-bake the local
            // value here and op.apply just setPose's it).
            const rebaseOpToLocal = (op: Op): Op => {
              if (op.name !== 'transform') return op;
              const a = op.args as { id: string; from: RectPose; to: RectPose; label?: string; coalesceKey?: string };
              const curParent = scratch.scene.get(asNodeId(a.id))?.parent ?? null;
              const toParent = a.id === (draggedId as string) ? destId : curParent;
              return createTransformOp<RectPose>({
                id: a.id,
                from: rebaseLocalPose(commitAdapter, a.from, curParent, composeRectPose, decomposeRectPose),
                to: rebaseLocalPose(commitAdapter, a.to, toParent, composeRectPose, decomposeRectPose),
                label: a.label,
                coalesceKey: a.coalesceKey,
              });
            };
            const dropOps = lp.layout.commitDrop(lp.container, lp.children, draggedArg, lp.target).map(rebaseOpToLocal);
```

- [ ] **Step 3: Rebase the source-reflow ops to local** — replace the `for (const [cid, pose] of lp.sourceReflow)` loop (lines ~613–621):

```ts
            const reflowOps: Op[] = [];
            for (const [cid, worldPose] of lp.sourceReflow) {
              const parent = scratch.scene.get(asNodeId(cid))?.parent ?? null;
              reflowOps.push(createTransformOp<RectPose>({
                id: cid,
                from: scratch.scene.get(asNodeId(cid))!.pose as RectPose,
                to: rebaseLocalPose(commitAdapter, worldPose as RectPose, parent, composeRectPose, decomposeRectPose),
                label: 'Source reflow',
              }));
            }
```

- [ ] **Step 4: Run Task 3's test — expect PASS**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts -t "LOCAL to the destination"`
Expected: PASS — `drop.args.to` is now `{ x: 0, y: 0 }`.

- [ ] **Step 5: Run the whole file — expect all green**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts`
Expected: PASS. The existing cross-container test asserts op presence/ordering (not pose values), so the added rebase doesn't disturb it.

- [ ] **Step 6: Commit**

```bash
git add src/interactions/actions/defaults/move.ts
git commit -m "fix(layout): rebase layout-drop commit poses to local

The layout-drop commit ran the strategy in world but wrote world poses
into a local-pose scene. Rebase every transform op from commitDrop
(dragged id under the destination, others under their current parent)
and the source-reflow ops to local. Fixes cross-container drops landing
at the wrong absolute position under non-origin/nested containers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Convert the existing absolute stub to local + add a nested-destination regression

**Files:**
- Test: `src/interactions/actions/defaults/move.layout.test.ts`

- [ ] **Step 1: Convert the existing cross-container stub to a true local pose** — in the test titled `'emits a reparent op before the drop on a cross-container grid drag'`, change `d1` from the absolute `{ x: 200, … }` to local `{ x: 0, … }` (it is a child of `D`, which is at world `{200,0}`):

```ts
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
```

- [ ] **Step 2: Run that test — expect PASS**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts -t "cross-container grid drag"`
Expected: PASS — assertions are about op presence/ordering; the now-correct local representation of `d1` doesn't change them.

- [ ] **Step 3: Add the nested-destination regression test** (append inside the describe block)

```ts
  it('lands a drop into a NESTED destination at the correct world position', () => {
    // Outer O at world {100,0} (no layout). Destination D nested under O at
    // LOCAL {50,0} → world {150,0}, holding d1 (local {0,0}). Source C at world
    // {0,0} holds a (local {0,0}). Dragging a into D's cell 0 (world {150,0})
    // must reparent a → D and write a's pose LOCAL to D ({0,0}), guarding the
    // rebase direction (D's world origin ≠ its local pose).
    const scene = makeScene(
      {
        O: { x: 100, y: 0, width: 200, height: 100 },
        D: { x: 50, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
      },
      { O: null, D: 'O', d1: 'D', C: null, a: 'C' },
      { O: ['D'], D: ['d1'], C: ['a'] },
      ['O', 'C'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid }; // O has no layout
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a world center {25,50}; delta {150,0} → world center {175,50}, inside D's
    // cell 0 (world {150,0,50,100}).
    const drag = { start: { x: 25, y: 50 }, current: { x: 175, y: 50 }, delta: { x: 150, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    expect(drop!.args?.to).toMatchObject({ x: 0, y: 0 }); // local to D; world = {150,0}
  });
```

- [ ] **Step 4: Run the whole file — expect all green**

Run: `npx vitest run src/interactions/actions/defaults/move.layout.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Run the broader move suite for regressions**

Run: `npx vitest run src/interactions/actions/defaults/move.test.ts src/interactions/actions/defaults/move.behaviors.integration.test.ts`
Expected: PASS. If any fail, investigate before continuing — these exercise non-layout move and should be unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/interactions/actions/defaults/move.layout.test.ts
git commit -m "test(layout): local-pose stubs + nested-destination drop regression

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verify against eric end-to-end

**Files:** none (verification only). Eric builds against this weasel checkout via symlink.

- [ ] **Step 1: Typecheck + full weasel test run**

Run: `cd ~/src/weasel && npx tsc --noEmit && npx vitest run`
Expected: clean typecheck; full suite green (or only pre-existing unrelated failures from the dirty working tree — diff against the baseline if unsure).

- [ ] **Step 2: Eric typecheck + layout-related tests**

Run: `cd ~/src/eric && npx tsc --noEmit && npx vitest run src/canvas/adapters/plantingLayout.test.ts src/canvas/tools/snapMoveBehaviors.test.ts`
Expected: clean. `plantingLayout` is world-native and unchanged; these confirm the consumer still type-checks and its layout tests pass against the migrated kit.

- [ ] **Step 3 (manual, optional but recommended): drag a planting across containers in the eric app** and confirm it (a) reparents and (b) lands at the cursor cell — including when the source/destination structure is not at the garden origin. Use the project's `/run` flow.

---

## Notes / observations for the implementer

- **Pre-existing double-reparent (out of scope, flag it):** eric's `plantingLayout.commitDrop` pushes its *own* `createReparentOp`, and the kit's layout-drop commit (move.ts:603–612) *also* pushes a reparent op for the same node. That redundancy predates this work and isn't this plan's target. If Task 6's manual check shows a double-reparent throwing or misbehaving, the clean fix is to drop the reparent op from eric's `commitDrop` (the kit owns reparent) — handle as a separate eric-side change, not here.
- **`from` vs `to` parent frames in the rebase (Task 4 Step 2):** `from` is the node's pose *before* the gesture, so it rebases under the node's *current* (pre-reparent) parent; `to` is *after*, so the dragged id rebases under the destination. This keeps op inversion (undo) correct.
- **Why `sourceReflow` stores world (Task 2 Step 5):** it's the single canonical frame for the `LayoutPass` record; both consumers (preview fold, commit) rebase from it under each child's parent, so there's no frame ambiguity in the record itself.

## Self-review

- **Spec coverage:** Defect 1 (gate) → Tasks 1–2. Defect 2 (commit) → Tasks 3–4. World-contract decision (rebase all transform ops) → Task 4 Step 2. Test plan (rewrite absolute stubs, non-origin + nested regressions) → Tasks 1, 3, 5. Eric world-native / no consumer change → Task 6. Covered.
- **Placeholder scan:** none — every step has concrete code/commands and expected output.
- **Type consistency:** `composeWorldPose`, `rebaseLocalPose`, `composeRectPose`, `decomposeRectPose`, `RectPose`, `createTransformOp`, `scenePoseAdapter`, `asNodeId` are the names used in `move.ts` today (verified against lines 61–63, 218, 615). `AppliedBatch.ops[].args.to` is added in Task 3 Step 1 before first use in Task 3 Step 2. `commitAdapter`/`poseAdapter` are distinct locals in their respective scopes.
