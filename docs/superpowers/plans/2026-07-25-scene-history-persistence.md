# Scene History Persistence (Phase 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scene undo/redo survives a page reload — `Scene.serializeHistory()`/`restoreHistory()`/`setHistoryAdapter()` on the kit, an injectable `rebuildOp` hook on the engine, `clipKey` threading for clip containers, and end-to-end wiring in apps/draw.

**Architecture:** The engine's `restore()` gains a per-instance rebuild hook consulted before the global op-factory registry. The scene's hook rebuilds `registered` kinds via `makeOp` (native + consumer ops) and wraps globally-rebuilt external ops in a lazy adapter binding resolved through a new `setHistoryAdapter` accessor. `clipFromPose` re-attaches after reload via a registry key stamped into the `kit:add` payload. Draw persists the snapshot under a new localStorage key in its existing debounced effect.

**Tech Stack:** TypeScript, vitest (`weasel-ui` project for `packages/history`, `kit` for `src/core/scene`, `draw` for apps/draw), tsup.

**Spec:** `docs/superpowers/specs/2026-07-25-scene-history-persistence-design.md` (approved). Open questions resolved here: (1) adapter wiring is app-level in draw; (2) `kit:remove` payload size accepted as-is (exploratory app, localStorage ~5MB); (3) no mid-batch guard on `serializeHistory` — JSDoc note only (draw's debounced effect never runs mid-batch).

**Files:**
- Modify: `packages/history/src/history.ts` (+ new test file `history.rebuild.test.ts`)
- Modify: `src/core/scene/scene.ts`, `src/core/scene/types.ts`, `src/core/scene/scene.test.ts`
- Modify: `apps/draw/src/App.tsx`
- Modify: `docs/TODO.md`

---

### Task 0: Baseline

- [ ] **Step 1:** Work in the existing worktree `/…/.claude/worktrees/scene-history-persistence` (branch `scene-history-persistence`, spec already committed). `npm install`, then baseline: `npm run typecheck && npx vitest run --project=weasel-ui packages/history && npx vitest run --project=kit src/core/scene`. All green before starting.

---

### Task 1: Engine — injectable `rebuildOp` hook

**Files:** Modify `packages/history/src/history.ts`; Create `packages/history/src/history.rebuild.test.ts`

- [ ] **Step 1: Failing tests** — create `packages/history/src/history.rebuild.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { Op } from 'core/ops/types';
import { registerOpFactory } from 'core/ops/registry';

interface Cell { x: number }

function setX(cell: Cell, from: number, to: number): Op {
  return {
    name: 'rebuildtest:setX',
    args: { id: 'a', from, to },
    apply: () => { cell.x = to; },
    invert: () => setX(cell, to, from),
  };
}

describe('CreateHistoryOptions.rebuildOp', () => {
  it('hook wins over the global registry and receives (name, args)', () => {
    const src: Cell = { x: 0 };
    const a = createHistory(null);
    a.applyOps([setX(src, 0, 5)], 'set');
    const snap = a.serialize();

    const dst: Cell = { x: 5 };
    const seen: [string, unknown][] = [];
    const b = createHistory(null, {
      rebuildOp: (name, args) => {
        seen.push([name, args]);
        const { from, to } = args as { from: number; to: number };
        return setX(dst, from, to);
      },
    });
    b.restore(snap);
    expect(seen).toEqual([
      ['rebuildtest:setX', { id: 'a', from: 0, to: 5 }],
      ['rebuildtest:setX', { id: 'a', from: 0, to: 5 }],
    ]); // forwardOps + baseOps of the single entry
    b.undo();
    expect(dst.x).toBe(0);
    b.redo();
    expect(dst.x).toBe(5);
  });

  it('hook returning null falls back to the global registry', () => {
    const cell: Cell = { x: 0 };
    // Unique name per test run — the global registry has no reset in the barrel.
    const NAME = 'rebuildtest:global-fallback';
    registerOpFactory(NAME, (args) => {
      const { from, to } = args as { from: number; to: number };
      const mk = (f: number, t: number): Op => ({
        name: NAME, args: { from: f, to: t },
        apply: () => { cell.x = t; },
        invert: () => mk(t, f),
      });
      return mk(from, to);
    });
    const a = createHistory(null);
    a.applyOps([{
      name: NAME, args: { from: 0, to: 3 },
      apply: () => { cell.x = 3; },
      invert: () => ({ name: NAME, args: { from: 3, to: 0 }, apply: () => { cell.x = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set');
    const snap = a.serialize();

    const b = createHistory(null, { rebuildOp: () => null });
    b.restore(snap);
    b.undo();
    expect(cell.x).toBe(0);
  });

  it('hook null + unknown global name still yields a no-op placeholder', () => {
    const cell: Cell = { x: 0 };
    const a = createHistory(null);
    a.applyOps([{
      name: 'rebuildtest:never-registered', args: {},
      apply: () => { cell.x = 1; },
      invert: () => ({ name: 'rebuildtest:never-registered', args: {}, apply: () => { cell.x = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set');
    const snap = a.serialize();

    const b = createHistory(null, { rebuildOp: () => null });
    b.restore(snap);
    expect(b.entries().undo).toHaveLength(1); // slot preserved
    expect(() => b.undo()).not.toThrow();     // placeholder: undo does nothing
    expect(cell.x).toBe(1);                   // dst state untouched by placeholder
  });
});
```

- [ ] **Step 2:** `npx vitest run --project=weasel-ui packages/history/src/history.rebuild.test.ts` → FAIL (`rebuildOp` unknown option / restore uses global only).

- [ ] **Step 3: Implement.** In `packages/history/src/history.ts`:

3a. `CreateHistoryOptions` gains (after `onEvict`):

```ts
  /** Custom op rebuilder consulted by `restore()` before the global
   *  op-factory registry. Return `null` to fall through (global registry,
   *  then a no-op placeholder). Lets an owner rebuild ops whose handlers
   *  live in per-instance state the global registry can't reach (e.g. a
   *  Scene's registered op kinds). */
  rebuildOp?: (name: string, args: unknown) => Op | null;
```

3b. `serialToEntry` is module-level and calls the global `rebuildOp` directly. Give it an optional custom rebuilder parameter and extract the shared per-op logic:

```ts
type CustomRebuild = (name: string, args: unknown) => Op | null;

function rebuildSerialOp(so: SerializedOp, label: string, custom: CustomRebuild | undefined): Op {
  const viaCustom = custom ? custom(so.name, so.args) : null;
  if (viaCustom !== null) return viaCustom;
  const built = rebuildOp(so.name, so.args);
  if (built !== null) return built;
  dlog('history', `restore: unknown op name "${so.name}" — substituting no-op placeholder`);
  return placeholderOp(so.name, so.args, label);
}

function serialToEntry(se: SerializedHistoryEntry, custom?: CustomRebuild): Entry {
  const forwardOps = se.forwardOps.map((so) => rebuildSerialOp(so, se.label, custom));
  const baseOps = se.baseOps.map((so) => rebuildSerialOp(so, se.label, custom));
  return { /* unchanged: id, label, forwardOps, baseOps, timestamp: 0, touchedIds: touchedIdsFromOps(forwardOps) */ };
}
```

(Keep the existing `timestamp: 0` / `touchedIds` comments in place.)

3c. In `createHistory`: read `const customRebuild = options.rebuildOp;` next to the other option reads, and in `restore()` pass it: `serialToEntry(se, customRebuild)` at both call sites. Update the `restore` interface doc ("Ops are rebuilt via the `rebuildOp` option when provided, then the global registry; unknown names become no-op placeholders…").

- [ ] **Step 4:** `npx vitest run --project=weasel-ui packages/history` → all green (new + existing ~80).

- [ ] **Step 5: Commit** — `feat(history): injectable rebuildOp hook for restore()` (files: `history.ts`, `history.rebuild.test.ts`; usual Co-Authored-By trailer).

---

### Task 2: Scene — `serializeHistory` / `restoreHistory` / `setHistoryAdapter`

**Files:** Modify `src/core/scene/scene.ts`, `src/core/scene/types.ts`; Test `src/core/scene/scene.test.ts`

- [ ] **Step 1: Failing tests** — append to `src/core/scene/scene.test.ts`. Add `import { registerOpFactory } from '../ops/registry';` (value import — the kit project resolves `core/*` aliases; match the file's existing alias style, i.e. `from 'core/ops/registry'`).

```ts
describe('history persistence (serializeHistory / restoreHistory)', () => {
  /** Serialize scene A's state+history, rebuild both into a fresh scene. */
  function roundTrip(a: ReturnType<typeof makeScene>) {
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    return b;
  }

  it('native-op entries undo/redo after a round-trip', () => {
    const a = makeScene();
    const id = a.add({ id: asNodeId('n1'), kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    a.setPose(id, { x: 5, y: 5, width: 10, height: 10 });
    const b = roundTrip(a);
    expect(b.historyEntries()).toHaveLength(2);
    expect(b.undo()).toBe(true);
    expect(b.get(asNodeId('n1'))?.pose).toEqual(POSE);
    b.undo();
    expect(b.get(asNodeId('n1'))).toBeUndefined();
    b.redo(); b.redo();
    expect(b.get(asNodeId('n1'))?.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });

  it('consumer registerOp kinds round-trip when re-registered before restore', () => {
    let ext = 'initial';
    const handler = {
      apply: (p: { from: string; to: string }) => { ext = p.to; },
      revert: (p: { from: string; to: string }) => { ext = p.from; },
    };
    const a = makeScene();
    a.registerOp('app:rename', handler);
    a.recordOp({ kind: 'app:rename', payload: { from: 'initial', to: 'renamed' } });
    const snap = a.serializeHistory();

    const b = makeScene();
    b.registerOp('app:rename', handler);
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    ext = 'renamed'; // state at snapshot head
    b.undo();
    expect(ext).toBe('initial');
    b.redo();
    expect(ext).toBe('renamed');
  });

  it('external-op entries replay through the lazy history adapter (wired after restore)', () => {
    const NAME = 'scenetest:cellSet';
    registerOpFactory(NAME, (args) => {
      const { from, to } = args as { from: number; to: number };
      const mk = (f: number, t: number): Op => ({
        name: NAME, args: { from: f, to: t },
        apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
        invert: () => mk(t, f),
      });
      return mk(from, to);
    });
    let cell = 0;
    const liveAdapter = { set: (v: number) => { cell = v; } };
    const a = makeScene();
    const op = registerOpFactory && ((): Op => {
      const mk = (f: number, t: number): Op => ({
        name: NAME, args: { from: f, to: t },
        apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
        invert: () => mk(t, f),
      });
      return mk(0, 7);
    })();
    a.applyBatch([op], 'set cell', liveAdapter);
    expect(cell).toBe(7);

    const b = roundTrip(a);
    // Adapter wired AFTER restore — lazy binding must not care.
    b.setHistoryAdapter(() => liveAdapter);
    b.undo();
    expect(cell).toBe(0);
    b.redo();
    expect(cell).toBe(7);
  });

  it('restored external ops with no history adapter are warning no-ops, never throws', () => {
    const NAME = 'scenetest:noAdapter';
    let cell = 0;
    registerOpFactory(NAME, (args) => {
      const { to } = args as { to: number };
      const mk = (t: number): Op => ({
        name: NAME, args: { to: t },
        apply: (adapter) => { (adapter as { set(v: number): void }).set(t); },
        invert: () => mk(0),
      });
      return mk(to);
    });
    const a = makeScene();
    a.applyBatch([{
      name: NAME, args: { to: 9 },
      apply: (adapter) => { (adapter as { set(v: number): void }).set(9); },
      invert: () => ({ name: NAME, args: { to: 0 }, apply: () => { cell = 0; }, invert: () => { throw new Error('unused'); } }),
    }], 'set', { set: (v: number) => { cell = v; } });
    const b = roundTrip(a);
    expect(() => b.undo()).not.toThrow(); // no adapter wired: no-op with a debug warning
    expect(cell).toBe(9);
  });

  it('unknown op kinds restore as placeholders that keep their stack slot', () => {
    const a = makeScene();
    a.registerOp('app:oneoff', { apply: () => {}, revert: () => {} });
    a.recordOp({ kind: 'app:oneoff', payload: null });
    a.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();       // 'app:oneoff' NOT re-registered
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    expect(b.historyEntries()).toHaveLength(2); // slot preserved
    b.undo();                                    // undoes the add
    b.undo();                                    // placeholder — no throw, no effect
    expect(b.canUndo()).toBe(false);
  });

  it('restoreHistory replaces existing history and restored entries never coalesce', () => {
    const a = makeScene();
    a.add({ id: asNodeId('n1'), kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();
    b.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'pre' } });
    b.loadState(a.toJSON());     // clears history + state
    b.restoreHistory(snap);
    expect(b.historyEntries()).toHaveLength(1);
    b.setPose(asNodeId('n1'), { x: 1, y: 1, width: 10, height: 10 });
    expect(b.historyEntries()).toHaveLength(2); // no merge into the restored entry
  });

  it('restoreHistory notifies subscribers exactly once', () => {
    const a = makeScene();
    a.add({ kind: 'leaf', layer: 'structures', pose: POSE, data: { label: 'x' } });
    const snap = a.serializeHistory();
    const b = makeScene();
    b.loadState(a.toJSON());
    let n = 0;
    b.subscribe(() => { n++; });
    b.restoreHistory(snap);
    expect(n).toBe(1);
  });
});
```

Note for the implementer: the third test's `op` construction is deliberately a plain inline op whose `(name, args)` matches the registered factory — clean it up to a simple `mk(0, 7)` helper call (the plan text shows the intent; write it straightforwardly, one `mk` helper used both for the live op and inside the factory).

- [ ] **Step 2:** Run → FAIL (methods don't exist / type errors).

- [ ] **Step 3: Implement.**

3a. `src/core/scene/types.ts` — add to the `Scene` interface (a new `// History persistence` group after `jumpToHistoryIndex`), and add `import type { SerializedHistory } from '@weasel-js/history';`:

```ts
  /** Snapshot the undo/redo history in a JSON-serializable form (the
   *  engine's `SerializedHistory`). Entries containing any nameless op are
   *  dropped (hand-rolled anonymous ops passed to `applyBatch`); kit and
   *  consumer-registered ops always carry names. Payload JSON-safety
   *  (e.g. typed arrays inside poses) is the caller's concern. Do not call
   *  mid-`batch` — the open batch's ops are not yet recorded. */
  serializeHistory(): SerializedHistory;
  /** Replace the undo/redo history from a `serializeHistory()` snapshot.
   *  Call on a scene whose node/layer state already matches the snapshot's
   *  head state (i.e. right after `loadState` from the paired scene
   *  snapshot); node state is NOT mutated. Ops re-registered via
   *  `registerOp` before this call round-trip; unknown kinds become no-op
   *  placeholders; external ops rebuild via the global op-factory registry
   *  and replay against the `setHistoryAdapter` accessor. Restored entries
   *  never coalesce with new ones. Notifies once. */
  restoreHistory(snapshot: SerializedHistory): void;
  /** Install (or clear with `null`) the accessor for the adapter that
   *  RESTORED external ops (recorded via `applyBatch`, rebuilt from a
   *  `restoreHistory` snapshot) apply against on undo/redo. Resolved lazily
   *  at each apply, so wiring order relative to `restoreHistory` doesn't
   *  matter. Live `applyBatch` entries are unaffected (they bind their
   *  call-site adapter). If unset when a restored op applies, the op is a
   *  debug-warned no-op. */
  setHistoryAdapter(fn: (() => unknown) | null): void;
```

3b. `src/core/scene/scene.ts`:

- Import `dwarn` from `debug/flag` (check the path other kit files use — `packages/history` uses `'debug/flag'`; within `src`, grep for an existing `dwarn` import and match it; if none exists in `src`, import from the same module the history package uses, adjusting to the alias that resolves inside `src`).
- Import type `SerializedHistory` from `'@weasel-js/history'` and value `rebuildOp as rebuildGlobalOp` from `'core/ops/registry'`. **Correction:** the engine already handles global fallback — the scene hook should return `null` for non-`registered` kinds and let the engine try the global registry itself. But external ops rebuilt by the global registry then need the lazy adapter wrap, which the engine can't do. So the scene hook must handle BOTH branches itself and the engine fallback is effectively dead for scene histories:

```ts
  // Accessor for the adapter restored external ops apply against.
  let historyAdapterAccessor: (() => unknown) | null = null;

  /** Wrap a globally-rebuilt external op so apply resolves the history
   *  adapter lazily — wiring order vs restoreHistory doesn't matter. An
   *  unset accessor makes the op a debug-warned no-op (never throws
   *  mid-undo), matching the placeholder degradation policy. */
  function bindOpToHistoryAdapter(op: Op): Op {
    return {
      name: op.name,
      args: op.args,
      label: op.label,
      coalesceKey: op.coalesceKey,
      apply: () => {
        const get = historyAdapterAccessor;
        if (!get) {
          dwarn('scene', `restored op "${op.name ?? '?'}" has no history adapter — skipping (setHistoryAdapter was not wired)`);
          return 'noop';
        }
        return op.apply(get());
      },
      invert: () => bindOpToHistoryAdapter(op.invert()),
    };
  }
```

- In the `createHistory` options object, add the hook (after `onEvict`):

```ts
    rebuildOp: (name, args) => {
      if (registered.has(name)) return makeOp(name, args);
      const rebuilt = rebuildGlobalOp(name, args);
      return rebuilt === null ? null : bindOpToHistoryAdapter(rebuilt);
    },
```

(Return `null` only when the global registry also misses — the engine then places its placeholder. Note the engine's own global fallback never fires for scene histories because this hook already consulted it; that's fine and worth a one-line comment.)

- Public members on the `scene` object (near the other history members):

```ts
    serializeHistory: () => history.serialize(),

    restoreHistory(snapshot) {
      history.restore(snapshot);
      notify();
    },

    setHistoryAdapter(fn) {
      historyAdapterAccessor = fn;
    },
```

- [ ] **Step 4:** `npx vitest run --project=kit src/core/scene` → all green (existing 114 + 7 new). `npm run typecheck` clean.

- [ ] **Step 5: Commit** — `feat(scene): serializeHistory/restoreHistory/setHistoryAdapter` (files: `scene.ts`, `types.ts`, `scene.test.ts`).

---

### Task 3: `clipKey` threading for clip containers

**Files:** Modify `src/core/scene/scene.ts`; Test `src/core/scene/scene.test.ts`

- [ ] **Step 1: Failing test** — append inside the `history persistence` describe:

```ts
  it('clip containers re-attach clipFromPose on redo after a round-trip (clipKey)', () => {
    const fn = (_pose: typeof POSE) => ({ kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 });
    const mk = () => createScene<Data, 'structures', typeof POSE>({
      systemLayers: [{ id: 'structures' }],
      registry: { clipFromPose: { ellipse: fn } },
    });
    const a = mk();
    a.add({ id: asNodeId('bed'), kind: 'container', layer: 'structures', pose: POSE, data: { label: 'bed' }, clipFromPose: fn });
    a.undo(); // head state: container absent; the add entry sits on the redo stack
    const snap = a.serializeHistory();
    const b = mk();
    b.loadState(a.toJSON());
    b.restoreHistory(snap);
    b.redo(); // re-adds the container in a fresh session — cache is empty
    const node = b.get(asNodeId('bed'));
    expect(node?.kind).toBe('container');
    expect((node as { clipFromPose?: unknown }).clipFromPose).toBe(fn);
  });
```

- [ ] **Step 2:** Run → FAIL (`clipFromPose` undefined after redo — `pendingClipPatches` is empty in scene B).

- [ ] **Step 3: Implement** in `src/core/scene/scene.ts`:

3a. `kit:add`'s payload type gains `clipKey?: string`. In `scene.add`, when building the payload, stamp it:

```ts
      const clipKey = spec.kind === 'container' && spec.clipFromPose !== undefined
        ? reverseClipFromPose.get(spec.clipFromPose as NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>)
        : undefined;
      executeAndLog('kit:add', {
        id, kind: spec.kind, layer: spec.layer, pose: spec.pose, data: spec.data,
        parent, index,
        ...(clipKey !== undefined ? { clipKey } : {}),
      }, `add ${spec.kind}`);
```

3b. In `kit:add`'s `apply`, extend the container re-attach: cache first (live path, unchanged), then `clipKey` → registry, seeding the cache:

```ts
      if (p.kind === 'container') {
        const cached = pendingClipPatches.get(p.id);
        if (cached) {
          (node as ContainerNode<TData, TLayer, TPose>).clipFromPose = cached;
        } else if (p.clipKey !== undefined) {
          // Restore path: a fresh session has an empty cache, but the payload
          // carries the registry key the function was registered under. Seed
          // the cache so later undo/redo cycles behave like the live path.
          const fn = registry.clipFromPose?.[p.clipKey];
          if (fn) {
            (node as ContainerNode<TData, TLayer, TPose>).clipFromPose = fn;
            pendingClipPatches.set(p.id, fn as NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>);
          } else {
            dwarn('scene', `kit:add: clipKey "${p.clipKey}" not in this scene's registry — container "${p.id}" restored without clip`);
          }
        }
      }
