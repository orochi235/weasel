# Scene Serialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `scene.toJSON()` and `sceneFromJSON(json, options)` for snapshot + restore round-trip of the Scene primitive. Function fields like `ContainerNode.clipFromPose` are externalized via a per-scene registry mapping string keys to live functions.

**Architecture:** All work is inside `src/core/scene/`. Type definitions in `types.ts`. Registry threading + `toJSON` + `sceneFromJSON` in `scene.ts`. The JSON shape is the flat `useScene({ initial })` shape with function-field keys swapped in for function references. `sceneFromJSON` resolves keys via the registry, then delegates to `createScene({ ..., initial: resolved, registry })` — the existing `options.initial` loader handles cross-layer validation and `pendingClipPatches` population for undo/redo correctness.

**Tech Stack:** TypeScript, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-11-scene-serialization-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/scene/types.ts` | Modify | Add `SerializedScene`, `SerializedNode`, `SceneRegistry` types; add `registry?` to `UseSceneOptions`; add `toJSON` to `Scene` interface |
| `src/core/scene/scene.ts` | Modify | Build reverse registry at createScene time; implement `toJSON` and `sceneFromJSON` |
| `src/core/scene/index.ts` | Modify | Re-export `sceneFromJSON` and the new types |
| `src/core/scene/scene.test.ts` | Modify | Tests for registry threading, toJSON, sceneFromJSON, round-trip |

Note: the spec's prose used `Scene.fromJSON()` for ergonomic illustration. The actual export is a module-level function `sceneFromJSON(json, options)`, matching the existing `createScene` convention (the `Scene` interface has no statics).

---

## Task 1: Types and registry threading

**Files:**
- Modify: `src/core/scene/types.ts`
- Modify: `src/core/scene/scene.ts`
- Modify: `src/core/scene/scene.test.ts`

Add the JSON type definitions. Thread an optional `registry` through `UseSceneOptions` → `createScene`. Build reverse-lookup maps (function → key) at construction time for use by `toJSON` in Task 2. No serialization behavior yet — this task is foundation only.

- [ ] **Step 1: Read existing types**

Read `src/core/scene/types.ts` (specifically `UseSceneOptions`, `SystemLayerSpec`, `Scene`, `AddNodeSpec`, `Node`, `ContainerNode`). Read `src/core/scene/scene.ts` (specifically the `createScene` function signature, where systemLayers is iterated, and where `patchClipFromPose` is defined). Read `src/features/paths/types.ts` for the `Path` type. The implementation will need to import `Path` into `types.ts` (it may already be imported if Phase 2 added it).

- [ ] **Step 2: Add the JSON and registry types to `types.ts`**

Add these exports to `src/core/scene/types.ts`. The existing `SystemLayerSpec<TLayer>` already carries `{ id, visible?, locked? }` — reuse it directly in `SerializedScene.systemLayers` rather than adding a parallel `SerializedLayer` type.

```ts
/** JSON-serializable shape of a Scene's current state. Produced by
 *  `scene.toJSON()`; consumed by `sceneFromJSON()`. Function fields
 *  (e.g., `clipFromPose`) appear as string keys (`clipFromPoseKey`) and
 *  are resolved through `SceneRegistry` at load time. */
export interface SerializedScene<TData, TLayer extends string, TPose> {
  version: 1;
  systemLayers: readonly SystemLayerSpec<TLayer>[];
  nodes: readonly SerializedNode<TData, TLayer, TPose>[];
}

/** JSON-serializable shape of a single node. Mirrors `AddNodeSpec` but
 *  with function fields replaced by registry keys. */
export interface SerializedNode<TData, TLayer extends string, TPose> {
  id: string;
  kind: 'leaf' | 'container';
  layer: TLayer;
  pose: TPose;
  data: TData;
  /** Parent id; omitted for roots. */
  parent?: string;
  /** Registry key for the container's clip-path factory.
   *  Containers only; omitted when the container has no clip. */
  clipFromPoseKey?: string;
  // Future function-field keys (drawOneKey, layoutStrategyKey, etc.) will live here.
}

