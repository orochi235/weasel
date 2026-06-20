# useScene User-Layer Mutation Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `addLayer` / `removeLayer` / `renameLayer` / `moveLayer` to the kit-owned `Scene`, all auto-undoable, so consumers can build a runtime layers panel.

**Architecture:** Four new methods on the `Scene` object literal in `src/core/scene/scene.ts`, each backed by a new `kit:*` op registered alongside the existing `kit:setLayer*` ops. A new `rebuildLayerIndex()` helper repopulates `state.layerIndex` after any insert/remove/move. `removeLayer` cascade-deletes tagged nodes by reusing the existing `remove()` path inside a `batch()`.

**Tech Stack:** TypeScript, Vitest. Test file: `src/core/scene/scene.test.ts`.

---

## File structure

- **Modify** `src/core/scene/types.ts` — add `AddLayerSpec<TLayer>` interface; add four method signatures to the `Scene` interface.
- **Modify** `src/core/scene/scene.ts` — add `rebuildLayerIndex()` helper, four `kit:*` ops, four method implementations.
- **Modify** `src/core/scene/scene.test.ts` — add a `describe('user-layer mutations')` block.

Context the implementer needs (existing code in `scene.ts`):
- `state.layers: LayerRecord<TLayer>[]` and `state.layerIndex: Map<TLayer, number>` (lines ~33-34). System layers built at lines 88-100.
- `requireLayerIndex(layer)` throws `Scene: unknown layer "<id>"` for an unknown layer (line ~183).
- `assertSubtreeLayer(...)` enforces "a child may not render below its parent's layer" (line ~199).
- Op registration pattern: `registerKitOp<Payload>('kit:foo', { apply, revert })` (e.g. `kit:setLayerVisible` lines 358-361).
- `executeAndLog(kind, payload, label)` runs an op + logs one history entry + notifies (line 375).
- `scene.batch(label, fn)` groups multiple `executeAndLog` calls into one undo entry (used by `setLayer`, line 514).
- `LayerRecord` is `SystemLayerRecord | UserLayerRecord`; `UserLayerRecord` adds `kind: 'user'` + `name: string` (`types.ts` lines 88-107).

---

## Task 1: Types — `AddLayerSpec` and `Scene` signatures

**Files:**
- Modify: `src/core/scene/types.ts`

- [ ] **Step 1: Add `AddLayerSpec` interface**

After the `SystemLayerSpec` interface (around line 132 in `types.ts`), add:

```ts
/** Argument to `Scene.addLayer`. Always produces a `UserLayerRecord`
 *  (`kind: 'user'`). */
export interface AddLayerSpec<TLayer extends string> {
  id: TLayer;
  name: string;
  /** Default `true`. */
  visible?: boolean;
  /** Default `false`. */
  locked?: boolean;
  /** Render-stack position. Default: top of stack (highest render index). */
  index?: number;
}
```

- [ ] **Step 2: Add the four method signatures to the `Scene` interface**

In the `Scene` interface, in the "Mutations (all auto-undoable)" block, immediately after the `setLayerLocked` line (line 214), add:

```ts
  addLayer(spec: AddLayerSpec<TLayer>): void;
  removeLayer(layer: TLayer): void;
  renameLayer(layer: TLayer, name: string): void;
  moveLayer(layer: TLayer, index: number): void;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL — `scene.ts`'s object literal is missing the four new methods (`Property 'addLayer' is missing in type ...`). This confirms the interface is wired; Task 4 fixes it.

- [ ] **Step 4: Commit**

```bash
git add src/core/scene/types.ts
git commit -m "feat(scene): declare AddLayerSpec + user-layer mutation signatures"
```

---

## Task 2: `rebuildLayerIndex` helper + `addLayer`

**Files:**
- Modify: `src/core/scene/scene.ts`
- Test: `src/core/scene/scene.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `scene.test.ts` (new `describe` block at the end of the file). Match the existing test style — `createScene` is imported at the top of the file.

```ts
describe('user-layer mutations', () => {
  const baseOpts = () => ({ systemLayers: [{ id: 'base' as const }] });

  it('addLayer appends a user layer to the top by default', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects' });
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
    const fx = scene.layers[1];
    expect(fx.kind).toBe('user');
    expect(fx.kind === 'user' && fx.name).toBe('Effects');
    expect(fx.visible).toBe(true);
    expect(fx.locked).toBe(false);
  });

  it('addLayer respects an explicit index', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects', index: 0 });
    expect(scene.layers.map((l) => l.id)).toEqual(['fx', 'base']);
  });

  it('addLayer throws on a duplicate id', () => {
    const scene = createScene<{ v: number }, 'base', { x: number }>(baseOpts());
    expect(() => scene.addLayer({ id: 'base', name: 'dupe' })).toThrow(/duplicate/);
  });

  it('addLayer is undoable', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.undo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base']);
    scene.redo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/scene/scene.test.ts -t "user-layer mutations"`
