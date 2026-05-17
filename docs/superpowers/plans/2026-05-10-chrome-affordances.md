# Chrome Affordances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the visible-chrome-is-hittable architecture: render layers gain optional `hitTest`; reusable affordance factories produce `{ render, hitTest? }` pairs; tools compose them via `composeAffordanceLayer`; the dispatcher walks layers top-down on pointerdown before falling through to the active-tool slot walk; modal tools opt out via `Tool.claimsAll(ctx)`. Selection moves to `src/core/selection/` since `ChromeState` (the affordance-facing state surface) lives there.

**Architecture:** Five sequenced phases. Phase 1 moves selection to core and adds the `ChromeState` builder. Phase 2 adds the `Affordance` type, `composeAffordanceLayer` helper, and the dispatcher's hit-test pipeline (modal check → layer walk → existing slot walk). Phase 3 ships the first affordance (corner resize) and migrates `useSelectTool` to consume it. Phase 4 does the same for rotation. Phase 5 cleans up Canvas paths that ChromeState subsumes (`MULTI_RESIZE_TARGET_ID` synthesis, the `previewBounds` ref dance) and reshapes the `selectionOverlay` slot into a thin override hook.

**Tech Stack:** TypeScript, React 18 hooks, Vitest, `@testing-library/react`. Kit primitives: `RenderLayer`, `Tool`, `ToolsDispatcher`, `useSelection`, `useResize`, `useRotate`, `composeAffordanceLayer`, `buildChromeState`.

**Spec:** `docs/superpowers/specs/2026-05-10-chrome-affordances-design.md`.

---

## File Structure

**Phase 1 — selection move + chrome state surface**
- Move: `src/features/selection/useSelection.ts` → `src/core/selection/useSelection.ts`
- Move: `src/features/selection/useSelection.test.ts` → `src/core/selection/useSelection.test.ts`
- Create: `src/core/selection/index.ts` (barrel)
- Create: `src/core/selection/chromeState.ts` — `ChromeState` type + `buildChromeState`
- Create: `src/core/selection/chromeState.test.ts`
- Modify: `src/features/selection/index.ts` (or create) — re-export from core for back-compat
- Modify: 11 import sites listed below
- Modify: `src/canvas/Canvas.tsx` — call `buildChromeState` once per render, expose via helpers ref

**Phase 2 — affordance scaffolding + dispatcher**
- Create: `src/affordances/types.ts` — `Affordance`, `HitResult`
- Create: `src/affordances/composeAffordanceLayer.ts`
- Create: `src/affordances/composeAffordanceLayer.test.ts`
- Create: `src/affordances/index.ts`
- Modify: `src/core/layers/render.ts` — add optional `hitTest` to `RenderLayer<TData>`
- Modify: `src/tools/types.ts` — add optional `claimsAll` to `Tool<TScratch>`
- Modify: `src/tools/dispatcher.ts` — extend `onPointerDown` with modal check + layer walk
- Modify: `src/tools/dispatcher.test.ts` — coverage for new paths
- Modify: `src/index.ts` — re-export `Affordance`, `HitResult`, `composeAffordanceLayer`

**Phase 3 — corner-resize affordance + select-tool migration**
- Create: `src/affordances/cornerResize.ts` — `createCornerResizeAffordance`
- Create: `src/affordances/cornerResize.test.ts`
- Modify: `src/tools/builtin/useSelectTool.ts` — drop inline corner hit-test; build overlay via `composeAffordanceLayer`
- Modify: `src/tools/builtin/integration.test.tsx` — add cross-tool case
- Modify: `src/index.ts` — re-export `createCornerResizeAffordance`

**Phase 4 — rotation affordance**
- Create: `src/affordances/rotationHandle.ts`
- Create: `src/affordances/rotationHandle.test.ts`
- Modify: `src/tools/builtin/useSelectTool.ts` — drop inline rotation hit-test
- Modify: `src/index.ts` — re-export `createRotationAffordance`
- Modify: `docs/TODO.md` — record other chrome-violation audit items as follow-up specs

**Phase 5 — Canvas cleanup**
- Modify: `src/canvas/Canvas.tsx` — drop `MULTI_RESIZE_TARGET_ID` synthesis, simplify `poseById` (subsumed by ChromeState), reshape `selectionOverlay` slot
- Modify: `src/tools/builtin/useSelectTool.ts` — drop `boundsOfRef`/`previewBounds` dance
- Modify: `docs/taxonomy.md`, `docs/concepts.md`, `docs/extending.md`, `docs/hooks.md`

---

## Import Sweep Targets (Phase 1)

These eleven files import from `../features/selection/...`. They all need their import paths updated to `../core/selection/...` (relative depth varies).

```
src/index.ts
src/interactions/usePointerGestures.ts
src/interactions/usePointerGestures.test.ts
src/tools/types.ts
src/tools/builtin/useSelectTool.bringToFront.test.tsx
src/tools/builtin/useSelectTool.zorder.test.tsx
src/tools/builtin/integration.test.tsx
src/canvas/Canvas.tsx
src/canvas/Canvas.test.tsx
src/canvas/SceneCanvas.tsx
src/canvas/SceneCanvas/useSceneSelectTool.ts
```

---

## Phase 1 — Selection move + chrome state surface

### Task 1: git mv selection module to core

Pure mechanical move + import sweep. Tests stay green; no behavior change.

**Files:**
- Move: `src/features/selection/useSelection.ts` → `src/core/selection/useSelection.ts`
- Move: `src/features/selection/useSelection.test.ts` → `src/core/selection/useSelection.test.ts`
- Create: `src/core/selection/index.ts`
- Modify: 11 import sites (above)
- Modify: `src/features/selection/index.ts` (create if absent) — re-export for back-compat
- Modify: `src/index.ts` — update internal imports

- [ ] **Step 1: git-mv the files**

```bash
mkdir -p src/core/selection
git mv src/features/selection/useSelection.ts src/core/selection/useSelection.ts
git mv src/features/selection/useSelection.test.ts src/core/selection/useSelection.test.ts
```

- [ ] **Step 2: Create the core barrel**

Create `src/core/selection/index.ts`:

```ts
export {
  useSelection,
  type SelectionApi,
  type UseSelectionOptions,
} from './useSelection';
```

- [ ] **Step 3: Update the 11 import sites**

For each path in "Import Sweep Targets" above, replace `from '../features/selection/useSelection'` (or whatever depth) with the equivalent `from '../core/selection/useSelection'` path. The sed below handles the common shape; verify each file with the editor afterward:

```bash
grep -rl "features/selection/useSelection" src/ | xargs sed -i '' 's|features/selection/useSelection|core/selection/useSelection|g'
```

For files that previously imported `from '../../features/selection/...'`, the new path is `from '../../core/selection/...'`. The relative depth is preserved by the sed substitution since `features` and `core` have the same number of path segments.

- [ ] **Step 4: Re-export from the old location for back-compat**

Check whether `src/features/selection/index.ts` exists. If yes, edit it to re-export from core. If no, create:

```ts
// src/features/selection/index.ts
export {
  useSelection,
  type SelectionApi,
  type UseSelectionOptions,
} from '../../core/selection';
export {
  createSelectionOverlayLayer,
  createSelectionOutlineLayer,
  createSelectionHandlesLayer,
  composeSelectionPose,
  type SelectionOverlayLayerOpts,
  type SelectionOutlineLayerOpts,
  type SelectionHandlesLayerOpts,
  type ComposeSelectionPoseOpts,
} from './overlay';
export {
  SelectionContextProvider,
  useSelectionContext,
  usePublishSelection,
  type SelectionContextValue,
} from './SelectionContext';
```

- [ ] **Step 5: Update `src/index.ts`'s selection re-export source**

Edit the `export ... from './features/selection/useSelection'` lines to source from `./core/selection`:

```ts
// In src/index.ts, change:
//   export { useSelection } from './features/selection/useSelection';
// to:
//   export { useSelection } from './core/selection';
// Same for the type re-export.
```

- [ ] **Step 6: Run tests + typecheck**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: typecheck clean; vitest fully green (1856 tests + the 2 skipped). The move is pure refactor — no test should change behavior.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(selection): move useSelection to src/core/selection/

Selection state is foundational for the upcoming ChromeState surface
that affordances read from; affordances live in src/affordances/, so
selection has to be in core (not features) to avoid a core→features
dependency arrow.

Pure file move + import-path sweep across 11 sites. Public barrel
re-exports unchanged. features/selection/index.ts re-exports useSelection
from core for any internal callers still using the old path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: ChromeState type + buildChromeState

The read-only state object affordances consume on every `render` and `hitTest`. Built once per Canvas render.

**Files:**
- Create: `src/core/selection/chromeState.ts`
- Create: `src/core/selection/chromeState.test.ts`
- Modify: `src/core/selection/index.ts` (add export)

- [ ] **Step 1: Write the failing tests**

