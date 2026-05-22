# Node-kind Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the consumer-supplied `adapter.kindOf?` placeholder with a kit-owned `NodeKindRegistry` that consumers populate via a `kinds` prop on `<SceneCanvas>`; ship default classifiers covering the kit's built-in shape kinds; reserve the registry as the convergence target for future kind-keyed facets.

**Architecture:** A new module under `src/core/scene/` exposes `NodeKind`, `NodeKindRegistry`, `createNodeKindRegistry`, and `defaultNodeKinds`. `<SceneCanvas>` accepts a `kinds: NodeKind[]` prop, constructs a fresh registry per instance, and threads a registry-derived classifier through `sceneToAdapter` so the synthesized adapter publishes a `kindOf(id)` method. The existing dispatcher and Canvas read sites continue to read `adapter.kindOf` — no change to them on the read side. `adapter.kindOf` survives as a deprecated escape hatch for consumers passing custom adapters; new code goes through the registry.

**Tech Stack:** TypeScript, React 18, Vitest. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`.

---

## File Structure

**Files to create:**
- `src/core/scene/nodeKindRegistry.ts` — `NodeKind`, `NodeKindRegistry`, `createNodeKindRegistry`
- `src/core/scene/nodeKindRegistry.test.ts` — unit tests for the registry
- `src/core/scene/defaultNodeKinds.ts` — `defaultNodeKinds: NodeKind[]` covering `KIT_SHAPE_KINDS`

**Files to modify:**
- `src/canvas/sceneAdapter.ts` — add `kindOf?` field to `SceneCanvasAdapter`; accept `kindOf?` (or `kinds?`) on `SceneToAdapterOptions`; populate `adapter.kindOf` from the option
- `src/canvas/SceneCanvas.tsx` — add `kinds?: NodeKind[]` prop; build a registry per instance; thread its `classify` into `sceneToAdapter` options
- `src/index.ts` — export `NodeKind`, `NodeKindRegistry`, `createNodeKindRegistry`, `defaultNodeKinds`
- `src/index.barrel.test.ts` — add `defaultNodeKinds` ↔ `KIT_SHAPE_KINDS` parity assertion
- `src/canvas/Canvas.tsx` — JSDoc only: mark the inline `kindOf?` cast at `:716` as `@deprecated` reading note (no behavior change)
- `src/tools/dispatcher.ts` — JSDoc only: same on the `:29` cast (no behavior change)
- `docs/TODO.md` — flip the P1 "Kit-owned object-kind registry" entry to reflect shipped state, with a follow-up for `adapter.kindOf` removal in the next minor

---

## Task 1: NodeKindRegistry module

**Files:**
- Create: `src/core/scene/nodeKindRegistry.ts`
- Test: `src/core/scene/nodeKindRegistry.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/core/scene/nodeKindRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createNodeKindRegistry, type NodeKind } from './nodeKindRegistry';

const rect: NodeKind = {
  name: 'rect',
  matches: (d) => (d as { kind?: string } | null)?.kind === 'rect',
};
const ellipse: NodeKind = {
  name: 'ellipse',
  matches: (d) => (d as { kind?: string } | null)?.kind === 'ellipse',
};