Expected: FAIL — `scene.addLayer is not a function`.

- [ ] **Step 3: Add `rebuildLayerIndex` helper**

In `scene.ts`, after the `requireLayerIndex` function (around line 188), add:

```ts
  /** Repopulate `state.layerIndex` from the current `state.layers` order.
   *  Call after any op that inserts, removes, or reorders a layer record. */
  function rebuildLayerIndex(): void {
    state.layerIndex.clear();
    for (let i = 0; i < state.layers.length; i++) {
      state.layerIndex.set(state.layers[i].id, i);
    }
  }
```

- [ ] **Step 4: Register the `kit:addLayer` op**

In `scene.ts`, after the `kit:setLayerLocked` registration (line 366), add:

```ts
  registerKitOp<{ record: UserLayerRecord<TLayer>; index: number }>('kit:addLayer', {
    apply: (p) => {
      state.layers.splice(p.index, 0, { ...p.record });
      rebuildLayerIndex();
    },
    revert: (p) => {
      state.layers.splice(p.index, 1);
      rebuildLayerIndex();
    },
  });
```

Add `UserLayerRecord` to the existing `import type { ... } from './types'` block at the top of `scene.ts` if not already present.

- [ ] **Step 5: Implement `addLayer`**

In the `scene` object literal, after `setLayerLocked` (line 566), add:

```ts
    addLayer(spec) {
      if (state.layerIndex.has(spec.id)) {
        throw new Error(`Scene: duplicate layer id "${spec.id}"`);
      }
      const index = spec.index ?? state.layers.length;
      const clamped = Math.max(0, Math.min(index, state.layers.length));
      const record: UserLayerRecord<TLayer> = {
        kind: 'user',
        id: spec.id,
        name: spec.name,
        visible: spec.visible ?? true,
        locked: spec.locked ?? false,
      };
      executeAndLog('kit:addLayer', { record, index: clamped }, 'addLayer');
    },
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx vitest run src/core/scene/scene.test.ts -t "user-layer mutations"`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): addLayer + rebuildLayerIndex helper"
```

---

## Task 3: `renameLayer`

**Files:**
- Modify: `src/core/scene/scene.ts`
- Test: `src/core/scene/scene.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe('user-layer mutations')` block:

```ts
  it('renameLayer updates a user layer name and is undoable', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    scene.addLayer({ id: 'fx', name: 'Effects' });
    scene.renameLayer('fx', 'Glow');
    const fx = () => scene.layers.find((l) => l.id === 'fx')!;
    expect(fx().kind === 'user' && fx().name).toBe('Glow');
    scene.undo();
    expect(fx().kind === 'user' && fx().name).toBe('Effects');
  });

  it('renameLayer throws on a system layer', () => {
    const scene = createScene<{ v: number }, 'base', { x: number }>(baseOpts());
    expect(() => scene.renameLayer('base', 'nope')).toThrow(/system/);
  });

  it('renameLayer throws on an unknown layer', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>(baseOpts());
    expect(() => scene.renameLayer('fx', 'nope')).toThrow(/unknown/);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/scene/scene.test.ts -t "renameLayer"`
Expected: FAIL — `scene.renameLayer is not a function`.

- [ ] **Step 3: Register the `kit:renameLayer` op**

In `scene.ts`, after the `kit:addLayer` registration, add:

```ts
  registerKitOp<{ layer: TLayer; from: string; to: string }>('kit:renameLayer', {
    apply: (p) => {
      (state.layers[requireLayerIndex(p.layer)] as UserLayerRecord<TLayer>).name = p.to;
    },
    revert: (p) => {
      (state.layers[requireLayerIndex(p.layer)] as UserLayerRecord<TLayer>).name = p.from;
    },
  });
```

- [ ] **Step 4: Implement `renameLayer`**

In the `scene` object literal, after `addLayer`, add:

```ts
    renameLayer(layer, name) {
      const rec = state.layers[requireLayerIndex(layer)];
      if (rec.kind !== 'user') {
        throw new Error(`Scene: cannot rename system layer "${layer}"`);
      }
      executeAndLog('kit:renameLayer', { layer, from: rec.name, to: name }, 'renameLayer');
    },
```

Note: `requireLayerIndex` already throws `Scene: unknown layer "<id>"`, satisfying the unknown-layer test.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/core/scene/scene.test.ts -t "renameLayer"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): renameLayer"
```

---

## Task 4: `moveLayer` (with subtree-invariant validation)

**Files:**
- Modify: `src/core/scene/scene.ts`
- Test: `src/core/scene/scene.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe('user-layer mutations')` block:

```ts
  it('moveLayer reorders and is undoable', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx' | 'top', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }, { id: 'top' }],
    });
    scene.moveLayer('top', 0);
    expect(scene.layers.map((l) => l.id)).toEqual(['top', 'base', 'fx']);
    scene.undo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx', 'top']);
  });

  it('moveLayer clamps an out-of-range index', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }],
    });
    scene.moveLayer('base', 99);
    expect(scene.layers.map((l) => l.id)).toEqual(['fx', 'base']);
  });

  it('moveLayer throws if the reorder would push a child below its parent', () => {
    // parent on 'base', child on 'fx' (higher). Moving 'fx' below 'base' is illegal.
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }],
    });
    const parent = scene.add({ kind: 'container', layer: 'base', pose: { x: 0 }, data: { v: 1 } });
    scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 }, parent });
    expect(() => scene.moveLayer('fx', 0)).toThrow(/below its parent/);
    // Unchanged after the throw.
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/scene/scene.test.ts -t "moveLayer"`
Expected: FAIL — `scene.moveLayer is not a function`.

- [ ] **Step 3: Register the `kit:moveLayer` op**

In `scene.ts`, after the `kit:renameLayer` registration, add:

```ts
  registerKitOp<{ layer: TLayer; from: number; to: number }>('kit:moveLayer', {
    apply: (p) => {
      const [rec] = state.layers.splice(p.from, 1);
      state.layers.splice(p.to, 0, rec);
      rebuildLayerIndex();
    },
    revert: (p) => {
      const [rec] = state.layers.splice(p.to, 1);
      state.layers.splice(p.from, 0, rec);
      rebuildLayerIndex();
    },
  });
```

- [ ] **Step 4: Implement `moveLayer` with validation**

In the `scene` object literal, after `renameLayer`, add:

```ts
    moveLayer(layer, index) {
      const from = requireLayerIndex(layer);
      const to = Math.max(0, Math.min(index, state.layers.length - 1));
      if (from === to) return;
      // Build the proposed order and a temp index map, then verify the
      // child-below-parent invariant holds for every node under it.
      const proposed = [...state.layers];
      const [rec] = proposed.splice(from, 1);
      proposed.splice(to, 0, rec);
      const tempIndex = new Map<TLayer, number>();
      for (let i = 0; i < proposed.length; i++) tempIndex.set(proposed[i].id, i);
      for (const node of state.nodes.values()) {
        if (node.parent === null) continue;
        const parent = state.nodes.get(node.parent);
        if (!parent) continue;
        if (tempIndex.get(node.layer)! < tempIndex.get(parent.layer)!) {
          throw new Error(
            `Scene: moveLayer("${layer}", ${index}) — a child may not render below its parent's layer`,
          );
        }
      }
      executeAndLog('kit:moveLayer', { layer, from, to }, 'moveLayer');
    },
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/core/scene/scene.test.ts -t "moveLayer"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): moveLayer with subtree-invariant validation"
```

---

## Task 5: `removeLayer` (cascade-delete in one batch)

**Files:**
- Modify: `src/core/scene/scene.ts`
- Test: `src/core/scene/scene.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe('user-layer mutations')` block:

```ts
  it('removeLayer drops the record and cascade-deletes tagged nodes', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }],
    });
    scene.add({ kind: 'leaf', layer: 'base', pose: { x: 0 }, data: { v: 1 } });
    const onFx = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 } });
    scene.removeLayer('fx');
    expect(scene.layers.map((l) => l.id)).toEqual(['base']);
    expect(scene.get(onFx)).toBeUndefined();
    expect(scene.nodes.size).toBe(1);
  });

  it('removeLayer cascade-deletes a subtree that spans layers', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }],
    });
    // container on fx, child on fx too; removing fx kills both.
    const c = scene.add({ kind: 'container', layer: 'fx', pose: { x: 0 }, data: { v: 1 } });
    const child = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 }, parent: c });
    scene.removeLayer('fx');
    expect(scene.get(c)).toBeUndefined();
    expect(scene.get(child)).toBeUndefined();
    expect(scene.nodes.size).toBe(0);
  });

  it('removeLayer is undoable — restores the layer and all its nodes in one step', () => {
    const scene = createScene<{ v: number }, 'base' | 'fx', { x: number }>({
      systemLayers: [{ id: 'base' }, { id: 'fx' }],
    });
    const a = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 0 }, data: { v: 1 } });
    const b = scene.add({ kind: 'leaf', layer: 'fx', pose: { x: 1 }, data: { v: 2 } });
    scene.removeLayer('fx');
    scene.undo();
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'fx']);
    expect(scene.get(a)).toBeDefined();
    expect(scene.get(b)).toBeDefined();
  });

  it('removeLayer throws on a system layer', () => {
    const scene = createScene<{ v: number }, 'base', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    expect(() => scene.removeLayer('base')).toThrow(/system/);
  });

  it('removeLayer keeps layerIndex consistent for surviving layers', () => {
    // 'mid' and 'top' are user layers (added at runtime) so removeLayer is legal.
    const scene = createScene<{ v: number }, 'base' | 'mid' | 'top', { x: number }>({
      systemLayers: [{ id: 'base' }],
    });
    scene.addLayer({ id: 'mid', name: 'Mid' }); // index 1
    scene.addLayer({ id: 'top', name: 'Top' }); // index 2
    const node = scene.add({ kind: 'leaf', layer: 'top', pose: { x: 0 }, data: { v: 1 } });
    scene.removeLayer('mid'); // layers -> [base, top]; 'top' shifts index 2 -> 1
    expect(scene.layers.map((l) => l.id)).toEqual(['base', 'top']);
    // requireLayerIndex must resolve 'top' to its new slot for later mutations.
    scene.setLayerVisible('top', false);
    expect(scene.layers.find((l) => l.id === 'top')!.visible).toBe(false);
    expect(scene.get(node)!.layer).toBe('top');
  });

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/core/scene/scene.test.ts -t "removeLayer"`
Expected: FAIL — `scene.removeLayer is not a function`.

- [ ] **Step 3: Register the `kit:removeLayer` op**

In `scene.ts`, after the `kit:moveLayer` registration, add. This op covers **only** the layer record; the node deletions ride the existing `kit:remove` ops emitted in the same batch.

```ts
  registerKitOp<{ record: LayerRecord<TLayer>; index: number }>('kit:removeLayer', {
    apply: (p) => {
      state.layers.splice(p.index, 1);
      rebuildLayerIndex();
    },
    revert: (p) => {
      state.layers.splice(p.index, 0, { ...p.record } as LayerRecord<TLayer>);
      rebuildLayerIndex();
    },
  });