```

(The `registry` const already exists in scope from construction. Only the payload type annotation at the `registerKitOp<{...}>('kit:add', ...)` site needs `clipKey?: string` added.)

- [ ] **Step 4:** `npx vitest run --project=kit src/core/scene` — new test green AND the entire pre-existing suite untouched-and-green (the optional payload field must not disturb any test, including the pruning suite). `npm run typecheck` clean.

- [ ] **Step 5: Commit** — `feat(scene): thread clipFromPose registry key through kit:add for post-restore redo`.

---

### Task 4: apps/draw wiring

**Files:** Modify `apps/draw/src/App.tsx`

Draw structure facts: the scene is created in the component at App.tsx ~line 963 (`useScene<WeaselDrawData, …>`); `loadHistory()` (~line 852) reads `HISTORY_KEY` for the modality history with `reviveTypedArrays`; the one-shot restore effect is at ~line 983 (`modality.history.restore(snap)` behind `restoredRef`); the debounced write effect is at ~line 995; the canvas adapter is created via `useSceneAdapter(scene, {})` at ~line 344 inside a child component that receives `scene` as a prop.

- [ ] **Step 1:** Add the key + loader next to `loadHistory` (match its style):

```ts
const SCENE_HISTORY_KEY = 'weaseldraw:scene-history-v1';