/** Per-scene registry mapping string keys to live function references.
 *  Passed to `createScene({ ..., registry })` and `sceneFromJSON(json, { registry })`.
 *  Each function-field type has its own keyed map. */
export interface SceneRegistry<TPose> {
  /** Maps registry keys to `clipFromPose` factory functions for container nodes. */
  clipFromPose?: Readonly<Record<string, (pose: TPose) => import('../../features/paths/types').Path | null>>;
  // Reserved for future function fields.
}
```

(If `Path` is already imported at the top of `types.ts`, drop the inline `import(...)` and reference the imported name. Read the existing imports.)

Then extend `UseSceneOptions`:

```ts
export interface UseSceneOptions<TData, TLayer extends string, TPose = RectPose> {
  systemLayers: readonly SystemLayerSpec<TLayer>[];
  initial?: readonly AddNodeSpec<TData, TLayer, TPose>[];
  ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
  historyLimit?: number;
  generateId?: () => NodeId;
  /** Per-scene registry for non-serializable function fields (clipFromPose, etc.).
   *  Required only when serializing/deserializing scenes that use function fields. */
  registry?: SceneRegistry<TPose>;   // NEW
}
```

- [ ] **Step 3: Write the failing test**

Add to `src/core/scene/scene.test.ts`:

```ts
it('createScene accepts an optional registry option', () => {
  const scene = createScene<{ label: string }, 'structures', Pose>({
    systemLayers: [{ id: 'structures' }],
    registry: {
      clipFromPose: {
        'ellipse': (_pose) => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }),
      },
    },
  });
  // No public getter for the registry; we'll test it indirectly via toJSON
  // in Task 2. For now, just confirm the option doesn't break construction.
  expect(scene).toBeDefined();
});
```

- [ ] **Step 4: Run to verify it passes (the registry is currently ignored, so it shouldn't break)**

```
npx vitest run src/core/scene/scene.test.ts -t "createScene accepts an optional registry"
```

Expected: PASS (TypeScript may complain that `registry` isn't recognized — that's the failure we fix next).

If the test fails to compile because `registry` isn't on `UseSceneOptions`, that's the expected failure for this step.

- [ ] **Step 5: Wire `registry` into the createScene closure**

In `src/core/scene/scene.ts`, after the existing variable declarations (around line 78 where `historyLimit` is read), capture the registry and build reverse-lookup maps:

```ts
// Per-scene registry for non-serializable function fields. The forward map
// (key -> function) is used by sceneFromJSON; the reverse map (function ->
// key) is used by toJSON to identify which factory a container is using.
const registry = options.registry ?? {};
const reverseClipFromPose = new Map<
  NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>,
  string