Create `src/core/selection/chromeState.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildChromeState } from './chromeState';
import { asNodeId } from '../scene/types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };

describe('buildChromeState', () => {
  it('exposes selection ids and modifiers as-is', () => {
    const sel = [asNodeId('a'), asNodeId('b')];
    const state = buildChromeState({
      selection: sel,
      multiActive: true,
      effectiveBoundsOf: () => null,
      modifiers: NO_MOD,
    });
    expect(state.selection).toBe(sel);
    expect(state.modifiers).toBe(NO_MOD);
    expect(state.multiActive).toBe(true);
  });

  it('boundsOf delegates to effectiveBoundsOf', () => {
    const fn = (id: string) => ({ x: id.length, y: 0, width: 1, height: 1 });
    const state = buildChromeState({
      selection: [],
      multiActive: false,
      effectiveBoundsOf: fn,
      modifiers: NO_MOD,
    });
    expect(state.boundsOf('xyz')).toEqual({ x: 3, y: 0, width: 1, height: 1 });
  });

  it('unionBounds is null when multiActive is false', () => {
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: false,
      effectiveBoundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toBeNull();
  });

  it('unionBounds is null when no selected id has computable bounds', () => {
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      effectiveBoundsOf: () => null,
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toBeNull();
  });

  it('unionBounds spans all computable members', () => {
    const map: Record<string, { x: number; y: number; width: number; height: number }> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 100, y: 50, width: 20, height: 30 },
    };
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b')],
      multiActive: true,
      effectiveBoundsOf: (id) => map[id] ?? null,
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toEqual({ x: 0, y: 0, width: 120, height: 80 });
  });

  it('unionBounds skips ids with null bounds and reports the rest', () => {
    const map: Record<string, { x: number; y: number; width: number; height: number } | null> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: null,
      c: { x: 50, y: 50, width: 10, height: 10 },
    };
    const state = buildChromeState({
      selection: [asNodeId('a'), asNodeId('b'), asNodeId('c')],
      multiActive: true,
      effectiveBoundsOf: (id) => map[id] ?? null,
      modifiers: NO_MOD,
    });
    expect(state.unionBounds).toEqual({ x: 0, y: 0, width: 60, height: 60 });
  });

  it('unionBounds is computed lazily and cached', () => {
    let calls = 0;
    const state = buildChromeState({
      selection: [asNodeId('a')],
      multiActive: true,
      effectiveBoundsOf: () => {
        calls++;
        return { x: 0, y: 0, width: 1, height: 1 };
      },
      modifiers: NO_MOD,
    });
    // Not consulted until unionBounds is accessed.
    expect(calls).toBe(0);
    void state.unionBounds;
    expect(calls).toBe(1);
    // Cached on subsequent accesses.
    void state.unionBounds;
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/core/selection/chromeState.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `chromeState.ts`**

Create `src/core/selection/chromeState.ts`:

```ts
import type { NodeId } from '../scene/types';
import type { ModifierState } from '../../interactions/gestures/types';

/** AABB used for selection chrome bounds. Mirrors `Bounds` in
 *  `src/core/adapters/types` but inlined here to avoid an import cycle. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/**
 * Read-only state that affordances consult on every render and hit-test
 * call. Built once per Canvas render via `buildChromeState`; affordances
 * must not cache it across calls.
 */
export interface ChromeState {
  /** Currently selected ids. Live; reflects useSelection's React state. */
  readonly selection: readonly NodeId[];
  /** True when the canvas is in multi-mode AND >= 2 ids are selected. */
  readonly multiActive: boolean;
  /** Bounds for any selection member id. Honors active-tool overlay state
   *  (move/resize/rotate ghosts → ghost bounds; otherwise → committed
   *  pose bounds). Returns null for unknown ids or ids whose bounds aren't
   *  computable. */
  boundsOf(id: string): Bounds | null;
  /** Multi-union AABB when `multiActive`. Computed lazily from `boundsOf`
   *  over every selected id; null otherwise. */
  readonly unionBounds: Bounds | null;
  /** Active modifier state at the moment of the call. */
  readonly modifiers: ModifierState;
}

export interface BuildChromeStateArgs {
  selection: readonly NodeId[];
  multiActive: boolean;
  effectiveBoundsOf: (id: string) => Bounds | null;
  modifiers: ModifierState;
}