/** Read the persisted SCENE undo/redo snapshot (the scene's own history
 *  engine, distinct from the modality history above). Best-effort; on
 *  absent/corrupt/mismatched data returns null AND removes the key so a
 *  broken snapshot can't wedge every boot. */
function loadSceneHistory(): SerializedHistory | null {
  try {
    const raw = localStorage.getItem(SCENE_HISTORY_KEY);
    if (raw) {
      const snap = JSON.parse(raw) as SerializedHistory;
      if (snap && snap.version === 1) return reviveTypedArrays(snap);
    }
  } catch {
    // fall through to wipe
  }
  try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
  return null;
}
```

(`SerializedHistory` is already imported for `loadHistory` — verify; add to the import if not.)

- [ ] **Step 2:** In the one-shot restore effect (~line 983), after `modality.history.restore(snap)`:

```ts
    const sceneSnap = loadSceneHistory();
    if (sceneSnap) scene.restoreHistory(sceneSnap);
```

(The scene's state was already restored synchronously via `initial: loadInitial()` at construction, so the head-state contract holds. Keep `restoredRef.current = true;` last.)

- [ ] **Step 3:** In the debounced write effect (~line 995), add alongside the two existing `setItem` calls:

```ts
        localStorage.setItem(SCENE_HISTORY_KEY, JSON.stringify(scene.serializeHistory(), serializeReplacer));