>();
if (registry.clipFromPose) {
  for (const [key, fn] of Object.entries(registry.clipFromPose)) {
    reverseClipFromPose.set(fn, key);
  }
}
```

Place this in the same area where `pendingClipPatches` is declared (the Scene-internal state block).

- [ ] **Step 6: Run the test again**

```
npx vitest run src/core/scene/scene.test.ts -t "createScene accepts an optional registry"
```

Expected: PASS, both at the TypeScript level and at runtime.

- [ ] **Step 7: Run the full scene test file**

```
npx vitest run src/core/scene/scene.test.ts
```

Expected: ALL PASS — the new option is optional; existing tests are unaffected.

- [ ] **Step 8: Typecheck**

```
npx tsc --noEmit
```

Expected: clean (any pre-existing rich-text-related errors on the branch are unrelated and should match the prior baseline).

- [ ] **Step 9: Commit**

```bash
git add src/core/scene/types.ts src/core/scene/scene.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): types and registry threading for serialization"
```

---

## Task 2: `scene.toJSON()`

**Files:**
- Modify: `src/core/scene/types.ts` (add `toJSON` to the `Scene` interface)
- Modify: `src/core/scene/scene.ts` (implement `toJSON`)
- Modify: `src/core/scene/scene.test.ts`

Implement `toJSON` on the Scene. Walks `renderOrder`, projects each node, captures layer state, looks up `clipFromPose` functions in the reverse registry to emit `clipFromPoseKey`. Throws on a container whose `clipFromPose` isn't in the registry.

- [ ] **Step 1: Write failing tests**

Add to `src/core/scene/scene.test.ts`:

```ts
describe('scene.toJSON', () => {
  it('captures a flat scene with no parents', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const json = scene.toJSON();
    expect(json.version).toBe(1);
    expect(json.systemLayers.map((l) => l.id)).toEqual(['structures', 'plantings']);
    expect(json.nodes).toHaveLength(2);
    expect(json.nodes[0]).toMatchObject({ id: a, kind: 'leaf', layer: 'structures', pose: POSE });
    expect(json.nodes[1]).toMatchObject({ id: b, kind: 'leaf', layer: 'structures', pose: POSE });
    expect(json.nodes[0].parent).toBeUndefined();
  });

  it('captures parent ids for nested subtrees', () => {
    const scene = makeScene();
    const bed = scene.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    const json = scene.toJSON();
    const plantNode = json.nodes.find((n) => n.id === plant)!;
    expect(plantNode.parent).toBe(bed);
  });

  it('captures layer visible=false and locked=true; omits defaults', () => {
    const scene = makeScene();
    scene.setLayerVisible('structures', false);
    scene.setLayerLocked('plantings', true);
    const json = scene.toJSON();
    const s = json.systemLayers.find((l) => l.id === 'structures')!;
    const p = json.systemLayers.find((l) => l.id === 'plantings')!;
    expect(s.visible).toBe(false);
    expect(s.locked).toBeUndefined();
    expect(p.visible).toBeUndefined();
    expect(p.locked).toBe(true);
  });

  it('preserves layer-major DFS preorder in nodes array', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'b' } });
    const c = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'c' } });
    const json = scene.toJSON();
    // Layer order: structures first, then plantings. Within structures: a, c.
    expect(json.nodes.map((n) => n.id)).toEqual([a, c, b]);
  });

  it('writes clipFromPoseKey when the factory is in the registry', () => {
    const factory = (_pose: Pose) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const scene = createScene<Data, 'structures' | 'plantings', Pose>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const bed = scene.add({
      kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: factory,
    });
    const json = scene.toJSON();
    const bedNode = json.nodes.find((n) => n.id === bed)!;
    expect(bedNode.clipFromPoseKey).toBe('ellipse');
  });

  it('throws when a container has clipFromPose but no matching registry key', () => {
    const scene = createScene<Data, 'structures', Pose>({
      systemLayers: [{ id: 'structures' }],
      registry: {},  // intentionally empty
    });
    scene.add({
      kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: () => ({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 }),
    });
    expect(() => scene.toJSON()).toThrow(/no matching registry key/);
  });

  it('omits clipFromPoseKey for containers without clipFromPose', () => {
    const scene = makeScene();
    const bed = scene.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const json = scene.toJSON();
    const bedNode = json.nodes.find((n) => n.id === bed)!;
    expect(bedNode.clipFromPoseKey).toBeUndefined();
  });
});
```

- [ ] **Step 2: Add `toJSON` to the Scene interface**

In `src/core/scene/types.ts`, extend the `Scene` interface (alongside the other methods):

```ts
export interface Scene<TData, TLayer extends string, TPose = RectPose> {
  // ... existing reads and mutations ...

  /** Snapshot the current scene state to a JSON-serializable shape.
   *  History (undo/redo stacks) is NOT captured. Function fields like
   *  `ContainerNode.clipFromPose` are translated to string keys via the
   *  scene's registry; throws if any function field has no matching key. */
  toJSON(): SerializedScene<TData, TLayer, TPose>;