export function buildChromeState(args: BuildChromeStateArgs): ChromeState {
  const { selection, multiActive, effectiveBoundsOf, modifiers } = args;
  let cached: { value: Bounds | null; computed: boolean } = { value: null, computed: false };
  return {
    selection,
    multiActive,
    boundsOf: effectiveBoundsOf,
    modifiers,
    get unionBounds() {
      if (cached.computed) return cached.value;
      cached.computed = true;
      if (!multiActive) {
        cached.value = null;
        return null;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let any = false;
      for (const id of selection) {
        const b = effectiveBoundsOf(id);
        if (!b) continue;
        any = true;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      }
      cached.value = any ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null;
      return cached.value;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/core/selection/chromeState.test.ts
```

Expected: PASS — 7 tests green.

- [ ] **Step 5: Update the core barrel**

Edit `src/core/selection/index.ts`:

```ts
export {
  useSelection,
  type SelectionApi,
  type UseSelectionOptions,
} from './useSelection';
export {
  buildChromeState,
  type ChromeState,
  type BuildChromeStateArgs,
  type Bounds,
} from './chromeState';
```

- [ ] **Step 6: Run typecheck + full vitest**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: clean + green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(selection): ChromeState read-only state surface for affordances

Affordance factories (src/affordances/, landing in Phase 2) read from a
ChromeState object built once per Canvas render: selection ids, derived
bounds (overlay-aware), multi-union AABB (lazy), modifier flags. The
state surface is read-only — affordances dispatch gestures via their
drag channel's ToolCtx, not through ChromeState.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire buildChromeState into Canvas

Construct the state on every render so layers can read it. Until affordances exist (Phase 3), no consumer reads it — this task is pure plumbing.

**Files:**
- Modify: `src/canvas/Canvas.tsx`

- [ ] **Step 1: Find the existing chrome-resolution sites**

Read `src/canvas/Canvas.tsx`. Locate:
- `multiActive` definition (around line 741): `const multiActive = selectionMode === 'multi' && selectedIdsForWiring.length > 1;`
- `effectiveBoundsOf` definition (around line 749).
- The `helpersForLayers` object (around line 774) — where Canvas already exposes overlay-aware lookups to layers.

- [ ] **Step 2: Build chromeState immediately after `effectiveBoundsOf`**

Insert (right after the `effectiveBoundsOf = useMemo(...)` block):

```tsx
import { buildChromeState, type ChromeState } from '../core/selection/chromeState';
// (place near the other selection imports at the top of the file)

// ... inside the Canvas component body, after effectiveBoundsOf is built:
const chromeState: ChromeState = useMemo(
  () => buildChromeState({
    selection: selectedIds,
    multiActive,
    effectiveBoundsOf: (id) => effectiveBoundsOf(id),
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  }),
  [selectedIds, multiActive, effectiveBoundsOf],
);
```

NOTE on modifiers: the chrome state is built per-render, but modifier state shifts per-event. For Phase 1, use a static no-mod object; affordances that care about modifiers will read them from the gesture's `ToolCtx` once they're firing. We'll thread live modifier state in Phase 2 when the dispatcher integration lands and `chromeState` becomes the data passed to `hitTest`.

- [ ] **Step 3: Expose chromeState through helpersForLayers**

Inside the existing `helpersForLayers` object (around line 774), add a getter so consumer layers can read it:

```tsx
const helpersForLayers: CanvasHelpers<TPose> = {
  getEffectivePose: ...,
  getEffectiveBounds: ...,
  // Add:
  getChromeState: () => chromeState,
};
```

Update the `CanvasHelpers<TPose>` type (find it in the same file or adjacent) to add the new method:

```ts
export interface CanvasHelpers<TPose> {
  getEffectivePose: (id: string) => TPose | null;
  getEffectiveBounds: (id: string) => Bounds | null;
  getChromeState: () => ChromeState;
}
```

- [ ] **Step 4: Verify nothing regressed**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: clean + green. No tests should change behavior — this just exposes a new helper that nobody reads yet.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(canvas): wire ChromeState through helpers ref

Canvas constructs ChromeState on every render and exposes it via
helpersForLayers.getChromeState. Phase 2's affordance pipeline will
read it via the data slot in RenderLayer.hitTest. No consumer reads
it yet — pure plumbing.

Modifiers are stubbed as no-mod in Phase 1; Phase 2's dispatcher
integration threads live event-time modifiers into the hit-test path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Affordance scaffolding + dispatcher

### Task 4: Affordance + HitResult types

Pure type-only file. No behavior.

**Files:**
- Create: `src/affordances/types.ts`
- Create: `src/affordances/index.ts`

- [ ] **Step 1: Create the types file**

Create `src/affordances/types.ts`:

```ts
import type { DragChannel } from '../tools/types';
import type { ChromeState } from '../core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from '../core/viewport/view';

/**
 * @experimental
 * A single interactive piece of chrome. Pure functions; the kit composes
 * multiple affordances into a single RenderLayer per tool via
 * `composeAffordanceLayer`.
 */
export interface Affordance {
  /** Stable id for debug overlays + visibility maps. */
  id: string;
  /** Emit DrawCommands describing this affordance. Reads ChromeState +
   *  view. Returns [] when the affordance shouldn't render (no selection,
   *  multiActive false, etc. — affordance decides). */
  render(state: ChromeState, view: View): DrawCommand[];
  /** Optional. Returns a HitResult if `(worldX, worldY)` lands on this
   *  affordance, null otherwise. Affordances that are non-interactive
   *  (purely decorative) omit this. */
  hitTest?(
    worldX: number,
    worldY: number,
    state: ChromeState,
    view: View,
  ): HitResult | null;
}

/**
 * @experimental
 * Result of a layer's (or affordance's) hit-test. Nominates the gesture's
 * drag channel and (optionally) initial scratch state.
 */
export interface HitResult<TScratch = unknown> {
  drag: DragChannel<TScratch>;
  /** Initial scratch passed to drag.onStart. Lets the affordance pre-fill
   *  state from what its hit-test already computed (anchor: 'br',
   *  targetId: 'g1', etc.) so the tool's onStart doesn't re-hit-test. */
  initialScratch?: TScratch;
}
```

- [ ] **Step 2: Create the barrel**

Create `src/affordances/index.ts`:

```ts
export type { Affordance, HitResult } from './types';
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/affordances/
git commit -m "$(cat <<'EOF'
feat(affordances): Affordance + HitResult type definitions

Pure type-only scaffolding for the chrome-affordances architecture.
Affordances are reusable factory primitives that produce
{ render, hitTest? } pairs consumed by tools. HitResult is the layer
hit-test return shape: { drag, initialScratch? }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: composeAffordanceLayer helper

Bundle a list of affordances into a single `RenderLayer` whose `draw` iterates them and whose `hitTest` walks them top-down (last → first).

**Files:**
- Create: `src/affordances/composeAffordanceLayer.ts`
- Create: `src/affordances/composeAffordanceLayer.test.ts`
- Modify: `src/affordances/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/affordances/composeAffordanceLayer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import type { Affordance } from './types';
import type { ChromeState } from '../core/selection/chromeState';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: 1 };
const DIMS = { width: 200, height: 200 };

function makeState(): ChromeState {
  return {
    selection: [],
    multiActive: false,
    boundsOf: () => null,
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

const STUB_DRAG = { onStart: () => 'claim' as const };

describe('composeAffordanceLayer', () => {
  it('exposes the supplied id, label, and screen space', () => {
    const layer = composeAffordanceLayer('test-overlay', 'Test', []);
    expect(layer.id).toBe('test-overlay');
    expect(layer.label).toBe('Test');
    expect(layer.space).toBe('screen');
  });

  it('draw concatenates each affordance render output in array order', () => {
    const a: Affordance = {
      id: 'a',
      render: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { color: 'red' } }],
    };
    const b: Affordance = {
      id: 'b',
      render: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { color: 'blue' } }],
    };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    const out = layer.draw(makeState(), VIEW, DIMS);
    expect(out).toHaveLength(2);
    expect((out[0] as { fill: { color: string } }).fill.color).toBe('red');
    expect((out[1] as { fill: { color: string } }).fill.color).toBe('blue');
  });

  it('hitTest walks affordances top-down (last → first); first non-null wins', () => {
    const calls: string[] = [];
    const a: Affordance = {
      id: 'a',
      render: () => [],
      hitTest: () => { calls.push('a'); return null; },
    };
    const b: Affordance = {
      id: 'b',
      render: () => [],
      hitTest: () => { calls.push('b'); return { drag: STUB_DRAG }; },
    };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    const result = layer.hitTest!(0, 0, makeState(), VIEW, DIMS);
    expect(result).not.toBeNull();
    // 'b' is later in the array → tested first → returns the hit.
    // 'a' is never consulted because 'b' already claimed.
    expect(calls).toEqual(['b']);
  });

  it('hitTest returns null when every affordance returns null', () => {
    const a: Affordance = { id: 'a', render: () => [], hitTest: () => null };
    const b: Affordance = { id: 'b', render: () => [], hitTest: () => null };
    const layer = composeAffordanceLayer('x', 'X', [a, b]);
    expect(layer.hitTest!(0, 0, makeState(), VIEW, DIMS)).toBeNull();
  });

  it('hitTest skips affordances that omit the hitTest method', () => {
    const decorative: Affordance = { id: 'a', render: () => [] }; // no hitTest
    const interactive: Affordance = {
      id: 'b',
      render: () => [],
      hitTest: () => ({ drag: STUB_DRAG }),
    };
    const layer = composeAffordanceLayer('x', 'X', [decorative, interactive]);
    const result = layer.hitTest!(0, 0, makeState(), VIEW, DIMS);
    expect(result).not.toBeNull();
  });

  it('initialScratch from the hit propagates through the HitResult', () => {
    const aff: Affordance = {
      id: 'a',
      render: () => [],
      hitTest: () => ({ drag: STUB_DRAG, initialScratch: { anchor: 'br', targetId: 'g1' } }),
    };
    const layer = composeAffordanceLayer('x', 'X', [aff]);
    const result = layer.hitTest!(0, 0, makeState(), VIEW, DIMS);
    expect(result?.initialScratch).toEqual({ anchor: 'br', targetId: 'g1' });
  });

  it('empty affordance list: draw returns [], hitTest returns null', () => {
    const layer = composeAffordanceLayer('x', 'X', []);
    expect(layer.draw(makeState(), VIEW, DIMS)).toEqual([]);
    expect(layer.hitTest!(0, 0, makeState(), VIEW, DIMS)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/affordances/composeAffordanceLayer.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement composeAffordanceLayer**

Create `src/affordances/composeAffordanceLayer.ts`:

```ts
import type { RenderLayer } from '../core/layers/render';
import type { DrawCommand } from '../renderer';
import type { ChromeState } from '../core/selection/chromeState';
import type { Affordance, HitResult } from './types';

/**
 * @experimental
 * Bundle a list of Affordances into a single RenderLayer. The layer's
 * `draw` iterates affordances in array order (first → last = bottom →
 * top in paint stacking). Its `hitTest` walks the same list in REVERSE
 * order (last → first = top → bottom) and returns the first non-null
 * result.
 *
 * Affordances that omit `hitTest` are skipped during the hit walk
 * (they're decorative, not interactive).
 */
export function composeAffordanceLayer(
  id: string,
  label: string,
  affordances: readonly Affordance[],
): RenderLayer<ChromeState> {
  return {
    id,
    label,
    space: 'screen',
    draw: (state, view, _dims) => {
      const out: DrawCommand[] = [];
      for (const a of affordances) {
        for (const cmd of a.render(state, view)) out.push(cmd);
      }
      return out;
    },
    hitTest: (wx, wy, state, view, _dims): HitResult | null => {
      for (let i = affordances.length - 1; i >= 0; i--) {
        const a = affordances[i];
        if (!a.hitTest) continue;
        const r = a.hitTest(wx, wy, state, view);
        if (r !== null) return r;
      }
      return null;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/affordances/composeAffordanceLayer.test.ts
```

Expected: PASS — 7 tests green.

NOTE: this task references `RenderLayer.hitTest` (an optional field that doesn't exist yet — Task 6 adds it). TypeScript will accept the assignment because the helper's return value adds a field beyond the interface; the field is structurally extra. If TS complains, Task 6 lands the interface change and clears the error.

- [ ] **Step 5: Update barrel**

Edit `src/affordances/index.ts`:

```ts
export type { Affordance, HitResult } from './types';
export { composeAffordanceLayer } from './composeAffordanceLayer';
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(affordances): composeAffordanceLayer helper

Bundles a list of Affordances into a single RenderLayer. draw iterates
in array order (bottom → top); hitTest walks reverse (top → bottom),
first non-null wins. Skips decorative affordances (no hitTest method).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add `hitTest` to `RenderLayer<TData>`

Optional, additive interface change.

**Files:**
- Modify: `src/core/layers/render.ts`

- [ ] **Step 1: Read the current interface**

Read `src/core/layers/render.ts` lines 21–54. Locate the `RenderLayer<TData>` interface definition.

- [ ] **Step 2: Add the optional `hitTest` field**

Edit the interface to add (after the existing fields, before the closing `}`):

```ts
/**
 * Optional hit-test. When defined, the dispatcher consults this on
 * pointerdown (top-down layer order) before falling through to the
 * active tool's slot walk. First non-null result wins; null means
 * "I don't claim this hit, try the next layer."
 *
 * Coordinates are world-space. The `data` arg is the layer's
 * configured data slot (same as `draw`); `view` and `dims` mirror
 * `draw`'s arguments.
 */
hitTest?: (
  worldX: number,
  worldY: number,
  data: TData,
  view: View,
  dims: Dims,
) => import('../../affordances/types').HitResult | null;
```

(Inline-import `HitResult` with a `import('...')` type to avoid an import cycle between `core/layers` and `affordances/`.)

- [ ] **Step 3: Typecheck + tests**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: clean + green. The `composeAffordanceLayer` from Task 5 now type-checks against the interface.

- [ ] **Step 4: Commit**

```bash
git add src/core/layers/render.ts
git commit -m "$(cat <<'EOF'
feat(layers): optional hitTest on RenderLayer<TData>

Additive interface field. When defined, the dispatcher (Phase 2 task
8) consults it on pointerdown before falling through to the active
tool. Existing layers without hitTest are skipped during the walk.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Add `claimsAll` to `Tool<TScratch>`

Optional, additive. Modal tools opt into the affordance-pipeline-bypass via this predicate.

**Files:**
- Modify: `src/tools/types.ts`

- [ ] **Step 1: Read the Tool interface**

Read `src/tools/types.ts` around lines 102–144 (the `Tool<TScratch>` interface).

- [ ] **Step 2: Add `claimsAll` field**

Insert (after `dblTap?: DblTapChannel<TScratch>;`, before `cursor?:`):

```ts
/**
 * State-aware predicate. When true, this tool claims every pointerdown
 * and bypasses the affordance layer hit-test pipeline. Used by tools
 * in modal states (pen mid-path, text mid-edit) where affordance hits
 * would otherwise interrupt the in-progress gesture.
 *
 * Default: undefined (treated as false). Called once per pointerdown
 * with the tool's current ctx (scratch + view + modifiers).
 */
claimsAll?: (ctx: ToolCtx<TScratch>) => boolean;
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/tools/types.ts
git commit -m "$(cat <<'EOF'
feat(tools): optional Tool.claimsAll(ctx) predicate

Additive field. When a tool returns true from claimsAll(ctx), the
dispatcher (Phase 2 task 8) bypasses the affordance layer hit-test
pipeline and routes pointerdown straight to the tool's drag.onStart /
pointer.onDown. Used by modal tools (pen mid-path, text mid-edit).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Dispatcher integration

Extend `onPointerDown` to (1) check modal claims, (2) walk visible layers top-down for hit-tests, (3) fall through to the existing slot walk. Synthesize an `inFlight` entry for affordance claims so subsequent move/end events route correctly.

**Files:**
- Modify: `src/tools/dispatcher.ts`
- Modify: `src/tools/dispatcher.test.ts`
- Modify: `src/canvas/Canvas.tsx` (thread `getLayers` + `getChromeState` to dispatcher)

This is the single largest task in the plan — read it through before starting. The dispatcher's `inFlight` state machine has subtleties around scratch capture and threshold promotion; preserve them.

- [ ] **Step 1: Read the existing dispatcher**

Read `src/tools/dispatcher.ts` end-to-end (12K, ~330 lines). Focus areas:
- The `getSlots` callback (returns `{ hotkey, active, ambient }`).
- `inFlight` state machine: `null` | `{ phase: 'pending' | 'drag', tool, scratch, ... }`.
- `onPointerDown` (around line 122): captures the tool that wants the gesture, stashes scratch.
- `onPointerMove` threshold promotion (around line 190): promotes pending → drag, fires `drag.onStart`.
- `onPointerUp` (around line 215): drag.onEnd or pointer.onClick fallthrough.

- [ ] **Step 2: Extend the dispatcher options to accept layer + state providers**

Add to `ToolsDispatcherOptions` (the existing options interface near the top of the file):

```ts
/**
 * Optional. Returns the visible RenderLayers in dispatch order
 * (top-down: highest z-index first). When supplied, the dispatcher
 * consults each layer's hitTest on pointerdown before falling through
 * to the active-tool slot walk. When omitted, behavior matches the
 * legacy slot-walk-only path.
 */
getLayers?: () => readonly import('../core/layers/render').RenderLayer<unknown>[];
/**
 * Optional. Returns the live ChromeState passed as the `data` arg to
 * each layer's hitTest. Only consulted when `getLayers` is supplied.
 */
getChromeState?: () => import('../core/selection/chromeState').ChromeState;
/**
 * Optional. Returns the current view + canvas dims for layer hit-tests.
 * Only consulted when `getLayers` is supplied.
 */
getViewport?: () => {
  view: import('../core/viewport/view').View;
  dims: { width: number; height: number };
};
```

- [ ] **Step 3: Implement the new pointerdown path**

Find `function onPointerDown(e: PointerEvent): void` in dispatcher.ts. Add the modal-check + layer-walk paths BEFORE the existing slot walk:

```ts
function onPointerDown(e: PointerEvent): void {
  if (inFlight) {
    // Already mid-gesture; ignore extra pointerdowns.
    return;
  }
  const slots = opts.getSlots();
  const baseCtx = opts.getCtx({
    pointerEvent: e,
    modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
  });

  // 1. Modal claim check. Hotkey first (engaged-while-held > active).
  const modalTool =
    (slots.hotkey && tryClaimsAll(slots.hotkey, baseCtx)) ? slots.hotkey :
    (slots.active && tryClaimsAll(slots.active, baseCtx)) ? slots.active :
    null;
  if (modalTool) {
    return startSlotGesture(modalTool, e, baseCtx);
  }

  // 2. Layer hit-test pipeline.
  const layerHit = walkLayerHitTests(e);
  if (layerHit) {
    return startAffordanceGesture(layerHit, e, baseCtx);
  }

  // 3. Slot walk (legacy behavior).
  walkSlotsForClaim(slots, e, baseCtx);
}

function tryClaimsAll(tool: AnyTool, baseCtx: BaseToolCtx): boolean {
  if (!tool.claimsAll) return false;
  return tool.claimsAll(ctxFor(getInitialScratch(tool), baseCtx));
}

function walkLayerHitTests(e: PointerEvent): import('../affordances/types').HitResult | null {
  const getLayers = opts.getLayers;
  const getChromeState = opts.getChromeState;
  const getViewport = opts.getViewport;
  if (!getLayers || !getChromeState || !getViewport) return null;
  const layers = getLayers();
  if (layers.length === 0) return null;
  const state = getChromeState();
  const { view, dims } = getViewport();
  // Convert client coords to world for hit-test. Reuse the same
  // baseCtx the slot walk uses below — so we'd typically pull worldX/Y
  // off baseCtx. Inline the coord lookup since baseCtx isn't built yet
  // at this point in the function.
  const worldX = e.clientX; // FIXME: convert via getCtx-equivalent
  const worldY = e.clientY;
  for (const layer of layers) {
    if (!layer.hitTest) continue;
    const result = layer.hitTest(worldX, worldY, state as never, view, dims);
    if (result !== null) return result;
  }
  return null;
}
```

NOTE on the FIXME: Canvas already converts clientX/clientY → worldX/worldY for tool dispatch via the `clientToWorld` callback threaded through `getCtx`. To reuse that conversion, build `baseCtx` BEFORE `walkLayerHitTests` and pass it in:

```ts
function onPointerDown(e: PointerEvent): void {
  if (inFlight) return;
  const slots = opts.getSlots();
  const baseCtx = opts.getCtx({
    pointerEvent: e,
    modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
  });
  // ... modal check unchanged ...
  // Pass baseCtx.worldX / baseCtx.worldY into walkLayerHitTests.
  const layerHit = walkLayerHitTests(baseCtx.worldX, baseCtx.worldY);
  // ... rest unchanged ...
}

function walkLayerHitTests(worldX: number, worldY: number): /* ... */ {
  // ... loop, calling layer.hitTest(worldX, worldY, state, view, dims) ...
}
```

(Verify the `BaseToolCtx` shape exposes `worldX/worldY` — read the `getCtx` callback's return type at the top of `dispatcher.ts`. If it doesn't, add them via the existing `clientToWorld` threading.)

- [ ] **Step 4: Implement `startAffordanceGesture`**

The gesture lifecycle for an affordance claim mirrors a normal active-tool drag, except the tool reference is virtual:

```ts
function startAffordanceGesture(
  result: import('../affordances/types').HitResult,
  e: PointerEvent,
  baseCtx: BaseToolCtx,
): void {
  // Synthesize a virtual tool whose drag channel comes from the hit result.
  // The dispatcher only references inFlight.tool.drag for subsequent
  // pointermove / pointerup; other Tool fields aren't consulted mid-gesture.
  const virtualTool: AnyTool = {
    id: '__affordance__',
    drag: result.drag,
  } as AnyTool;
  const initialScratch = result.initialScratch;
  const ctx = ctxFor(initialScratch, baseCtx);
  // Fire onStart immediately (affordance hits skip the threshold gating;
  // the layer's hitTest already decided this is a gesture).
  result.drag.onStart?.(e, ctx);
  inFlight = {
    phase: 'drag',
    tool: virtualTool,
    scratch: initialScratch,
    startEvent: e,
    startClient: { x: e.clientX, y: e.clientY },
  };
}
```

If the existing `inFlight` shape has more fields, populate them sensibly (e.g. `lastClient` mirrors `startClient` initially).

- [ ] **Step 5: Add dispatcher tests**

Locate `src/tools/dispatcher.test.ts`. Add a new describe block:

```ts
describe('dispatcher — affordance hit-test pipeline', () => {
  it('layer hitTest claim routes drag.onStart/onMove/onEnd to the layer-supplied channel', () => {
    const events: string[] = [];
    const drag = {
      onStart: () => { events.push('start'); return undefined; },
      onMove: () => { events.push('move'); return undefined; },
      onEnd: () => { events.push('end'); return undefined; },
    };
    const layer = {
      id: 'aff', label: 'A', draw: () => [],
      hitTest: () => ({ drag }),
    };
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: null, ambient: [] }),
      getCtx: () => ({ worldX: 0, worldY: 0, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }) as never,
      getLayers: () => [layer as never],
      getChromeState: () => ({ selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }),
      getViewport: () => ({ view: { x: 0, y: 0, scale: 1 }, dims: { width: 100, height: 100 } }),
    });
    dispatcher.onPointerDown(new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 }));
    dispatcher.onPointerMove(new PointerEvent('pointermove', { clientX: 6, clientY: 6, pointerId: 1 }));
    dispatcher.onPointerUp(new PointerEvent('pointerup', { clientX: 6, clientY: 6, pointerId: 1 }));
    expect(events).toEqual(['start', 'move', 'end']);
  });

  it('null layer hitTest falls through; layer was consulted exactly once', () => {
    const layerHitTest = vi.fn(() => null);
    const layer = { id: 'aff', label: 'A', draw: () => [], hitTest: layerHitTest as never };
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: null, ambient: [] }),
      getCtx: () => ({ worldX: 5, worldY: 5, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }) as never,
      getLayers: () => [layer as never],
      getChromeState: () => ({ selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }),
      getViewport: () => ({ view: { x: 0, y: 0, scale: 1 }, dims: { width: 100, height: 100 } }),
    });
    dispatcher.onPointerDown(new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 }));
    expect(layerHitTest).toHaveBeenCalledTimes(1);
    expect(layerHitTest).toHaveBeenCalledWith(5, 5, expect.anything(), expect.anything(), expect.anything());
  });

  it('modal claim (active.claimsAll → true) bypasses the layer pipeline', () => {
    const events: string[] = [];
    const layerHitTest = vi.fn(() => null);
    const activeStart = () => { events.push('active.start'); return 'claim' as const; };
    const dispatcher = createToolsDispatcher({
      getSlots: () => ({ hotkey: null, active: { id: 'pen', drag: { onStart: activeStart }, claimsAll: () => true } as never, ambient: [] }),
      getCtx: () => ({ worldX: 0, worldY: 0, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }) as never,
      getLayers: () => [{ id: 'aff', label: 'A', draw: () => [], hitTest: layerHitTest as never } as never],
      getChromeState: () => ({ selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }),
      getViewport: () => ({ view: { x: 0, y: 0, scale: 1 }, dims: { width: 100, height: 100 } }),
    });
    dispatcher.onPointerDown(new PointerEvent('pointerdown', { clientX: 5, clientY: 5, pointerId: 1 }));
    expect(layerHitTest).not.toHaveBeenCalled();
    expect(events).toContain('active.start');
  });
});
```

- [ ] **Step 6: Wire Canvas to pass the new providers to the dispatcher**

In `src/canvas/Canvas.tsx`, find where the dispatcher is created (the `useTools` call surfaces the dispatcher; Canvas binds DOM listeners to it). The dispatcher options already flow through `useTools`'s arg shape. Update `useTools` (or the `createToolsDispatcher` call inside `useTools`) to accept and pass through the three new optional providers. Then in Canvas:

```tsx
// In Canvas.tsx, where toolsApi is built / forwarded:
const layersOrderedTopDown = useMemo(() => {
  // Use the same ordered layer list Canvas hands to drawLayers, but
  // reversed so top-z is first.
  return [...orderedLayers].reverse();
}, [orderedLayers]);

const dispatcherProviders = useMemo(() => ({
  getLayers: () => layersOrderedTopDown,
  getChromeState: () => chromeState,
  getViewport: () => ({ view: viewState, dims: { width, height } }),
}), [layersOrderedTopDown, chromeState, viewState, width, height]);

// Thread dispatcherProviders into the dispatcher options. The exact
// integration point depends on whether tools={tools} is supplied or
// Canvas builds tools internally — check both code paths.
```

(The existing layer ordering is already computed for `drawLayers`. Reuse it; reverse for top-down hit-test order.)

- [ ] **Step 7: Run tests**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: clean + green. New dispatcher tests pass; existing tests untouched.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(dispatcher): affordance hit-test pipeline + modal claim bypass

Pointerdown now does (1) modal claim check (hotkey then active —
claimsAll(ctx) bypasses the layer pipeline), (2) layer hit-test walk
top-down (first non-null HitResult routes the gesture to the
layer-supplied drag channel with optional initial scratch), (3)
existing slot walk fallthrough.

Three new optional providers on the dispatcher options:
- getLayers: ordered top-down for the hit-test walk
- getChromeState: data arg for layer.hitTest
- getViewport: view + dims for the hit-test call

When any of the three are missing, the dispatcher falls back to the
legacy slot-walk-only behavior — no behavior change for existing
consumers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Re-export Affordance / HitResult / composeAffordanceLayer from the kit barrel

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add the re-exports**

Locate the section in `src/index.ts` near the existing `selectionOverlay` re-exports. Append:

```ts
export {
  composeAffordanceLayer,
  type Affordance,
  type HitResult,
} from './affordances';
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
npm run build 2>&1 | grep -E "Build success|error" | tail -3
```

Expected: clean + Build success.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "$(cat <<'EOF'
feat: expose composeAffordanceLayer + Affordance/HitResult on barrel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Corner-resize affordance + select-tool migration

### Task 10: createCornerResizeAffordance

The first real affordance. Reads ChromeState, draws screen-space corner handles for the active selection (or union AABB in multi-mode), and hit-tests cursor against them. Returns a HitResult whose `drag` channel runs `useResize`.

Implementation references:
- Existing inline corner-handle hit-test: `src/tools/builtin/useSelectTool.ts` lines ~390–404 (the `cornerResizeHandles` + `hitCornerHandle` calls in `pointer.onDown`).
- Existing handle render: `src/features/selection/overlay.ts` (the `createSelectionHandlesLayer` function that emits the handle drawcommands).

**Files:**
- Create: `src/affordances/cornerResize.ts`
- Create: `src/affordances/cornerResize.test.ts`
- Modify: `src/affordances/index.ts`

- [ ] **Step 1: Read the existing handle math primitives**

```bash
grep -n "cornerResizeHandles\|hitCornerHandle" src/interactions/actions/resize/cornerHandles.ts
```

These two functions are the kit-internal primitives the new affordance reuses. Read their signatures.

- [ ] **Step 2: Write the failing tests**

Create `src/affordances/cornerResize.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createCornerResizeAffordance } from './cornerResize';
import type { ChromeState } from '../core/selection/chromeState';
import { asNodeId } from '../core/scene/types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: 1 };

function stateWithSingle(): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => ({ x: 100, y: 100, width: 50, height: 40 }),
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

function stateWithMulti(): ChromeState {
  return {
    selection: [asNodeId('a'), asNodeId('b')],
    multiActive: true,
    boundsOf: (id) => id === 'a'
      ? { x: 0, y: 0, width: 50, height: 50 }
      : { x: 100, y: 100, width: 50, height: 50 },
    unionBounds: { x: 0, y: 0, width: 150, height: 150 },
    modifiers: NO_MOD,
  };
}

describe('createCornerResizeAffordance', () => {
  it('exposes a stable id for visibility maps', () => {
    const aff = createCornerResizeAffordance();
    expect(aff.id).toBe('corner-resize');
  });

  it('renders nothing when no selection', () => {
    const aff = createCornerResizeAffordance();
    const state: ChromeState = {
      selection: [],
      multiActive: false,
      boundsOf: () => null,
      unionBounds: null,
      modifiers: NO_MOD,
    };
    expect(aff.render(state, VIEW)).toEqual([]);
  });

  it('renders 4 corner handles for a single selection in single-mode', () => {
    const aff = createCornerResizeAffordance();
    const cmds = aff.render(stateWithSingle(), VIEW);
    // Each handle is at least one path command (rect for the handle itself).
    expect(cmds.length).toBeGreaterThanOrEqual(4);
  });

  it('renders 4 corner handles for the union AABB in multi-mode', () => {
    const aff = createCornerResizeAffordance();
    const cmds = aff.render(stateWithMulti(), VIEW);
    expect(cmds.length).toBeGreaterThanOrEqual(4);
  });

  it('hitTest returns null when cursor is far from any handle', () => {
    const aff = createCornerResizeAffordance();
    const result = aff.hitTest!(50, 50, stateWithSingle(), VIEW);
    expect(result).toBeNull();
  });

  it('hitTest claims when cursor is on a corner handle', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    // Selection at (100, 100, 50, 40). Top-left corner is (100, 100); within
    // 8 world-px hit radius.
    const result = aff.hitTest!(100, 100, stateWithSingle(), VIEW);
    expect(result).not.toBeNull();
    expect(result?.drag).toBeDefined();
  });

  it('hitTest initialScratch identifies the picked anchor + target', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    // Bottom-right corner of (100, 100, 50, 40) is (150, 140).
    const result = aff.hitTest!(150, 140, stateWithSingle(), VIEW);
    expect(result?.initialScratch).toMatchObject({
      anchor: 'bottom-right',
      targetId: 'a',
    });
  });

  it('hitTest in multi-mode targets the synthetic union (not individual members)', () => {
    const aff = createCornerResizeAffordance({ handleHitRadius: 8 });
    // Union bounds are (0, 0, 150, 150). Top-left is (0, 0).
    const result = aff.hitTest!(0, 0, stateWithMulti(), VIEW);
    expect(result?.initialScratch).toMatchObject({
      anchor: 'top-left',
      targetId: '__weasel:multi-selection',
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run src/affordances/cornerResize.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement createCornerResizeAffordance**

Create `src/affordances/cornerResize.ts`:

```ts
import type { Affordance, HitResult } from './types';
import type { ChromeState } from '../core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from '../core/viewport/view';
import type { DragChannel } from '../tools/types';
import {
  cornerResizeHandles,
  hitCornerHandle,
} from '../interactions/actions/resize/cornerHandles';
import { viewToTransform } from '../core/viewport/view';
import { worldToScreen } from '../core/viewport/viewTransform';
import { MULTI_RESIZE_TARGET_ID } from '../tools/builtin/useSelectTool';

/** Synthetic id matching `useSelectTool`'s union-target convention. */
const MULTI = MULTI_RESIZE_TARGET_ID;

export interface CornerResizeAffordanceOptions {
  /** Hit radius (world-px) for the corner handles. Default 8 / view.scale. */
  handleHitRadius?: number;
  /** Visual handle size (screen-px). Default 8. */
  handleSize?: number;
  /** Stroke / fill colors. Defaults match the existing select-tool overlay. */
  fill?: string;
  stroke?: string;
}

export interface CornerResizeScratch {
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  targetId: string;
}

const DEFAULT_FILL = '#d4c4a8';
const DEFAULT_STROKE = '#1a130d';

/**
 * @experimental
 * Corner-handle affordance for resizing the active selection (single
 * member in single-mode; the union AABB in multi-mode). Reads
 * ChromeState; emits screen-space DrawCommands for the four corners;
 * returns a HitResult whose drag channel routes to useResize against the
 * picked target.
 *
 * Reusable across tools — `useSelectTool` includes it; custom transform
 * tools can include it too.
 */
export function createCornerResizeAffordance(
  opts: CornerResizeAffordanceOptions = {},
): Affordance {
  const {
    handleHitRadius = 8,
    handleSize = 8,
    fill = DEFAULT_FILL,
    stroke = DEFAULT_STROKE,
  } = opts;

  const drag: DragChannel<CornerResizeScratch> = {
    onStart: (_e, ctx) => {
      // The dispatcher already passed the affordance's initialScratch as
      // ctx.scratch. The body of the resize gesture is owned by useResize;
      // this onStart's job is to start a useResize controller against the
      // picked target. Delegating to useResize requires an adapter; in the
      // affordance world we pull it from ctx.adapter (cast at the call site).
      // The select-tool's scratch wiring (kind: 'resize', targetId, anchor)
      // already exists; we mirror it.
      // [Body filled in once useSelectTool is migrated; see Task 11.]
      void ctx;
      return 'claim';
    },
    onMove: (_e, _ctx) => 'claim',
    onEnd: (_e, _ctx) => 'claim',
    onCancel: () => {},
  };

  return {
    id: 'corner-resize',
    render(state: ChromeState, view: View): DrawCommand[] {
      const target = pickRenderTarget(state);
      if (!target) return [];
      const t = viewToTransform(view);
      const corners = cornerResizeHandles(target.bounds);
      const cmds: DrawCommand[] = [];
      const half = handleSize / 2;
      for (const c of corners) {
        const [sx, sy] = worldToScreen(c.cx, c.cy, t);
        cmds.push({
          kind: 'path',
          path: { kind: 'rect', x: sx - half, y: sy - half, width: handleSize, height: handleSize },
          fill: { color: fill },
          stroke: { paint: { color: stroke }, width: 1 },
        });
      }
      return cmds;
    },
    hitTest(worldX, worldY, state, view): HitResult<CornerResizeScratch> | null {
      const target = pickRenderTarget(state);
      if (!target) return null;
      const radiusWorld = handleHitRadius / view.scale;
      const corners = cornerResizeHandles(target.bounds);
      for (const c of corners) {
        if (hitCornerHandle(c, worldX, worldY, radiusWorld)) {
          return {
            drag,
            initialScratch: { anchor: c.anchor as CornerResizeScratch['anchor'], targetId: target.id },
          };
        }
      }
      return null;
    },
  };
}

function pickRenderTarget(state: ChromeState): {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
} | null {
  if (state.multiActive && state.unionBounds) {
    return { id: MULTI, bounds: state.unionBounds };
  }
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  return null;
}
```

NOTE on `drag` body: The actual useResize dispatch will land when `useSelectTool` is migrated (Task 11). For now, the drag handlers are no-op stubs that claim — Task 11 fills them in by binding the scratch to the active resize controller exposed by `useSelectTool`. This deferral keeps the affordance file dependency-light; the tool integration is what brings useResize in.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/affordances/cornerResize.test.ts
```

Expected: PASS — 8 tests green.

- [ ] **Step 6: Update barrel**

Edit `src/affordances/index.ts`:

```ts
export type { Affordance, HitResult } from './types';
export { composeAffordanceLayer } from './composeAffordanceLayer';
export {
  createCornerResizeAffordance,
  type CornerResizeAffordanceOptions,
  type CornerResizeScratch,
} from './cornerResize';
```

- [ ] **Step 7: Re-export from main barrel**

Edit `src/index.ts`'s affordance re-export block to add:

```ts
export {
  composeAffordanceLayer,
  createCornerResizeAffordance,
  type Affordance,
  type HitResult,
  type CornerResizeAffordanceOptions,
  type CornerResizeScratch,
} from './affordances';
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(affordances): createCornerResizeAffordance

First concrete affordance. Reads ChromeState (single-mode → bounds of
the lone selected id; multi-mode → union AABB), draws four screen-space
corner handles, hit-tests cursor against them. Returns a HitResult
with initialScratch identifying the picked anchor + target id; the
drag body is filled in by useSelectTool when it migrates (Task 11).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Migrate useSelectTool to consume the corner-resize affordance

Drop the inline corner-handle hit-test from `pointer.onDown`. Build the tool's overlay via `composeAffordanceLayer`. Wire the affordance's `drag` channel through to the existing `useResize` controller.

**Files:**
- Modify: `src/tools/builtin/useSelectTool.ts`

This task is surgical — preserve every existing behavior the tool exposes (cursor, double-tap, keybinding, marquee fall-through, body-hit click). Only the corner-handle path changes.

- [ ] **Step 1: Read the existing corner-handle path**

Read `src/tools/builtin/useSelectTool.ts` lines ~370–445 (the body-hit + corner-handle + rotation-handle dispatch). Identify:
- Where corner-handle hit-test runs (`hitCornerHandle` calls).
- How the resize gesture is started (`ctx.scratch = { kind: 'resize', targetId, anchor }`).
- Where the existing `useResize` hook is instantiated and what its controller looks like.

- [ ] **Step 2: Bind the affordance's drag channel to the useResize controller**

Inside `useSelectTool`, after the `useResize` hook is called, expose the controller as a stable ref so the affordance's `drag` callbacks can reach it. Then construct the affordance:

```tsx
import { createCornerResizeAffordance, type CornerResizeScratch } from '../../affordances/cornerResize';
import { composeAffordanceLayer } from '../../affordances/composeAffordanceLayer';

// Inside the hook body, after `const resize = useResize(adapter, ...)`:
const resizeRef = useRef(resize);
resizeRef.current = resize;

// Build the corner-resize affordance with a drag channel that delegates
// to the resize controller. The affordance's initialScratch supplies
// the anchor + targetId; we map that to a useResize.start(...) call.
const cornerAff = useMemo(() => createCornerResizeAffordance({
  handleHitRadius,
  handleSize: handleHitRadius, // matches existing convention
}), [handleHitRadius]);

// Override the affordance's stub drag with one that drives useResize.
// composeAffordanceLayer doesn't introspect the affordance's drag —
// it just hands it to the dispatcher on hit — so we wrap.
const cornerAffWithDrag: Affordance = useMemo(() => ({
  ...cornerAff,
  hitTest: (wx, wy, state, view) => {
    const inner = cornerAff.hitTest?.(wx, wy, state, view);
    if (!inner) return null;
    const scratch = inner.initialScratch as CornerResizeScratch;
    return {
      drag: {
        onStart: (e, ctx) => {
          resizeRef.current.start(scratch.targetId, scratch.anchor, ctx.worldX, ctx.worldY, ctx.modifiers);
          return 'claim';
        },
        onMove: (e, ctx) => {
          resizeRef.current.move(ctx.worldX, ctx.worldY, ctx.modifiers);
          return 'claim';
        },
        onEnd: (e, ctx) => {
          resizeRef.current.end();
          return 'claim';
        },
        onCancel: () => {
          resizeRef.current.cancel();
        },
      },
      initialScratch: scratch,
    };
  },
}), [cornerAff]);
```

NOTE on the resize controller surface: the `useResize` controller's exact methods (`start` vs `begin` vs `pointerDown`) will need to be verified against `src/interactions/actions/resize/resize.ts`. Read the file and adapt the `start` / `move` / `end` calls above to whatever the controller actually exposes. The arguments — target id, anchor, world coords, modifiers — are right; method names may differ.

- [ ] **Step 3: Build the overlay layer via composeAffordanceLayer**

Locate where the tool's overlay is currently constructed (around line 218 in `useSelectTool.ts`). Replace the existing manually-built `RenderLayer` with:

```tsx
const overlay = useMemo<RenderLayer<unknown>>(
  () => composeAffordanceLayer('select-overlay', 'Select chrome', [cornerAffWithDrag]) as RenderLayer<unknown>,
  [cornerAffWithDrag],
);
```

(In Phase 4 the rotation affordance gets added to the array. For now, just corner-resize.)

NOTE: composeAffordanceLayer returns `RenderLayer<ChromeState>`. The Tool record's overlay field is `RenderLayer<unknown>`. The cast at the assignment site is intentional — Canvas threads the ChromeState into the layer's data slot at draw time.

- [ ] **Step 4: Drop the inline corner-handle branch from pointer.onDown**

Find the corner-handle hit-test in `pointer.onDown` (lines ~390–404 — the `cornerResizeHandles(b)` + `hitCornerHandle(...)` loop inside the "single selection only" guard). Delete that block. The body-hit and rotation-handle branches stay.

The pointer.onDown should now be:
1. Rotation handle hit-test (still present).
2. Body hit → move (+ select).
3. Empty → defer clear to onClick.

(Step 5 of pointer.onDown — corner-resize handles — is now the affordance's job.)

- [ ] **Step 5: Run typecheck + tests**

```bash
npx tsc --noEmit
npx vitest run
```

Expected: clean + green. The existing `useSelectTool.bringToFront.test.tsx` and `useSelectTool.zorder.test.tsx` should still pass — they don't drive corner-handle gestures specifically. Any test that DID drive corner handles (check `integration.test.tsx`) needs to be verified manually.

- [ ] **Step 6: Run the full vitest suite to confirm no regression**

```bash
npx vitest run --reporter=dot
```

Expected: full suite green, same total as before. If a corner-resize integration test fails, the affordance's drag wiring (Step 2) is the most likely culprit — verify the resize controller method names.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(select-tool): migrate corner-resize to affordance

useSelectTool's overlay is now built via composeAffordanceLayer over a
corner-resize affordance; the inline corner-handle hit-test in
pointer.onDown is gone. The affordance's drag channel delegates to the
existing useResize controller via a ref.

User-visible effect: corner handles work regardless of which tool is
active — clicking a handle while lasso/pen is the active tool now
fires the resize gesture instead of the active tool's drag.onStart.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Cross-tool integration test

Verify the principle: corner-resize handle is hittable while a non-select tool is active.

**Files:**
- Modify: `src/tools/builtin/integration.test.tsx`

- [ ] **Step 1: Add the test case**

Append to the `Phase 2a integration` describe block:

```tsx
it('cross-tool: corner-resize affordance fires while a non-select tool is active', () => {
  const applyBatch = vi.fn();
  function Harness() {
    const [rects, setRects] = useState<Rect[]>([
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
    ]);
    const rectsRef = useRef(rects);
    rectsRef.current = rects;
    const sel = useSelection({ initial: [asNodeId('a')], mode: 'single' });
    const base = arrayAdapter<Rect, Pose>({
      ref: rectsRef, setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    });
    const adapter = { ...base, ...sel.adapterMethods, applyBatch };
    const select = useSelectTool(adapter, {});
    // Active is a custom no-op tool; select is registered but not active —
    // its corner-resize affordance should still fire.
    const noop = defineTool({ id: 'noop', drag: { onStart: () => 'claim' } });
    const tools = useTools({
      active: 'noop',
      registry: { select, noop },
    });
    return (
      <Canvas
        width={200} height={200} layers={{}}
        adapter={adapter} selection={sel} tools={tools} clientToWorld={C2W}
      />
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  canvas.setPointerCapture = () => {};
  // Click on the bottom-right corner of rect 'a' (at world 100, 100).
  fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: 110, clientY: 110, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 110, clientY: 110, pointerId: 1 });
  // useResize → applyBatch with a Transform op labeled 'Resize'. If the
  // affordance pipeline is broken, the click would route to the noop
  // tool's drag.onStart instead.
  expect(applyBatch).toHaveBeenCalledTimes(1);
  const [, label] = applyBatch.mock.calls[0] as [unknown, string];
  expect(label).toBe('Resize');
});
```

- [ ] **Step 2: Run the test**

```bash
npx vitest run src/tools/builtin/integration.test.tsx
```

Expected: PASS — corner resize fires through the affordance pipeline.

- [ ] **Step 3: Commit**

```bash
git add src/tools/builtin/integration.test.tsx
git commit -m "$(cat <<'EOF'
test(select-tool): cross-tool corner-resize via affordance pipeline

Pins the load-bearing principle: a visible corner handle is hittable
even when a non-select tool is active. Drives a resize-shaped drag
through Canvas + dispatcher with a no-op tool in the active slot;
asserts useResize fired through the affordance's drag channel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Rotation affordance

### Task 13: createRotationAffordance

Same shape as corner-resize. Reads ChromeState; renders the rotation handle (a circle above the bounds top edge); hit-tests cursor against it. Returns a HitResult whose drag channel runs `useRotate`.

**Files:**
- Create: `src/affordances/rotationHandle.ts`
- Create: `src/affordances/rotationHandle.test.ts`
- Modify: `src/affordances/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Read the existing rotation-handle math**

```bash
grep -n "rotationHandle\|hitRotationHandle\|DEFAULT_ROTATION_HANDLE_DISTANCE" src/interactions/actions/rotate/handle.ts
```

- [ ] **Step 2: Write tests + impl**

Mirror the structure of `cornerResize.test.ts` and `cornerResize.ts`. The render produces 1 (or 2: handle + leader-line) DrawCommand; the hit-test checks `hitRotationHandle(...)` against the bounds-top-center anchor.

```ts
// src/affordances/rotationHandle.ts
import type { Affordance, HitResult } from './types';
import type { ChromeState } from '../core/selection/chromeState';
import type { DrawCommand } from '../renderer';
import type { View } from '../core/viewport/view';
import type { DragChannel } from '../tools/types';
import {
  rotationHandle,
  hitRotationHandle,
  DEFAULT_ROTATION_HANDLE_DISTANCE,
} from '../interactions/actions/rotate/handle';
import { viewToTransform } from '../core/viewport/view';
import { worldToScreen } from '../core/viewport/viewTransform';
import { MULTI_RESIZE_TARGET_ID } from '../tools/builtin/useSelectTool';

export interface RotationAffordanceOptions {
  /** World-pixel distance from the bounds top edge to the handle center.
   *  Default DEFAULT_ROTATION_HANDLE_DISTANCE (=24). */
  distance?: number;
  /** Handle hit radius (world-px / view.scale). Default 8. */
  handleHitRadius?: number;
  /** Visual handle radius (screen-px). Default 5. */
  handleSize?: number;
  fill?: string;
  stroke?: string;
}

export interface RotationScratch {
  targetId: string;
}

export function createRotationAffordance(opts: RotationAffordanceOptions = {}): Affordance {
  const {
    distance = DEFAULT_ROTATION_HANDLE_DISTANCE,
    handleHitRadius = 8,
    handleSize = 5,
    fill = '#d4c4a8',
    stroke = '#1a130d',
  } = opts;

  // The drag body is filled in by useSelectTool when it migrates (Task 14).
  const drag: DragChannel<RotationScratch> = {
    onStart: () => 'claim',
    onMove: () => 'claim',
    onEnd: () => 'claim',
    onCancel: () => {},
  };

  return {
    id: 'rotation-handle',
    render(state: ChromeState, view: View): DrawCommand[] {
      const target = pickTarget(state);
      if (!target) return [];
      const handle = rotationHandle(target.bounds, distance);
      const t = viewToTransform(view);
      const [sx, sy] = worldToScreen(handle.cx, handle.cy, t);
      const [bx, by] = worldToScreen(
        target.bounds.x + target.bounds.width / 2,
        target.bounds.y,
        t,
      );
      // Leader line bounds-top-center → handle center, then a circle handle.
      return [
        {
          kind: 'path',
          path: { kind: 'rect', x: Math.min(bx, sx), y: Math.min(by, sy) - 0.5, width: Math.abs(sx - bx) + 1, height: Math.abs(sy - by) + 1 },
          stroke: { paint: { color: stroke }, width: 1 },
        },
        // Circle handle (rendered as a tight square for now; the kit's
        // existing rotation overlay uses an arc — port that detail here
        // if pixel-fidelity matters.)
        {
          kind: 'path',
          path: { kind: 'rect', x: sx - handleSize, y: sy - handleSize, width: handleSize * 2, height: handleSize * 2 },
          fill: { color: fill },
          stroke: { paint: { color: stroke }, width: 1 },
        },
      ];
    },
    hitTest(worldX, worldY, state, view): HitResult<RotationScratch> | null {
      const target = pickTarget(state);
      if (!target) return null;
      const handle = rotationHandle(target.bounds, distance);
      const radiusWorld = handleHitRadius / view.scale;
      if (hitRotationHandle(handle, worldX, worldY, radiusWorld)) {
        return { drag, initialScratch: { targetId: target.id } };
      }
      return null;
    },
  };
}

function pickTarget(state: ChromeState): {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
} | null {
  if (state.multiActive && state.unionBounds) {
    return { id: MULTI_RESIZE_TARGET_ID, bounds: state.unionBounds };
  }
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  return null;
}
```

Test file:

```ts
// src/affordances/rotationHandle.test.ts
import { describe, expect, it } from 'vitest';
import { createRotationAffordance } from './rotationHandle';
import type { ChromeState } from '../core/selection/chromeState';
import { asNodeId } from '../core/scene/types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: 1 };

function stateWithSingle(): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

describe('createRotationAffordance', () => {
  it('exposes a stable id for visibility maps', () => {
    expect(createRotationAffordance().id).toBe('rotation-handle');
  });

  it('renders nothing when no selection', () => {
    const aff = createRotationAffordance();
    const state: ChromeState = {
      selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: NO_MOD,
    };
    expect(aff.render(state, VIEW)).toEqual([]);
  });

  it('renders the leader line + handle when a single selection has bounds', () => {
    const cmds = createRotationAffordance().render(stateWithSingle(), VIEW);
    expect(cmds.length).toBeGreaterThanOrEqual(2);
  });

  it('hitTest returns null when cursor is far from the handle', () => {
    const aff = createRotationAffordance({ handleHitRadius: 8 });
    expect(aff.hitTest!(0, 0, stateWithSingle(), VIEW)).toBeNull();
  });

  it('hitTest claims when cursor is on the handle', () => {
    const aff = createRotationAffordance({ distance: 24, handleHitRadius: 8 });
    // Bounds (0,0,100,100); top-center (50,0); handle 24 px above → (50, -24).
    const result = aff.hitTest!(50, -24, stateWithSingle(), VIEW);
    expect(result).not.toBeNull();
    expect(result?.initialScratch).toMatchObject({ targetId: 'a' });
  });
});
```

- [ ] **Step 3: Run tests, update barrels, commit**

```bash
npx vitest run src/affordances/rotationHandle.test.ts
```

Update `src/affordances/index.ts` and `src/index.ts` re-exports.

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(affordances): createRotationAffordance

Same shape as createCornerResizeAffordance; reads ChromeState,
renders the bounds-top → handle leader line + handle circle, hit-tests
cursor. drag stub is filled in by useSelectTool's migration (Task 14).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Wire rotation affordance into useSelectTool

**Files:**
- Modify: `src/tools/builtin/useSelectTool.ts`

- [ ] **Step 1: Build the rotation affordance + bind drag to useRotate**

Mirror the cornerResize wiring from Task 11. After the existing `useRotate(...)` call, expose its controller via ref. Build the affordance:

```tsx
import { createRotationAffordance, type RotationScratch } from '../../affordances/rotationHandle';

// After useRotate:
const rotateRef = useRef(rotate);
rotateRef.current = rotate;

const rotationAff = useMemo(() => createRotationAffordance({
  distance: rotationHandleDistance,
  handleHitRadius,
}), [rotationHandleDistance, handleHitRadius]);

const rotationAffWithDrag: Affordance = useMemo(() => ({
  ...rotationAff,
  hitTest: (wx, wy, state, view) => {
    const inner = rotationAff.hitTest?.(wx, wy, state, view);
    if (!inner) return null;
    const scratch = inner.initialScratch as RotationScratch;
    return {
      drag: {
        onStart: (e, ctx) => {
          rotateRef.current.start(scratch.targetId, ctx.worldX, ctx.worldY, ctx.modifiers);
          return 'claim';
        },
        onMove: (e, ctx) => {
          rotateRef.current.move(ctx.worldX, ctx.worldY, ctx.modifiers);
          return 'claim';
        },
        onEnd: () => {
          rotateRef.current.end();
          return 'claim';
        },
        onCancel: () => rotateRef.current.cancel(),
      },
      initialScratch: scratch,
    };
  },
}), [rotationAff]);
```

(Adapt the `rotateRef.current.start/move/end` method names to whatever `useRotate`'s controller actually exposes — read `src/interactions/actions/rotate/rotate.ts`.)

- [ ] **Step 2: Add rotationAff to the composite overlay**

```tsx
const overlay = useMemo<RenderLayer<unknown>>(
  () => composeAffordanceLayer('select-overlay', 'Select chrome', [
    cornerAffWithDrag,
    rotationAffWithDrag,
  ]) as RenderLayer<unknown>,
  [cornerAffWithDrag, rotationAffWithDrag],
);
```

- [ ] **Step 3: Drop the inline rotation-handle branch from pointer.onDown**

Find the rotation-handle hit-test (around lines ~376–388) inside `pointer.onDown`. Delete the block. Body-hit and empty-hit branches stay.

- [ ] **Step 4: Run tests + commit**

```bash
npx tsc --noEmit
npx vitest run
git add -A
git commit -m "$(cat <<'EOF'
refactor(select-tool): migrate rotation handle to affordance

Same pattern as the corner-resize migration. Inline rotation hit-test
in pointer.onDown is gone; the tool's overlay is now built from
[cornerResize, rotationHandle] affordances.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Cross-tool rotation integration test

Same shape as Task 12. Drive a rotation drag while a non-select tool is active; assert `useRotate` fired.

**Files:**
- Modify: `src/tools/builtin/integration.test.tsx`

- [ ] **Step 1: Add the test**

```tsx
it('cross-tool: rotation affordance fires while a non-select tool is active', () => {
  const applyBatch = vi.fn();
  function Harness() {
    const [rects, setRects] = useState<Rect[]>([
      { id: 'a', x: 0, y: 0, width: 100, height: 100 },
    ]);
    const rectsRef = useRef(rects);
    rectsRef.current = rects;
    const sel = useSelection({ initial: [asNodeId('a')], mode: 'single' });
    const base = arrayAdapter<Rect, Pose>({
      ref: rectsRef, setItems: setRects,
      toPose: (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
    });
    const adapter = { ...base, ...sel.adapterMethods, applyBatch };
    const select = useSelectTool(adapter, {});
    const noop = defineTool({ id: 'noop', drag: { onStart: () => 'claim' } });
    const tools = useTools({
      active: 'noop',
      registry: { select, noop },
    });
    return (
      <Canvas
        width={200} height={200} layers={{}}
        adapter={adapter} selection={sel} tools={tools} clientToWorld={C2W}
      />
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  canvas.setPointerCapture = () => {};
  // Bounds (0,0,100,100). Top-center is (50,0). Rotation handle is at
  // (50, 0 - DEFAULT_ROTATION_HANDLE_DISTANCE) = (50, -24). Click there.
  fireEvent.pointerDown(canvas, { clientX: 50, clientY: -24, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: 60, clientY: -20, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 60, clientY: -20, pointerId: 1 });
  // Without the affordance pipeline, the noop tool would claim instead.
  // With it, useRotate fires through the affordance's drag channel.
  expect(applyBatch).toHaveBeenCalledTimes(1);
  const [, label] = applyBatch.mock.calls[0] as [unknown, string];
  expect(label).toBe('Rotate');
});
```

- [ ] **Step 2: Run + commit**

```bash
npx vitest run src/tools/builtin/integration.test.tsx
git add src/tools/builtin/integration.test.tsx
git commit -m "$(cat <<'EOF'
test(select-tool): cross-tool rotation via affordance pipeline

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Audit remaining chrome violations (TODO entry)

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Append an entry under "Tool primitive follow-ups"**

```markdown
- **Audit other chrome violations against the visible-is-hittable principle.**
  The chrome-affordances spec (`docs/superpowers/specs/2026-05-10-chrome-affordances-design.md`)
  shipped corner-resize + rotation. Other chrome that may render while a
  non-owning tool is active and need the same migration:
  - Anchor-edit dots (`useEditAnchorsTool`) — visible during anchor-edit
    mode; if a consumer renders them outside that mode, they're stranded.
  - Snap-target highlights — currently rendered by `createCellHighlightLayer`
    via the grid slot. No interaction today; if hover state ever becomes
    interactive (e.g. click-to-snap-here), file a follow-up.
  - Debug-overlay hit-rings — visualization only; principle satisfied.
  Each chrome family with a real interactive surface gets its own follow-up
  spec once selection-chrome lands. Filed 2026-05-XX.
```

- [ ] **Step 2: Commit**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(todo): note chrome-violation audit follow-ups

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Canvas slot cleanup + doc updates

### Task 17: Drop Canvas's MULTI_RESIZE_TARGET_ID synthesis

`ChromeState.unionBounds` now exposes the union directly. The `poseById` synthesis we added to handle `MULTI_RESIZE_TARGET_ID` is redundant.

**Files:**
- Modify: `src/canvas/Canvas.tsx`

- [ ] **Step 1: Find and delete the synthesis branch**

In `src/canvas/Canvas.tsx`, locate the block (around line 962):

```tsx
// Multi-union fallback: when no tool synthesizes the synthetic
// multi-resize id (e.g. when active tool isn't `useSelectTool`),
// Canvas computes it from the live selection. Without this, multi
// selections committed by sibling tools (lasso, custom area-select)
// wouldn't render their union AABB chrome.
if (multiActive && id === MULTI_RESIZE_TARGET_ID && effectiveBoundsOf) {
  // ... 15 lines of union computation ...
}
```

Delete the entire block. Affordances now render the union AABB chrome from `ChromeState.unionBounds` directly; the selection-overlay slot's `getSelection: () => [MULTI_RESIZE_TARGET_ID]` path becomes unnecessary too — collapse both. If existing demos still pass `selectionOverlay: { handles: { size: HANDLE } }` and expect a working union, verify they still render correctly via the affordance path.

- [ ] **Step 2: Drop the `getOutlineIds` branching too**

Around line 1000:

```tsx
const getOutlineIds = multiActive
  ? (): readonly NodeId[] => selectedIds as readonly NodeId[]
  : undefined;
```

This was a workaround for the multi-mode case. With affordances the outline can be drawn by an "outline" affordance (or stay in `createSelectionOverlayLayer` as a presentational wrapper). For Phase 5, the call becomes simpler — pass `selectedIds` directly without the multi-mode branch.

- [ ] **Step 3: Verify demos still render correctly**

```bash
npx vitest run --reporter=dot
npm run build 2>&1 | grep -E "Build success|error" | tail
```

Expected: clean. If a visual-regression baseline shifts, soak via `gh workflow run visual-update.yml` per the kit's existing procedure.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/Canvas.tsx
git commit -m "$(cat <<'EOF'
refactor(canvas): drop MULTI_RESIZE_TARGET_ID synthesis

ChromeState.unionBounds now exposes the union AABB directly; the
poseById fallback that synthesized it from selectedIds + effectiveBoundsOf
is redundant. Drops ~30 lines from Canvas's selection-overlay slot
wiring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Drop useSelectTool's previewBounds dance

`previewBounds` is now subsumed by ChromeState. The `boundsOfRef` + `getSelectionRef` plumbing that synthesized the MULTI union inside the tool can go.

**Files:**
- Modify: `src/tools/builtin/useSelectTool.ts`

- [ ] **Step 1: Remove the previewBounds synthesis**

Locate (around lines 308–332) the `previewBounds` function and the `boundsOfRef` / `getSelectionRef` refs that feed it. Delete the synthesis. The Tool's `previewBounds` field can drop entirely OR remain as `() => null` for back-compat (consumer code that reads it should already handle null). Pick one based on whether anything references it externally — `grep -rn "previewBounds" src/` confirms.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx vitest run
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts
git commit -m "$(cat <<'EOF'
refactor(select-tool): drop previewBounds synthesis

ChromeState.unionBounds replaces the previewBounds dance for
MULTI_RESIZE_TARGET_ID. The boundsOfRef + getSelectionRef plumbing
inside useSelectTool is dead.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Update kit docs

Per the spec's "Documentation updates" section.

**Files:**
- Modify: `docs/taxonomy.md`
- Modify: `docs/concepts.md`
- Modify: `docs/extending.md`
- Modify: `docs/hooks.md`

- [ ] **Step 1: `docs/taxonomy.md`**

- §1 *Selection*: change file path from `src/features/selection/useSelection.ts` to `src/core/selection/useSelection.ts`; add a sentence: "ChromeState (the affordance-facing read-only view) is built from SelectionApi via `buildChromeState`; lives in `src/core/selection/chromeState.ts`."
- §1 *Slot*: rewrite the `selectionOverlay` slot description to: "Thin override hook for replacing the default chrome. The kit's tools build their own affordance-based overlays internally (see *Affordance*); the slot is consulted only when a consumer wants to inject a custom overlay layer."
- §1 *Affordance* (new entry, immediately after *Tool*): "A reusable factory primitive that produces a `{ render, hitTest? }` pair consumed by tools. Lives in `src/affordances/`. Tools compose multiple affordances into a single overlay layer via `composeAffordanceLayer`. The dispatcher consults each composite layer's `hitTest` on pointerdown (top-down z-order) before falling through to the active-tool slot walk. Examples: `createCornerResizeAffordance`, `createRotationAffordance`. See `src/affordances/types.ts`."
- §2 *Chrome state* (new entry): "The `ChromeState` object built once per Canvas render and passed to every affordance's `render` and `hitTest` call. Source of truth for selection ids, derived bounds (overlay-aware), multi-union AABB (lazy), and modifier flags. Read-only; affordances dispatch gestures via their drag channel's ToolCtx. See `src/core/selection/chromeState.ts`."
- §1 *Tool*: add a sentence about `claimsAll`: "Optional `claimsAll(ctx)` predicate lets tools in modal states (pen mid-path, text mid-edit) bypass the affordance layer hit-test pipeline."
- §5 *Selection overlay*: rewrite to describe the new model: "Selection chrome is composed from kit-level affordances. `createSelectionOverlayLayer` remains as a presentational helper for consumers who want a single-layer chrome bundle without composing affordances directly. The selection chrome is screen-space-constant for handle sizes but world-space for object positions, same as before."

- [ ] **Step 2: `docs/concepts.md`**

- *Layer*: append a sentence: "Layers may declare an optional `hitTest(worldX, worldY, data, view, dims)` that the dispatcher consults on pointerdown before falling through to the active tool. First non-null result wins."
- New section after *Layer*: *Affordance* — write a paragraph version of the taxonomy entry tailored to the narrative tone of `concepts.md`.

- [ ] **Step 3: `docs/extending.md`**

- *Custom layers* section: add a subsection *Custom affordances* with a worked example. Use `createCornerResizeAffordance` as the reference. ~100 lines including code samples.

- [ ] **Step 4: `docs/hooks.md`**

- Update `useSelection` location to `src/core/selection/useSelection.ts`.
- Add an *Affordances* section (or new file `docs/affordances.md` referenced from `docs/README.md`) listing `createCornerResizeAffordance` and `createRotationAffordance`.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "$(cat <<'EOF'
docs: update taxonomy / concepts / extending / hooks for affordances

Reflects the chrome-affordances architecture: new Affordance and
ChromeState entries; updated Selection (file path), Slot
(selectionOverlay role), Tool (claimsAll), and Selection overlay
sections; new "Building a custom affordance" walkthrough in extending.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Final verification

- [ ] **Step 1: Run prepublishOnly**

```bash
npm run prepublishOnly 2>&1 | grep -E "Test Files|Tests |error|FAIL|Build success" | tail -8
```

Expected: tsc clean; vitest fully green (~1860 tests); tsup build clean.

- [ ] **Step 2: Smoke-test the lasso demo**

Open `http://localhost:5173/weasel/#lasso` (start dev server if needed via `npm run dev`). Verify:
- L switches to lasso, drag commits selection, snaps back to select.
- Resize handles on the multi-union work mid-lasso (test by pressing L → drag → release → press L again → drag handle while lasso would be active → handle resize fires not lasso).
- Rotation handle works the same way.

- [ ] **Step 3: Push when the user requests it**

Do not push automatically.

---

## Notes for the executing engineer

- **`useResize` / `useRotate` controller method names.** Tasks 11 and 14 wire affordance drag callbacks to these controllers. The exact method names (`start` / `move` / `end` vs `begin` / `update` / `commit`) depend on what the kit actually exports. Read `src/interactions/actions/resize/resize.ts` and `rotate/rotate.ts` BEFORE writing the wiring; adapt the call sites accordingly. The argument shapes (target id, world coords, modifiers) are right; method names are the only variance.

- **Dispatcher's `inFlight` shape.** Task 8 synthesizes a virtual tool record for affordance gestures. The existing `inFlight` interface may have more fields than the spec mentioned (`startEvent`, `lastClient`, scratch capture timing). When implementing `startAffordanceGesture`, mirror the existing shape — read what `onPointerDown`'s normal slot path constructs and replicate.

- **Layer order for hit-tests.** Canvas's existing `orderedLayers` is bottom-first (paint order). The dispatcher's `getLayers` callback should return TOP-FIRST. Task 8 reverses; double-check the direction with a unit test (`first hit registered should be the topmost overlay`).

- **`MULTI_RESIZE_TARGET_ID` removal.** Phase 5's cleanup *might* drop this constant from the public barrel. Before deleting, run `grep -rn "MULTI_RESIZE_TARGET_ID" src/ apps/ demo/` to confirm nothing still imports it externally. If it does, leave the symbol exported but mark `@deprecated` with a pointer to `ChromeState.unionBounds`.

- **Visual-regression baselines.** The chrome rendering should be visually identical (same handle math, same colors). If baselines drift after Phase 3 or Phase 4, soak via `gh workflow run visual-update.yml` per `CONTRIBUTING.md`.

- **Coordinate frame check.** Affordances render in screen-space; their `hitTest` receives world-space coords. `worldToScreen` is in `src/core/viewport/viewTransform.ts`; `viewToTransform` in `src/core/viewport/view.ts`. Both are already used by `useSelectTool`'s overlay code — match the existing import paths.