describe('createNodeKindRegistry', () => {
  it("returns 'unknown' when no kind claims the node", () => {
    const r = createNodeKindRegistry();
    expect(r.classify({ kind: 'anything' })).toBe('unknown');
    expect(r.classify(null)).toBe('unknown');
    expect(r.classify(undefined)).toBe('unknown');
  });

  it('classifies a node by the first matching kind', () => {
    const r = createNodeKindRegistry();
    r.register(rect);
    r.register(ellipse);
    expect(r.classify({ kind: 'rect' })).toBe('rect');
    expect(r.classify({ kind: 'ellipse' })).toBe('ellipse');
    expect(r.classify({ kind: 'star' })).toBe('unknown');
  });

  it('walks registered kinds in registration order (first match wins)', () => {
    // A permissive kind registered first should shadow more specific kinds
    // registered later. This documents the dispatch semantics — consumers
    // who want specificity must register specific kinds first.
    const r = createNodeKindRegistry();
    const anyKind: NodeKind = { name: 'any', matches: () => true };
    r.register(anyKind);
    r.register(rect);
    expect(r.classify({ kind: 'rect' })).toBe('any');
  });

  it('throws on duplicate-name registration', () => {
    const r = createNodeKindRegistry();
    r.register(rect);
    expect(() => r.register({ ...rect, matches: () => false })).toThrow(
      /duplicate.*rect/i,
    );
  });

  it('get() returns the registered entry or undefined', () => {
    const r = createNodeKindRegistry();
    r.register(rect);
    expect(r.get('rect')).toBe(rect);
    expect(r.get('missing')).toBeUndefined();
  });

  it('list() returns entries in registration order', () => {
    const r = createNodeKindRegistry();
    r.register(ellipse);
    r.register(rect);
    expect(r.list().map((k) => k.name)).toEqual(['ellipse', 'rect']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/scene/nodeKindRegistry.test.ts`
Expected: FAIL with module resolution error (`Cannot find module './nodeKindRegistry'`).

- [ ] **Step 3: Implement the registry**

Create `src/core/scene/nodeKindRegistry.ts`:

```ts
/**
 * NodeKind — a classifier entry registered with a `NodeKindRegistry`.
 *
 * The kit consults the registry to derive a kind string for each scene
 * node, which then flows into declarative tool-routing tables (e.g.
 * `{ target: 'rect', actionId: 'move' }`).
 *
 * v1 carries only the classification facet. Future kind-keyed concerns
 * (label / icon / propertyRows / bindings / serialize) land here as
 * optional fields per the convergence policy in the design spec.
 *
 * See `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`.
 */
export interface NodeKind {
  /** Unique kind name. Routing tables key on this string. Consumer-defined;
   *  the kit places no constraint beyond uniqueness within a registry. */
  name: string;
  /** Predicate over a node's `data` payload. First registered kind whose
   *  `matches` returns true claims the node. */
  matches: (data: unknown) => boolean;
}

/**
 * NodeKindRegistry — per-`<SceneCanvas>` collection of `NodeKind` entries.
 *
 * Instances are constructed by `<SceneCanvas>` from its `kinds` prop and
 * threaded into the synthesized adapter as a `kindOf(id)` method. Direct
 * use from consumer code is supported but not required for the common
 * SceneCanvas flow.
 */
export interface NodeKindRegistry {
  /** Register a kind. Order matters: first match wins during `classify`.
   *  Throws if a kind with this name is already registered. */
  register(kind: NodeKind): void;
  /** Walk registered kinds in registration order; return the first kind
   *  whose `matches(data)` returns true, or `'unknown'` if none match. */
  classify(data: unknown): string;
  /** Lookup a kind entry by name. */
  get(name: string): NodeKind | undefined;
  /** Enumerate registered kinds in registration order. */
  list(): readonly NodeKind[];
}

export function createNodeKindRegistry(): NodeKindRegistry {
  const entries: NodeKind[] = [];
  const byName = new Map<string, NodeKind>();
  return {
    register(kind) {
      if (byName.has(kind.name)) {
        throw new Error(
          `createNodeKindRegistry: duplicate kind name "${kind.name}"`,
        );
      }
      byName.set(kind.name, kind);
      entries.push(kind);
    },
    classify(data) {
      for (const kind of entries) {
        if (kind.matches(data)) return kind.name;
      }
      return 'unknown';
    },
    get(name) {
      return byName.get(name);
    },
    list() {
      return entries;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/scene/nodeKindRegistry.test.ts`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/scene/nodeKindRegistry.ts src/core/scene/nodeKindRegistry.test.ts
git commit -m "feat(scene): NodeKindRegistry + createNodeKindRegistry

First-match-wins classifier registry. Replaces the adapter.kindOf
placeholder for kit-owned node classification."
```

---

## Task 2: defaultNodeKinds covering KIT_SHAPE_KINDS

**Files:**
- Create: `src/core/scene/defaultNodeKinds.ts`
- Modify: `src/index.barrel.test.ts` (add parity assertion)

- [ ] **Step 1: Write the failing parity test**

Add to `src/index.barrel.test.ts` — find the existing `KIT_SHAPE_KINDS` parity block (search for `KIT_SHAPE_KINDS covering every BuiltinShapeToolId`) and add a sibling assertion immediately after it:

```ts
it('exports defaultNodeKinds covering every KIT_SHAPE_KINDS entry', () => {
  const Barrel = require('./index') as Record<string, unknown>;
  const kinds = Barrel.defaultNodeKinds;
  const shapeKinds = Barrel.KIT_SHAPE_KINDS as readonly string[];
  expect(Array.isArray(kinds), 'defaultNodeKinds must be exported as an array').toBe(true);
  const names = (kinds as { name: string }[]).map((k) => k.name);
  const missing = shapeKinds.filter((s) => !names.includes(s));
  expect(
    missing,
    `KIT_SHAPE_KINDS entries missing from defaultNodeKinds: ${missing.join(', ')}`,
  ).toEqual([]);
});
```

Read the existing block first to match its `import`/`require` style — if it uses dynamic `import`, mirror that exactly. The shape above matches the existing `KIT_SHAPE_KINDS` block at `src/index.barrel.test.ts:53-75`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/index.barrel.test.ts`
Expected: FAIL — `defaultNodeKinds must be exported as an array` (Barrel.defaultNodeKinds is undefined).

- [ ] **Step 3: Implement `defaultNodeKinds`**

Create `src/core/scene/defaultNodeKinds.ts`:

```ts
import { KIT_SHAPE_KINDS } from '../../canvas/SceneCanvas/useBuiltinShapeTools';
import type { NodeKind } from './nodeKindRegistry';

/**
 * Default node-kind classifiers covering the kit's built-in shape tools
 * (`KIT_SHAPE_KINDS`).
 *
 * Each entry classifies nodes whose `data` carries a `{ kind: string }`
 * field matching the shape's name — the convention the kit's built-in
 * shape tools follow when minting new nodes. Consumers using that
 * convention spread `defaultNodeKinds` into their `<SceneCanvas kinds={...}>`
 * prop; consumers with a custom data shape register their own classifiers.
 *
 * Kept in lockstep with `KIT_SHAPE_KINDS` via the barrel parity test in
 * `src/index.barrel.test.ts`.
 */
export const defaultNodeKinds: readonly NodeKind[] = KIT_SHAPE_KINDS.map(
  (name) => ({
    name,
    matches: (data) =>
      typeof data === 'object' &&
      data !== null &&
      (data as { kind?: unknown }).kind === name,
  }),
);
```

- [ ] **Step 4: Export from the barrel**

Modify `src/index.ts` — add near other scene exports (e.g. next to the `sceneToAdapter` export at `src/index.ts:225`):

```ts
export {
  createNodeKindRegistry,
  type NodeKind,
  type NodeKindRegistry,
} from './core/scene/nodeKindRegistry';
export { defaultNodeKinds } from './core/scene/defaultNodeKinds';
```

- [ ] **Step 5: Run barrel parity test**

Run: `npx vitest run src/index.barrel.test.ts`
Expected: PASS — both `KIT_SHAPE_KINDS` and `defaultNodeKinds` parity assertions green.

- [ ] **Step 6: Commit**

```bash
git add src/core/scene/defaultNodeKinds.ts src/index.ts src/index.barrel.test.ts
git commit -m "feat(scene): defaultNodeKinds covering KIT_SHAPE_KINDS

Built-in classifiers for the kit's shape tools. Barrel parity test
keeps the list synced with KIT_SHAPE_KINDS."
```

---

## Task 3: Thread classifier through sceneToAdapter

**Files:**
- Modify: `src/canvas/sceneAdapter.ts`
- Test: `src/canvas/sceneAdapter.test.ts` (add new test, file may already exist — check first)

- [ ] **Step 1: Check whether `sceneAdapter.test.ts` exists**

Run: `ls src/canvas/sceneAdapter.test.ts 2>/dev/null && echo EXISTS || echo MISSING`

If MISSING, you'll create it in Step 2. If EXISTS, append to it.

- [ ] **Step 2: Write the failing test**

Create or append to `src/canvas/sceneAdapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sceneToAdapter } from './sceneAdapter';
import { createScene } from '../core/scene/createScene'; // verify path — adjust if scene factory lives elsewhere

describe('sceneToAdapter — kindOf', () => {
  it('returns undefined kindOf when no classifier supplied', () => {
    const scene = createScene<{ kind: string }, 'main', { x: number; y: number; width: number; height: number }>({
      layers: [{ id: 'main' }],
    });
    const adapter = sceneToAdapter(scene);
    expect(adapter.kindOf).toBeUndefined();
  });

  it('exposes kindOf(id) backed by the supplied classifier', () => {
    const scene = createScene<{ kind: string }, 'main', { x: number; y: number; width: number; height: number }>({
      layers: [{ id: 'main' }],
    });
    const id = scene.insert({ layer: 'main', data: { kind: 'rect' }, pose: { x: 0, y: 0, width: 10, height: 10 } });
    const adapter = sceneToAdapter(scene, {
      kindOf: (data) => (data as { kind?: string }).kind ?? 'unknown',
    });
    expect(adapter.kindOf).toBeDefined();
    expect(adapter.kindOf!(id)).toBe('rect');
  });

  it("returns 'unknown' from kindOf when the node id is missing", () => {
    const scene = createScene<{ kind: string }, 'main', { x: number; y: number; width: number; height: number }>({
      layers: [{ id: 'main' }],
    });
    const adapter = sceneToAdapter(scene, {
      kindOf: (data) => (data as { kind?: string }).kind ?? 'unknown',
    });
    expect(adapter.kindOf!('does-not-exist' as never)).toBe('unknown');
  });
});
```

If the import path for `createScene` is wrong, search:
`grep -n "export function createScene\b\|export.*createScene" src/core/scene/*.ts`
and adjust the import to match. Same for `scene.insert` — match the actual mutation API (it may be `scene.batch(...)` + an op, in which case use the kit's own minimal-insert pattern from another test in this folder for reference).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/canvas/sceneAdapter.test.ts`
Expected: FAIL — `adapter.kindOf` is undefined or `kindOf` option not on `SceneToAdapterOptions`.

- [ ] **Step 4: Add `kindOf` to the adapter type and option**

Modify `src/canvas/sceneAdapter.ts`:

a) Extend the `SceneCanvasAdapter` type (around line 74-81 where the synthesized-adapter tightening lives) to add `kindOf?`:

```ts
export type SceneCanvasAdapter<TData, TLayer extends string, TPose> =
  & MoveAdapter<Node<TData, TLayer, TPose>, TPose>
  // ... existing intersections unchanged ...
  & {
      getParent(id: string): string | null;
      getSelection(): string[];
      setSelection(ids: string[]): void;
      insertNode(node: Node<TData, TLayer, TPose>): void;
      removeNode(id: string): void;
      applyOps(ops: Op[], label?: string): void;
      /** Optional classifier producing a kind string for the given node id.
       *  Set when the synthesizing `<SceneCanvas>` (or other producer) was
       *  given a `kinds` registry; consulted by the dispatcher
       *  (`src/tools/dispatcher.ts`) and Canvas's `getNodeAtPoint` synthesis
       *  (`src/canvas/Canvas.tsx`) to derive `target.kind` for declarative
       *  routing tables. Returns 'unknown' when the id is not in the scene. */
      kindOf?: (id: string) => string;
    };
```

b) Add a `kindOf` option to `SceneToAdapterOptions` (around line 86-122):

```ts
export interface SceneToAdapterOptions<TData, TLayer extends string, TPose> {
  // ... existing fields unchanged ...

  /** Classifier producing a kind string from a node's `data` payload. When
   *  provided, the synthesized adapter exposes `kindOf(id)` that resolves
   *  the node and delegates to this function; `unknown` for missing ids.
   *  `<SceneCanvas>` builds this from its `kinds` prop. */
  kindOf?: (data: TData) => string;
}
```

c) In the `sceneToAdapter` function body, after the existing `const adapter: SceneCanvasAdapter<...> = { ... }` block is built, attach `kindOf` if the option was supplied:

```ts
// (Inside sceneToAdapter, after the adapter object is constructed.)
if (options.kindOf) {
  const classify = options.kindOf;
  adapter.kindOf = (id: string) => {
    const node = scene.get(asNodeId(id));
    if (!node) return 'unknown';
    return classify(node.data);
  };
}
```

Place that after the `const adapter` block — find the spot just before the function returns `adapter`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/canvas/sceneAdapter.test.ts`
Expected: PASS — all three kindOf tests green.

- [ ] **Step 6: Run the full test suite to check for type regressions**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS, no type errors. Existing tests that cast `(adapter as { kindOf?: ... })` continue to work because the field is now typed (the cast is harmless).

- [ ] **Step 7: Commit**

```bash
git add src/canvas/sceneAdapter.ts src/canvas/sceneAdapter.test.ts
git commit -m "feat(sceneAdapter): kindOf option + adapter field

Lets a producer (typically SceneCanvas) thread a classifier into the
synthesized adapter so dispatcher / Canvas read sites get target.kind
from kit-owned data."
```

---

## Task 4: `kinds` prop on `<SceneCanvas>`

**Files:**
- Modify: `src/canvas/SceneCanvas.tsx`
- Test: `src/canvas/SceneCanvas.smoke.test.tsx` (append; this file exists and is the natural home — verify with `ls`)

- [ ] **Step 1: Write the failing integration test**

Append to `src/canvas/SceneCanvas.smoke.test.tsx` (uses the existing `makeScene`, `getCanvas`, `pd`/`pu` helpers defined at the top of that file). A direct way to observe `target.kind` from the test surface is to mount a one-off `claimAll` Tool whose `pointerdown` records `ctx.target.kind` into a ref:

```ts
import { defaultNodeKinds } from '../core/scene/defaultNodeKinds';

describe('SceneCanvas — kinds prop', () => {
  it('threads kinds into the synthesized adapter so target.kind resolves to "rect"', () => {
    const scene = makeScene();           // one rect-data node at (100,100)–(180,160)
    const id = firstId(scene);

    let captured: string | undefined;

    // Minimal Tool that claims pointerdown and records ctx.target.kind.
    // Matches the existing `claim`-style Tools elsewhere in the file —
    // search for `claim` in this test file for the exact shape, then mirror.
    const probe = {
      id: 'kind-probe',
      pointerdown: (ctx: { target?: { kind?: string } }) => {
        captured = ctx.target?.kind;
        return { kind: 'claim' as const };
      },
    };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        kinds={defaultNodeKinds}
        selectionOptions={{ initial: [id] }}
        tools={{ active: probe }}        // bypass the default select tool
      />,
    );

    const canvas = getCanvas(container);
    pd(canvas, 140, 130);                // pointerdown inside the rect node
    pu(canvas, 140, 130);

    expect(captured).toBe('rect');
  });
});
```

The exact `Tool` / `tools={...}` shape may differ — read the `claim`-returning Tool registrations elsewhere in this file (and `src/tools/types.ts` for `AnyTool`/`Decision`) before finalizing. The acceptance contract is: with `kinds={defaultNodeKinds}` and a `{ kind: 'rect' }` data node, the dispatcher must surface `'rect'` as `target.kind` on pointerdown. Without `kinds`, the same setup must produce `'unknown'` — add a second test asserting that (mirror the above, omit the `kinds` prop, expect `captured === 'unknown'`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/canvas/SceneCanvas.smoke.test.tsx -t 'kinds prop'`
Expected: FAIL — `target.kind` is `'unknown'` because no kinds are wired yet.

- [ ] **Step 3: Add the `kinds` prop to `SceneCanvasProps`**

In `src/canvas/SceneCanvas.tsx`, find the `SceneCanvasProps` type block (`export type SceneCanvasProps<...> = Omit<...> & { ... }` at `:275`). Add a `kinds` field next to the other top-level props (e.g. immediately after `layouts?`):

```ts
    /**
     * Node-kind classifiers — list of `NodeKind` entries. The kit constructs
     * a `NodeKindRegistry` per-`<SceneCanvas>` from this prop, then threads
     * the resulting classifier into `sceneToAdapter` so the synthesized
     * adapter exposes `kindOf(id)`. Tool routing tables (e.g.
     * `{ target: 'rect', actionId: 'move' }`) match against the produced
     * kind strings.
     *
     * Pass `defaultNodeKinds` to pick up the kit's built-in shape kinds
     * (rect, ellipse, polygon, …) for `data: { kind: '<shape>' }` nodes.
     * Spread additional entries for consumer-defined kinds:
     *
     *   kinds={[
     *     ...defaultNodeKinds,
     *     { name: 'sticky-note', matches: (d) => d.kind === 'sticky' },
     *   ]}
     *
     * See `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`.
     */
    kinds?: readonly NodeKind[];
```

Add the import near the other type imports at the top of the file:

```ts
import { createNodeKindRegistry, type NodeKind } from '../core/scene/nodeKindRegistry';
```

- [ ] **Step 4: Build the registry per-instance and pass classifier to sceneToAdapter**

Still in `src/canvas/SceneCanvas.tsx`: find the call site where `sceneToAdapter` is invoked (it's the consumer of `SceneToAdapterOptions`). Read 30 lines around that call to understand the existing options-construction style — typically a `useMemo(...)` building an options object.

Wrap the registry construction in a `useMemo` keyed on `kinds`:

```ts
const kindClassifier = useMemo(() => {
  if (!kinds || kinds.length === 0) return undefined;
  const registry = createNodeKindRegistry();
  for (const k of kinds) registry.register(k);
  return (data: unknown) => registry.classify(data);
}, [kinds]);
```

Then thread `kindOf: kindClassifier` into the `sceneToAdapter(scene, { ... })` options object. Cast as needed if the local `TData` generic shows up — `kindClassifier as ((data: TData) => string) | undefined` is fine.

- [ ] **Step 5: Run the failing test from Step 1**

Run: `npx vitest run src/canvas/SceneCanvas.smoke.test.tsx -t 'kinds prop'`
Expected: PASS — `target.kind` reads `'rect'` for a rect-data node.

- [ ] **Step 6: Run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/canvas/SceneCanvas.tsx src/canvas/SceneCanvas.smoke.test.tsx
git commit -m "feat(SceneCanvas): kinds prop wires NodeKindRegistry

Per-instance registry built from the prop, threaded through
sceneToAdapter as the classifier. Target kinds now flow from the
registry instead of consumer-supplied adapter.kindOf hooks."
```

---

## Task 5: Demo / smoke wiring + deprecation note

**Files:**
- Modify: `demo/` — find a demo that currently relies on `target.kind` routing (likely `RectDemo` or `ShapeToolsDemo`) and update it to use `kinds={defaultNodeKinds}` instead of the ad-hoc `kindOf` hook. If no such demo exists, skip the demo edit.
- Modify: `src/canvas/Canvas.tsx` — JSDoc-only on the inline `kindOf` cast at `:716`
- Modify: `src/tools/dispatcher.ts` — JSDoc-only on the inline cast at `:29`

- [ ] **Step 1: Find existing consumers of `adapter.kindOf`**

Run: `grep -rn "kindOf" --include="*.ts" --include="*.tsx" src/ demo/ apps/ 2>/dev/null | grep -v "test\|spec"`

Triage the output:
- Hits in `src/tools/dispatcher.ts` and `src/canvas/Canvas.tsx` — these are the kit-side read sites. Leave behavior alone (the synthesized adapter now provides `kindOf` from the registry). Add a JSDoc deprecation note (Step 2).
- Hits in `demo/` or `apps/` — these are consumer call sites still wiring `kindOf` by hand. Migrate to `kinds={defaultNodeKinds}` if they're using kit-default shape data; otherwise leave alone and note the consumer's custom-data shape in the migration TODO.
- Hits in `src/canvas/SceneCanvas/useBuiltinShapeTools.tsx` — search for `kindOf` here too; the synthesized tools may construct ad-hoc kind predicates inline. If any of those duplicate `defaultNodeKinds`, leave them — they predate this work and live in a different layer.

- [ ] **Step 2: Add deprecation JSDoc at the inline read sites**

Modify `src/tools/dispatcher.ts` around line 29 — the comment immediately above `buildAffordanceTarget` already explains the placeholder. Update it to mention the new registry path:

Find:
```ts
/** Build a HitResult for the dispatcher's context. Phase 1 classifier:
 *  - Affordance hits → 'affordance:unknown' kind (placeholder until the
 *    affordance layer carries kind metadata).
 *  - No node hit-test in Phase 1 dispatcher — regular pointer paths yield
 *    'empty' since the dispatcher doesn't run a scene hit-test.
 *  Subsequent phases will add a scene hit-test and propagate real node ids. */
```

Replace with:
```ts
/** Build a HitResult for the dispatcher's context.
 *  - Affordance hits → 'affordance:unknown' kind (placeholder until the
 *    affordance layer carries kind metadata).
 *  - For nodes carried on the affordance binding via `targetId`, the
 *    kind is resolved by calling `adapter.kindOf(targetId)`, which is
 *    populated by `<SceneCanvas>` from its `kinds` prop (per
 *    `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`).
 *    Consumers using bare `<Canvas>` with a custom adapter may still set
 *    `adapter.kindOf` directly; that escape hatch is supported but
 *    deprecated and will be removed once all consumers migrate. */
```

Modify `src/canvas/Canvas.tsx` near the inline cast at `:716` — locate the comment block above the synthesized `__setGetNodeAtPoint` and add a short reference:

Find the existing comment block immediately above the function and add a sentence:

```ts
// `a.kindOf?.(id)` is populated by SceneCanvas from its `kinds` prop
// (see docs/superpowers/specs/2026-05-21-node-kind-registry-design.md).
// Bare-Canvas consumers may still set adapter.kindOf directly as a
// deprecated escape hatch; the field is typed on SceneCanvasAdapter as
// optional and reads `'unknown'` when unset.
```

- [ ] **Step 3: Migrate demo consumers (if any)**

For each demo found in Step 1 that currently uses `adapter.kindOf`:
- If it consumes the kit's default shape-data shape (`{ kind: 'rect' | 'ellipse' | … }`): replace the inline `kindOf` wiring with `kinds={defaultNodeKinds}` on `<SceneCanvas>`. Delete the manual hook.
- If it uses custom data: leave it; add a `// TODO: migrate to NodeKind` comment.

- [ ] **Step 4: Run the demo and the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

If demo edits were made, also smoke-test the demo:
Run: `npm run dev:demo` (or whatever the demo dev command is — check `package.json` `scripts`)
Manually click on a shape in the migrated demo and confirm select-tool still works (target.kind resolves, drag-to-move fires).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(docs,demos): reference registry from kindOf comments

JSDoc-level migration note at the two inline kindOf read sites pointing
to the registry as the new wiring path; migrate any demos that wired
kindOf by hand."
```

---

## Task 6: Update TODO

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Flip the P1 entry**

In `docs/TODO.md`, find the "Kit-owned object-kind registry" entry under `## Tools & gestures` (starts with `**(P1) Kit-owned object-kind registry.**` at line ~87). Replace the entry with a shipped-state version plus follow-ups:

```markdown
- **(P3) Remove `adapter.kindOf` escape hatch.** Shipped 2026-05-21: kit-owned `NodeKindRegistry` per `<SceneCanvas>`, populated via the `kinds` prop, derives `adapter.kindOf` for the dispatcher and Canvas read sites. Spec: `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`. Plan: `docs/superpowers/plans/2026-05-21-node-kind-registry.md`. **Follow-up:** in the next minor, delete the deprecated `adapter.kindOf` escape hatch (the field, the back-compat read at `src/tools/dispatcher.ts:29` and `src/canvas/Canvas.tsx:716`). Audit `demo/` and `apps/` consumers for the field before deletion.

- **(P3) Convergence-target facets.** As `NodeKindRegistry`'s convergence-policy facets land (label/icon, propertyRows, bindings, subkinds, serialize/deserialize), each gets its own spec referencing the 2026-05-21 design. Tracked individually under the relevant TODO sections (per-kind property-row registry, default action icons, useScene op-log serialization).
```

Also update the high-priority index at the top of the file: remove "Kit-owned object-kind registry → [Tools & gestures]" from the P1 section. If the P1 section becomes empty, leave the heading and add a one-line "No P1 items currently open." note rather than deleting the heading.

- [ ] **Step 2: Verify the changes**

Run: `git diff docs/TODO.md`

Confirm the P1 index entry is removed, the entry under Tools & gestures has been replaced with the shipped-state P3 follow-up, and nothing else changed.

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): NodeKindRegistry shipped; track adapter.kindOf removal

P1 'kit-owned object-kind registry' entry replaced with a P3
follow-up to delete the deprecated adapter.kindOf escape hatch in
the next minor. Convergence-target facets tracked separately."
```

---

## Task 7: Final verification

- [ ] **Step 1: Full release-gate run (matches CI)**

Run: `npx tsc --noEmit && npx vitest run && npx tsup`
Expected: PASS — typecheck clean, all tests green, build succeeds. (This matches `package.json`'s `prepublishOnly` per the user's saved guidance.)

If any step fails, return to the relevant task and fix the regression before continuing.

- [ ] **Step 2: Confirm public-API exports**

Run:
```bash
node -e "const m = require('./dist/index.cjs'); console.log({createNodeKindRegistry: typeof m.createNodeKindRegistry, defaultNodeKinds: Array.isArray(m.defaultNodeKinds)});"
```
Expected: `{ createNodeKindRegistry: 'function', defaultNodeKinds: true }`.

If `dist/index.cjs` doesn't exist or is empty, the tsup build's entry config may not include the new module paths. Inspect `tsup.config.ts` — if `src/core/scene/nodeKindRegistry.ts` isn't reached via the existing `src/index.ts` re-export, fix the export chain rather than adding a new tsup entry (the existing barrel is the canonical seam).

- [ ] **Step 3: Hand off**

Plan complete. Spec at `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md` and TODO follow-ups in place for the `adapter.kindOf` removal and the convergence-target facets.

---

## Notes for the implementer

- **Per-instance registry, not module singleton.** `<SceneCanvas>` constructs a fresh registry each render (memoized on `kinds`). Do not introduce a module-level registry singleton — it would couple unrelated canvases on the same page.
- **No painter unification.** `shapePainters` stays as-is. If you find yourself wanting to fold paint into a `NodeKind` facet during this work, stop — that's a separate spec, deliberately deferred (see non-goal #1 in the design).
- **The `describeKind?` prop on `<SceneCanvas>` is unrelated.** It's `@experimental` and produces human-readable labels for non-canvas UI (palette, status bar). Don't confuse it with the new `kinds` prop — different concern, different consumer, different shape. Leave it alone.
- **Subkinds (e.g. `'rect:selected'`) are dispatcher-composed, not registry-derived.** v1 of the registry produces base kind only. The dispatcher continues to decorate with selection-state suffixes via its existing path. Do not add a `subkinds` field to `NodeKind` in this plan — it's a future facet per the convergence policy.