  // ... rest ...
}
```

Order it near other read-style methods (after `renderOrder()`). Read the surrounding code for placement.

- [ ] **Step 3: Run tests to verify failure**

```
npx vitest run src/core/scene/scene.test.ts -t "scene.toJSON"
```

Expected: FAIL — `toJSON` is on the interface but the implementation doesn't exist yet.

- [ ] **Step 4: Implement `toJSON`**

In `src/core/scene/scene.ts`, add the method to the returned `scene` object. Place it near the other read methods (`renderOrder`, `get`, etc.). It belongs in the same object literal that defines `add`, `move`, etc. — read where those live.

```ts
toJSON(): SerializedScene<TData, TLayer, TPose> {
  const nodes: SerializedNode<TData, TLayer, TPose>[] = [];
  for (const id of this.renderOrder()) {
    const n = state.nodes.get(id);
    if (!n) continue;
    const out: SerializedNode<TData, TLayer, TPose> = {
      id,
      kind: n.kind,
      layer: n.layer,
      pose: n.pose,
      data: n.data,
    };
    if (n.parent != null) out.parent = n.parent;
    if (n.kind === 'container' && n.clipFromPose) {
      const key = reverseClipFromPose.get(n.clipFromPose);
      if (!key) {
        throw new Error(
          `Scene.toJSON: container '${id}' has clipFromPose but no matching registry key. ` +
          `The function must be registered via createScene's registry option to round-trip.`
        );
      }
      out.clipFromPoseKey = key;
    }
    nodes.push(out);
  }
  // Capture layer state — omit fields that match defaults.
  const systemLayers = state.layers.map((l) => {
    const layer: SystemLayerSpec<TLayer> = { id: l.id };
    if (l.visible === false) layer.visible = false;
    if (l.locked === true) layer.locked = true;
    return layer;
  });
  return { version: 1, systemLayers, nodes };
},
```

(If `this.renderOrder()` doesn't resolve due to scoping — the methods may not have `this` bound to scene — use the same iteration that `renderOrder` uses internally, or extract a private helper. Read the existing code to choose. The simplest fix is usually to capture the `scene` reference: many scene methods access internal state via closure rather than `this`.)

- [ ] **Step 5: Re-export `SerializedScene` / `SerializedNode` types**

In `src/core/scene/index.ts`, add:

```ts
export type {
  SerializedScene,
  SerializedNode,
  SceneRegistry,
  // ... existing exports ...
} from './types';
```

Confirm the existing export pattern in `index.ts` and match it.

- [ ] **Step 6: Run the tests**

```
npx vitest run src/core/scene/scene.test.ts -t "scene.toJSON"
```

Expected: ALL PASS (7 new tests).

- [ ] **Step 7: Run the full scene test file**

```
npx vitest run src/core/scene/scene.test.ts
```

Expected: ALL PASS.

- [ ] **Step 8: Typecheck**

```
npx tsc --noEmit
```

Expected: same baseline.

- [ ] **Step 9: Commit**

```bash
git add src/core/scene/types.ts src/core/scene/scene.ts src/core/scene/scene.test.ts src/core/scene/index.ts
git commit -m "feat(scene): toJSON snapshots current state to JSON"
```

---

## Task 3: `sceneFromJSON` + round-trip tests

**Files:**
- Modify: `src/core/scene/scene.ts` (implement and export `sceneFromJSON`)
- Modify: `src/core/scene/index.ts`
- Modify: `src/core/scene/scene.test.ts`

Implement the loader. Validates version, resolves `clipFromPoseKey` via the registry, builds an `AddNodeSpec[]`, calls `createScene`. Layer state (visible/locked) carries through `systemLayers` naturally — `createScene` already reads `visible?` and `locked?` per spec at line 71-72 of `scene.ts`.

- [ ] **Step 1: Write failing tests**

Add to `src/core/scene/scene.test.ts`:

```ts
describe('sceneFromJSON', () => {
  it('reconstructs a flat scene from JSON', () => {
    const original = makeScene();
    const a = original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'a' } });
    original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'b' } });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    expect([...restored.roots]).toContain(asNodeId(a));
    expect(restored.get(asNodeId(a))?.data.label).toBe('a');
  });

  it('reconstructs parent/child relationships', () => {
    const original = makeScene();
    const bed = original.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    const plant = original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p' }, parent: bed });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    expect(restored.get(asNodeId(plant))?.parent).toBe(asNodeId(bed));
    expect([...restored.childrenOf(asNodeId(bed))]).toEqual([asNodeId(plant)]);
  });

  it('restores layer visibility and locked state', () => {
    const original = makeScene();
    original.setLayerVisible('structures', false);
    original.setLayerLocked('plantings', true);
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {});
    const structures = restored.layers.find((l) => l.id === 'structures')!;
    const plantings = restored.layers.find((l) => l.id === 'plantings')!;
    expect(structures.visible).toBe(false);
    expect(plantings.locked).toBe(true);
  });

  it('resolves clipFromPoseKey via the registry', () => {
    const factory = (_pose: Pose) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const original = createScene<Data, 'structures' | 'plantings', Pose>({
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const bed = original.add({
      kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' },
      clipFromPose: factory,
    });
    const json = original.toJSON();
    const restored = sceneFromJSON(json, {
      registry: { clipFromPose: { 'ellipse': factory } },
    });
    const restoredBed = restored.get(asNodeId(bed));
    expect(restoredBed?.kind).toBe('container');
    expect((restoredBed as { clipFromPose?: unknown }).clipFromPose).toBe(factory);
  });

  it('clipFromPose survives undo+redo after loading', () => {
    const factory = (_pose: Pose) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const json: SerializedScene<Data, 'structures', Pose> = {
      version: 1,
      systemLayers: [{ id: 'structures' }],
      nodes: [{
        id: 'bed',
        kind: 'container',
        layer: 'structures',
        pose: POSE,
        data: { label: 'bed' },
        clipFromPoseKey: 'ellipse',
      }],
    };
    const scene = sceneFromJSON(json, { registry: { clipFromPose: { 'ellipse': factory } } });
    // Make a no-op mutation we can undo/redo to exercise the cache path.
    const leaf = scene.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'l' } });
    scene.undo();
    scene.redo();
    const bed = scene.get(asNodeId('bed'));
    expect((bed as { clipFromPose?: unknown }).clipFromPose).toBe(factory);
    void leaf;
  });

  it('throws on unknown version', () => {
    const json = { version: 2, systemLayers: [{ id: 'structures' as const }], nodes: [] };
    expect(() => sceneFromJSON(json as never, {})).toThrow(/unsupported version/);
  });

  it('throws on unknown clipFromPoseKey', () => {
    const json: SerializedScene<Data, 'structures', Pose> = {
      version: 1,
      systemLayers: [{ id: 'structures' }],
      nodes: [{
        id: 'bed',
        kind: 'container',
        layer: 'structures',
        pose: POSE,
        data: { label: 'bed' },
        clipFromPoseKey: 'nonexistent',
      }],
    };
    expect(() => sceneFromJSON(json, { registry: {} })).toThrow(/unknown clipFromPose key 'nonexistent'/);
  });

  it('rejects cross-layer subtrees in JSON via assertSubtreeLayer', () => {
    const json: SerializedScene<Data, 'structures' | 'plantings', Pose> = {
      version: 1,
      systemLayers: [{ id: 'structures' }, { id: 'plantings' }],
      nodes: [
        { id: 'bed', kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } },
        { id: 'plant', kind: 'leaf', layer: 'plantings', pose: POSE, data: { label: 'p' }, parent: 'bed' },
      ],
    };
    expect(() => sceneFromJSON(json, {})).toThrow(/subtree layer must match parent/);
  });

  it('full round-trip: toJSON → sceneFromJSON → toJSON produces equivalent output', () => {
    const original = makeScene();
    const bed = original.add({ kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' } });
    original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p1' }, parent: bed });
    original.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'p2' }, parent: bed });
    original.setLayerVisible('plantings', false);
    const json1 = original.toJSON();
    const restored = sceneFromJSON(json1, {});
    const json2 = restored.toJSON();
    // Strip the version field for direct deep-equal; structurally everything
    // else should match.
    expect(json2).toEqual(json1);
  });
});
```

(Add the `sceneFromJSON` import at the top of the test file alongside `createScene`. Also import `SerializedScene` if needed.)

- [ ] **Step 2: Run to verify failures**

```
npx vitest run src/core/scene/scene.test.ts -t "sceneFromJSON"
```

Expected: FAIL — `sceneFromJSON` doesn't exist.

- [ ] **Step 3: Implement `sceneFromJSON`**

In `src/core/scene/scene.ts`, at the module level (outside `createScene`), add:

```ts
/** Reconstruct a Scene from a JSON snapshot produced by `scene.toJSON()`.
 *  Function fields (e.g., `clipFromPose`) are resolved by string key via the
 *  registry passed in `options`. Throws on unknown version, unknown registry
 *  keys, or invalid scene shape (cross-layer subtrees, unknown layer ids).
 *  Loaded scenes start with empty history — undo/redo is NOT serialized. */