```

Add `LayerRecord` to the `import type { ... } from './types'` block in `scene.ts` if not already imported (it is imported — confirm).

- [ ] **Step 4: Implement `removeLayer`**

In the `scene` object literal, after `moveLayer`, add:

```ts
    removeLayer(layer) {
      const index = requireLayerIndex(layer);
      const rec = state.layers[index];
      if (rec.kind !== 'user') {
        throw new Error(`Scene: cannot remove system layer "${layer}"`);
      }
      scene.batch('removeLayer', () => {
        // Cascade-delete every node tagged to this layer. Each remove() cascades
        // its subtree, so repeatedly pull any still-present tagged node until
        // none remain — this naturally avoids double-removing a node already
        // dropped as a descendant of an earlier removal.
        for (;;) {
          let next: NodeId | undefined;
          for (const [id, node] of state.nodes) {
            if (node.layer === layer) { next = id; break; }
          }
          if (next === undefined) break;
          scene.remove(next);
        }
        // Re-resolve the index — node removals don't touch the layers array,
        // but resolve fresh to be safe before splicing the record.
        const finalIndex = requireLayerIndex(layer);
        executeAndLog('kit:removeLayer', { record: rec, index: finalIndex }, 'removeLayer');
      });
    },
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/core/scene/scene.test.ts -t "removeLayer"`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): removeLayer with cascade-delete in one batch"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole package**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The Task 1 missing-method errors are now resolved.

- [ ] **Step 2: Run the full scene suite**

Run: `npx vitest run src/core/scene/scene.test.ts`
Expected: PASS — all pre-existing tests plus the new `user-layer mutations` block.

- [ ] **Step 3: Run the prepublish gate** (per repo convention before any push)

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Update the TODO**

In `docs/TODO.md`, remove the "User-layer mutation methods (`addLayer`/`removeLayer`/`renameLayer`/`moveLayer`)" bullet from the `### useScene follow-ups` block (line ~163) and from the High-priority index (line ~39).

- [ ] **Step 5: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): close out useScene user-layer mutation methods"
```

---

## Self-review notes

- **Spec coverage:** all four methods (Tasks 2-5), undoability (undo/redo tests each task), system-layer gating (rename Task 3, remove Task 5), duplicate-id (Task 2), moveLayer invariant (Task 4), cascade-delete + span-layers (Task 5), `rebuildLayerIndex` (Task 2, exercised by 3/4/5), `AddLayerSpec` export + `Scene` signatures (Task 1), TODO update (Task 6).
- **Type consistency:** op kinds `kit:addLayer` / `kit:removeLayer` / `kit:renameLayer` / `kit:moveLayer`; helper `rebuildLayerIndex`; spec type `AddLayerSpec<TLayer>` — used identically across tasks.