```

- [ ] **Step 4:** Wire the adapter accessor in the child component where `useSceneAdapter` lives (~line 344):

```ts
  const adapter = useSceneAdapter(scene, {});
  // Restored external-op history entries (drags, action commits) replay
  // against this adapter after a reload. Lazy accessor: wiring order vs
  // the boot-time restoreHistory doesn't matter.
  useEffect(() => {
    scene.setHistoryAdapter(() => adapter);
    return () => scene.setHistoryAdapter(null);
  }, [scene, adapter]);
```

(Add `useEffect` to that file's React import if absent.)

- [ ] **Step 5: Verify** — `npx vitest run --project=draw` (all green), `npm run typecheck`. Then a manual smoke: launch the dev server yourself in the background from the worktree (`npm run dev:draw`, note the URL for Mike), draw a couple of shapes, drag one, reload, and confirm Cmd+Z walks back through pre-reload entries. If browser automation is unavailable, state exactly what was and wasn't manually verified in the report — do not claim the smoke passed without doing it.

- [ ] **Step 6: Commit** — `feat(draw): persist and restore scene undo history across reload`.

---

### Task 5: Full gate, docs, wrap-up

- [ ] **Step 1:** `npm run typecheck && npm test && npm run build` — all green. Surface (don't suppress) any new warnings verbatim.

- [ ] **Step 2:** `docs/TODO.md`: on the "(P2) Op coalescing in `useScene`" done-block, replace the trailing "Follow-up: **Phase 2** — clipboard / cross-reload serialization + persistence…" sentence with: "Follow-up shipped 2026-07-25: scene history persists across reload (design: `docs/superpowers/specs/2026-07-25-scene-history-persistence-design.md` — `Scene.serializeHistory`/`restoreHistory`/`setHistoryAdapter`, engine `rebuildOp` hook, `clipKey` threading, draw wiring under `weaseldraw:scene-history-v1`). Remaining: OS clipboard (Phase 2b, separate spec — see the Clipboard P2 below)." Also update the quick-index line ~40 accordingly. Match surrounding conventions; the Clipboard P2 bullet (~line 255) stays as-is.

- [ ] **Step 3:** Commit docs; then final whole-branch review; then superpowers:finishing-a-development-branch (offer merge; push only on explicit OK).

---

## Self-review notes

- Spec §1 (engine hook) → Task 1. §2 (scene surface, hook branches, lazy binding, no-adapter dwarn) → Task 2. §4 (`clipKey`) → Task 3. §5 (draw) → Task 4. Degradation policy → Tasks 2/3 tests (placeholder, no-adapter no-op, clipKey). Testing section fully mapped; open questions resolved in the header.
- Type consistency: `bindOpToHistoryAdapter` (Task 2) vs `bindOpToAdapter` (existing) — distinct names, both defined; `SerializedHistory` imported in `types.ts` (kit) and already present in draw.
- Known test-code roughness: Task 2 Step 1's third test contains a redundant construction the implementer is explicitly told to simplify — intent (one `mk` helper shared by factory and live op) is stated.

---

## Errata (discovered during execution)

- **Task 4 Step 4 as originally written was wrong**: it wired `setHistoryAdapter` to the
  `useSceneAdapter(scene, {})` canvas adapter, which lacks `setData`/`setLayer` — restored
  nudge entries (which carry geometry-projection `setData` ops) threw on undo. The browser
  reload-smoke caught it. Implemented instead: `defaultCommitAdapter(scene)` (hoisted once
  per mount), the same surface live action commits bind — which is also what the spec's §5
  ("the same adapter the actions commit through") actually asked for.
- The spec's draw-side automated typed-array round-trip test was substituted by the manual
  browser reload smoke (Task 4 Step 5); the smoke's localStorage evidence covers the same path.