export function sceneFromJSON<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose>,
  options: {
    registry?: SceneRegistry<TPose>;
    historyLimit?: number;
    generateId?: () => NodeId;
  },
): Scene<TData, TLayer, TPose> {
  if (json.version !== 1) {
    throw new Error(`sceneFromJSON: unsupported version ${json.version}; only v1 supported`);
  }
  const registry = options.registry ?? {};
  // Build AddNodeSpec[] from json.nodes, resolving function-field keys.
  const initial: AddNodeSpec<TData, TLayer, TPose>[] = json.nodes.map((n) => {
    const spec: AddNodeSpec<TData, TLayer, TPose> = {
      id: n.id as NodeId,
      kind: n.kind,
      layer: n.layer,
      pose: n.pose,
      data: n.data,
    };
    if (n.parent !== undefined) spec.parent = n.parent as NodeId;
    if (n.clipFromPoseKey !== undefined) {
      const fn = registry.clipFromPose?.[n.clipFromPoseKey];
      if (!fn) {
        throw new Error(
          `sceneFromJSON: unknown clipFromPose key '${n.clipFromPoseKey}'. ` +
          `Register a function with this key in the registry option.`
        );
      }
      (spec as { clipFromPose?: typeof fn }).clipFromPose = fn;
    }
    return spec;
  });
  return createScene<TData, TLayer, TPose>({
    systemLayers: json.systemLayers,
    initial,
    registry,
    ...(options.historyLimit !== undefined ? { historyLimit: options.historyLimit } : {}),
    ...(options.generateId !== undefined ? { generateId: options.generateId } : {}),
  });
}
```

Place it after `createScene`'s definition. The function uses `createScene` internally — `createScene` runs the existing `options.initial` loader, which calls `assertSubtreeLayer` and `patchClipFromPose`. No new validation logic is needed at the `sceneFromJSON` layer.

- [ ] **Step 4: Re-export `sceneFromJSON`**

In `src/core/scene/index.ts`, add:

```ts
export { sceneFromJSON } from './scene';
```

Match the existing export pattern in the file.

- [ ] **Step 5: Run the tests**

```
npx vitest run src/core/scene/scene.test.ts -t "sceneFromJSON"
```

Expected: ALL PASS (9 new tests).

- [ ] **Step 6: Run the full scene test file**

```
npx vitest run src/core/scene/scene.test.ts
```

Expected: ALL PASS.

- [ ] **Step 7: Run the full kit suite**

```
npx vitest run
```

Expected: same baseline as before (the pre-existing GradientPlaygroundDemo failure and any rich-text-branch pre-existing failures remain unchanged).

- [ ] **Step 8: Typecheck**

```
npx tsc --noEmit
```

Expected: same baseline.

- [ ] **Step 9: Build**

```
npm run build
```

Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/core/scene/scene.ts src/core/scene/index.ts src/core/scene/scene.test.ts
git commit -m "feat(scene): sceneFromJSON restores scenes from snapshot JSON"
```

---

## After all tasks

Run the full pipeline:

```
npx tsc --noEmit && npx vitest run && npm run build
```

Scene serialization is now in place. Consumers can:

- Snapshot a scene: `const json = scene.toJSON()` → `JSON.stringify(json)` → persist.
- Restore from JSON: `sceneFromJSON(JSON.parse(text), { registry: { clipFromPose: { ... } } })`.
- Load demo data: same as restore, but the JSON lives in a `*.scene.json` file imported by the demo.

A follow-up could migrate one or more demos (SceneDemo, ClippingDemo) from inline `initial:` arrays to `*.scene.json` files as a visible payoff for the work. Not in this plan's scope — call that a Phase B follow-up if you want it.
